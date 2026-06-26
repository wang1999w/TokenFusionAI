import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 订单与支付模块迁移 - 创建支付/订单相关表结构并初始化套餐数据
 * 包含表：plans, subscriptions, orders, invoices, payment_events
 *
 * 创建顺序考虑外键依赖：
 * plans → subscriptions → orders → invoices → payment_events
 */
export class InitOrders1719488200000 implements MigrationInterface {
  name = 'InitOrders1719488200000';

  /**
   * 执行迁移 - 创建表并插入默认套餐
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== plans 表（套餐配置） ====================
    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id"           BIGSERIAL PRIMARY KEY,
        "code"         VARCHAR(32) UNIQUE NOT NULL,
        "name"         VARCHAR(64) NOT NULL,
        "price_cents"  INTEGER NOT NULL DEFAULT 0,
        "currency"     VARCHAR(8) NOT NULL DEFAULT 'USD',
        "token_amount" BIGINT NOT NULL DEFAULT 0,
        "type"         VARCHAR(16) NOT NULL,
        "interval"     VARCHAR(16),
        "features"     JSONB NOT NULL DEFAULT '[]'::jsonb,
        "is_popular"   BOOLEAN NOT NULL DEFAULT FALSE,
        "sort_order"   INTEGER NOT NULL DEFAULT 0,
        "enabled"      BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_plans_code" ON "plans" ("code")`);
    await queryRunner.query(`CREATE INDEX "idx_plans_enabled_sort" ON "plans" ("enabled", "sort_order")`);

    // ==================== subscriptions 表（订阅） ====================
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id"                    BIGSERIAL PRIMARY KEY,
        "user_id"               BIGINT NOT NULL,
        "plan_id"               BIGINT NOT NULL,
        "external_sub_id"       VARCHAR(128) NOT NULL,
        "status"                VARCHAR(32) NOT NULL DEFAULT 'active',
        "current_period_end"    TIMESTAMPTZ,
        "cancel_at_period_end"  BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_subscriptions_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_subscriptions_plan"
          FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id")
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_subscriptions_user_id" ON "subscriptions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_subscriptions_status" ON "subscriptions" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_subscriptions_external_sub_id" ON "subscriptions" ("external_sub_id")`);

    // ==================== orders 表（订单） ====================
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"                BIGSERIAL PRIMARY KEY,
        "order_no"          VARCHAR(32) UNIQUE NOT NULL,
        "user_id"           BIGINT NOT NULL,
        "plan_id"           BIGINT NOT NULL,
        "amount_cents"      INTEGER NOT NULL DEFAULT 0,
        "currency"          VARCHAR(8) NOT NULL DEFAULT 'USD',
        "token_amount"      BIGINT NOT NULL DEFAULT 0,
        "pay_channel"       VARCHAR(16) NOT NULL,
        "pay_mode"          VARCHAR(16) NOT NULL,
        "status"            VARCHAR(32) NOT NULL DEFAULT 'pending',
        "transaction_id"    VARCHAR(128),
        "stripe_session_id" VARCHAR(128),
        "subscription_id"   BIGINT,
        "paid_at"           TIMESTAMPTZ,
        "refunded_at"       TIMESTAMPTZ,
        "metadata"          JSONB NOT NULL DEFAULT '{}'::jsonb,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_orders_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_orders_plan"
          FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id")
          ON DELETE RESTRICT,
        CONSTRAINT "fk_orders_subscription"
          FOREIGN KEY ("subscription_id")
          REFERENCES "subscriptions" ("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_orders_order_no" ON "orders" ("order_no")`);
    await queryRunner.query(`CREATE INDEX "idx_orders_user_id" ON "orders" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_orders_status" ON "orders" ("status")`);

    // ==================== invoices 表（发票） ====================
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id"           BIGSERIAL PRIMARY KEY,
        "user_id"      BIGINT NOT NULL,
        "order_id"     BIGINT,
        "invoice_no"   VARCHAR(32) UNIQUE NOT NULL,
        "amount_cents" INTEGER NOT NULL DEFAULT 0,
        "pdf_url"      VARCHAR(512),
        "status"       VARCHAR(16) NOT NULL DEFAULT 'issued',
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_invoices_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_invoices_order"
          FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_invoices_user_id" ON "invoices" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_invoices_invoice_no" ON "invoices" ("invoice_no")`);

    // ==================== payment_events 表（支付事件幂等去重） ====================
    await queryRunner.query(`
      CREATE TABLE "payment_events" (
        "id"          BIGSERIAL PRIMARY KEY,
        "channel"     VARCHAR(16) NOT NULL,
        "event_id"    VARCHAR(128) UNIQUE NOT NULL,
        "event_type"  VARCHAR(64) NOT NULL,
        "payload"     JSONB NOT NULL,
        "processed"   BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_payment_events_channel" ON "payment_events" ("channel")`);
    await queryRunner.query(`CREATE INDEX "idx_payment_events_event_id" ON "payment_events" ("event_id")`);

    // ==================== 插入 4 个默认套餐数据 ====================
    await queryRunner.query(`
      INSERT INTO "plans" ("code", "name", "price_cents", "currency", "token_amount", "type", "interval", "features", "is_popular", "sort_order", "enabled") VALUES
        ('free',      'Free 套餐',      0,    'USD', 2000,      'one_time',    NULL,    '["2,000 tokens","基础模型访问","社区支持"]'::jsonb,  FALSE, 1, TRUE),
        ('starter',   'Starter 套餐',   499,  'USD', 100000,    'one_time',    NULL,    '["100,000 tokens","全部模型访问","邮件支持"]'::jsonb, FALSE, 2, TRUE),
        ('pro',       'Pro 套餐',       1999, 'USD', 500000,    'subscription', 'month','["500,000 tokens / 月","全部模型访问","优先支持","高速并发"]'::jsonb, TRUE,  3, TRUE),
        ('developer', 'Developer 套餐', 9999, 'USD', 10000000, 'one_time',    NULL,    '["10,000,000 tokens","全部模型访问","专属支持","API 高额度"]'::jsonb, FALSE, 4, TRUE)
    `);
  }

  /**
   * 回滚迁移 - 删除表（逆序）
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除套餐数据
    await queryRunner.query(`DELETE FROM "plans" WHERE "code" IN ('free', 'starter', 'pro', 'developer')`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_events_event_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_events_channel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_events"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoices_invoice_no"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoices_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_order_no"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscriptions_external_sub_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscriptions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_subscriptions_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_plans_enabled_sort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_plans_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
  }
}
