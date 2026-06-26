import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * API Key 与管理后台模块迁移（Phase 5 / Phase 7）
 *
 * 创建以下表：
 * 1) api_keys           —— API 密钥表（开发者通过 API Key 调用平台能力）
 * 2) generation_history —— 生成历史表（记录每次 AI 生成调用上下文与结果）
 * 3) invite_relations   —— 邀请关系表（邀请人 / 被邀请人及奖励发放进度）
 * 4) audit_logs         —— 审计日志表（管理后台敏感操作留痕）
 *
 * 外键依赖：均依赖 users 表（已在 1719488000000-InitUsersAndAuth 迁移中创建）。
 */
export class InitApiKeyAndAdmin1719488300000 implements MigrationInterface {
  name = 'InitApiKeyAndAdmin1719488300000';

  /**
   * 执行迁移 - 创建表
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== api_keys 表（API 密钥） ====================
    // 存储密钥前缀（展示用）与 SHA256 哈希（校验用），明文密钥从不落库
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id"           BIGSERIAL PRIMARY KEY,
        "user_id"      BIGINT NOT NULL,
        "name"         VARCHAR(64) NOT NULL,
        "key_prefix"   VARCHAR(16) NOT NULL,
        "key_hash"     VARCHAR(255) NOT NULL,
        "status"       SMALLINT NOT NULL DEFAULT 1,
        "quota_total"  BIGINT,
        "quota_used"   BIGINT NOT NULL DEFAULT 0,
        "last_used_at" TIMESTAMPTZ,
        "expires_at"   TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_api_keys_key_hash" UNIQUE ("key_hash"),
        CONSTRAINT "fk_api_keys_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE
      )
    `);

    // 按用户查询其密钥列表
    await queryRunner.query(
      `CREATE INDEX "idx_api_keys_user_id" ON "api_keys" ("user_id")`,
    );

    // ==================== generation_history 表（生成历史） ====================
    // 记录每次生成调用的类型、提供方、模型、提示词、参数、结果、Token 消耗等
    await queryRunner.query(`
      CREATE TABLE "generation_history" (
        "id"               BIGSERIAL PRIMARY KEY,
        "user_id"          BIGINT,
        "device_id"        VARCHAR(128) NOT NULL,
        "type"             VARCHAR(16) NOT NULL,
        "provider"         VARCHAR(32) NOT NULL,
        "model"            VARCHAR(64) NOT NULL,
        "prompt"           TEXT NOT NULL,
        "negative_prompt"  TEXT,
        "params"           JSONB NOT NULL DEFAULT '{}'::jsonb,
        "result"           JSONB NOT NULL DEFAULT '{}'::jsonb,
        "token_cost"       BIGINT NOT NULL DEFAULT 0,
        "duration_ms"      INTEGER NOT NULL DEFAULT 0,
        "status"           VARCHAR(16) NOT NULL DEFAULT 'pending',
        "error_msg"        TEXT,
        "is_public"       BOOLEAN NOT NULL DEFAULT FALSE,
        "invite_code"      VARCHAR(16),
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_generation_history_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE SET NULL
      )
    `);

    // 用户历史分页（按时间倒序）
    await queryRunner.query(
      `CREATE INDEX "idx_generation_user_created" ON "generation_history" ("user_id", "created_at" DESC)`,
    );
    // 设备历史分页
    await queryRunner.query(
      `CREATE INDEX "idx_generation_device_created" ON "generation_history" ("device_id", "created_at" DESC)`,
    );
    // 按类型统计与检索
    await queryRunner.query(
      `CREATE INDEX "idx_generation_type_created" ON "generation_history" ("type", "created_at" DESC)`,
    );

    // ==================== invite_relations 表（邀请关系） ====================
    // 记录邀请人 - 被邀请人关系及奖励发放进度；被邀请人仅能被邀请一次（invitee_id 唯一）
    await queryRunner.query(`
      CREATE TABLE "invite_relations" (
        "id"             BIGSERIAL PRIMARY KEY,
        "inviter_id"     BIGINT NOT NULL,
        "invitee_id"     BIGINT NOT NULL,
        "reward_status"  VARCHAR(32) NOT NULL DEFAULT 'pending',
        "inviter_reward" BIGINT NOT NULL DEFAULT 0,
        "invitee_reward" BIGINT NOT NULL DEFAULT 0,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_invite_relations_invitee" UNIQUE ("invitee_id"),
        CONSTRAINT "fk_invite_relations_inviter"
          FOREIGN KEY ("inviter_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_invite_relations_invitee"
          FOREIGN KEY ("invitee_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE
      )
    `);

    // 按邀请人查询其邀请列表
    await queryRunner.query(
      `CREATE INDEX "idx_invite_relations_inviter" ON "invite_relations" ("inviter_id")`,
    );

    // ==================== audit_logs 表（审计日志） ====================
    // 记录管理后台敏感操作（封禁、调额等），便于追溯
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"          BIGSERIAL PRIMARY KEY,
        "operator_id" BIGINT,
        "target_type" VARCHAR(32) NOT NULL,
        "target_id"   BIGINT NOT NULL,
        "action"      VARCHAR(32) NOT NULL,
        "detail"      JSONB NOT NULL DEFAULT '{}'::jsonb,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_audit_logs_operator"
          FOREIGN KEY ("operator_id")
          REFERENCES "users" ("id")
          ON DELETE SET NULL
      )
    `);

    // 按操作人查询其操作历史
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_operator" ON "audit_logs" ("operator_id")`,
    );
    // 按操作对象检索
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_target" ON "audit_logs" ("target_type", "target_id")`,
    );
    // 按时间检索
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_created" ON "audit_logs" ("created_at" DESC)`,
    );
  }

  /**
   * 回滚迁移 - 删除表（按创建的逆序）
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // audit_logs
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_target"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_operator"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);

    // invite_relations
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invite_relations_inviter"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invite_relations"`);

    // generation_history
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_generation_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_generation_device_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_generation_user_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "generation_history"`);

    // api_keys
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_api_keys_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
  }
}
