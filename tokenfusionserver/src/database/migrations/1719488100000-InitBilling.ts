import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 计费体系初始迁移
 * 创建 token_records（Token 流水表）与 free_quota_rules（免费额度规则表）
 *
 * 说明：token_accounts 表已在 1719488000000-InitUsersAndAuth 迁移中创建，
 * token_records 通过 account_id 外键关联 token_accounts。
 */
export class InitBilling1719488100000 implements MigrationInterface {
  name = 'InitBilling1719488100000';

  /**
   * 执行迁移 - 创建表
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== token_records 表 ====================
    // 流水账本：只增不改，记录每一次 Token 变动
    await queryRunner.query(`
      CREATE TABLE "token_records" (
        "id"              BIGSERIAL PRIMARY KEY,
        "user_id"         BIGINT NOT NULL,
        "account_id"      BIGINT NOT NULL,
        "amount"          BIGINT NOT NULL,
        "type"            VARCHAR(32) NOT NULL,
        "biz_type"        VARCHAR(32),
        "biz_id"          VARCHAR(64),
        "balance_after"   BIGINT NOT NULL,
        "idempotency_key" VARCHAR(64) NOT NULL,
        "remark"          TEXT,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_token_records_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "fk_token_records_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_token_records_account"
          FOREIGN KEY ("account_id")
          REFERENCES "token_accounts" ("id")
          ON DELETE CASCADE
      )
    `);

    // 用户流水分页查询索引（user_id + created_at 倒序，匹配按时间倒序的分页查询）
    await queryRunner.query(
      `CREATE INDEX "idx_token_records_user_created" ON "token_records" ("user_id", "created_at" DESC)`,
    );
    // 业务对账索引（按业务类型 + 业务 ID 检索流水）
    await queryRunner.query(
      `CREATE INDEX "idx_token_records_biz" ON "token_records" ("biz_type", "biz_id")`,
    );

    // ==================== free_quota_rules 表 ====================
    // 免费额度规则：按场景配置赠额数量与启用状态
    await queryRunner.query(`
      CREATE TABLE "free_quota_rules" (
        "id"         BIGSERIAL PRIMARY KEY,
        "scene"      VARCHAR(32) NOT NULL,
        "amount"     BIGINT NOT NULL,
        "enabled"    BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // scene 唯一索引：每个场景仅允许一条规则
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_free_quota_rules_scene" ON "free_quota_rules" ("scene")`,
    );
  }

  /**
   * 回滚迁移 - 删除表（按创建的逆序）
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // free_quota_rules
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_free_quota_rules_scene"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "free_quota_rules"`);

    // token_records
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_token_records_biz"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_token_records_user_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "token_records"`);
  }
}
