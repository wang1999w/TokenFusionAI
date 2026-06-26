import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 初始数据库迁移 - 创建用户与认证相关表结构
 * 包含：users, refresh_tokens, device_binds, token_accounts
 */
export class InitUsersAndAuth1719488000000 implements MigrationInterface {
  name = 'InitUsersAndAuth1719488000000';

  /**
   * 执行迁移 - 创建表
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== users 表 ====================
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           BIGSERIAL PRIMARY KEY,
        "uuid"         UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        "email"        VARCHAR(255) UNIQUE NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
        "status"       SMALLINT NOT NULL DEFAULT 1,
        "role"         VARCHAR(32) NOT NULL DEFAULT 'user',
        "nickname"     VARCHAR(64),
        "avatar_url"   VARCHAR(512),
        "invite_code"  VARCHAR(16) UNIQUE NOT NULL,
        "inviter_id"   BIGINT,
        "last_login_at" TIMESTAMPTZ,
        "last_login_ip" INET,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "fk_users_inviter"
          FOREIGN KEY ("inviter_id")
          REFERENCES "users" ("id")
          ON DELETE SET NULL
      )
    `);

    // 用户表索引
    await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users" ("email") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE INDEX "idx_users_invite_code" ON "users" ("invite_code")`);
    await queryRunner.query(`CREATE INDEX "idx_users_inviter_id" ON "users" ("inviter_id")`);

    // ==================== refresh_tokens 表 ====================
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"          BIGSERIAL PRIMARY KEY,
        "user_id"     BIGINT NOT NULL,
        "token_hash"  VARCHAR(255) NOT NULL,
        "device_id"   VARCHAR(128),
        "user_agent"  TEXT,
        "ip"          INET,
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "revoked"     BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_refresh_tokens_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`);

    // ==================== device_binds 表 ====================
    await queryRunner.query(`
      CREATE TABLE "device_binds" (
        "id"          BIGSERIAL PRIMARY KEY,
        "device_id"   VARCHAR(128) NOT NULL UNIQUE,
        "user_id"     BIGINT,
        "fingerprint" TEXT,
        "ip"          INET,
        "user_agent"  TEXT,
        "first_seen"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "last_seen"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_device_binds_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_device_binds_user_id" ON "device_binds" ("user_id")`);

    // ==================== token_accounts 表 ====================
    await queryRunner.query(`
      CREATE TABLE "token_accounts" (
        "id"              BIGSERIAL PRIMARY KEY,
        "user_id"         BIGINT UNIQUE NOT NULL,
        "balance"         BIGINT NOT NULL DEFAULT 0,
        "frozen"          BIGINT NOT NULL DEFAULT 0,
        "total_recharged" BIGINT NOT NULL DEFAULT 0,
        "total_consumed"  BIGINT NOT NULL DEFAULT 0,
        "total_gifted"    BIGINT NOT NULL DEFAULT 0,
        "version"         INTEGER NOT NULL DEFAULT 0,
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_token_accounts_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_token_accounts_user_id" ON "token_accounts" ("user_id")`);
  }

  /**
   * 回滚迁移 - 删除表
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_token_accounts_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_accounts"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_device_binds_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_binds"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_refresh_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_inviter_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_invite_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
