import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envConfig } from './config/env.config';
import { databaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { OrderModule } from './modules/order/order.module';
import { ApiKeyModule } from './modules/apikey/apikey.module';
import { GenerationModule } from './modules/generation/generation.module';
import { AdminModule } from './modules/admin/admin.module';

/**
 * 应用根模块
 * 导入配置、数据库连接和所有业务模块
 */
@Module({
  imports: [
    // 加载环境变量校验配置，并在 ConfigModule 内部加载 database / redis 配置
    ConfigModule.forRoot(envConfig),
    // TypeORM 数据库连接配置
    TypeOrmModule.forRootAsync(databaseConfig),
    // 业务模块
    UserModule,
    AuthModule,
    // 计费模块（Phase 2）：账户、流水、预扣冻结/结算/回补、充值、赠额
    BillingModule,
    // 订单模块（Phase 3）：套餐、订单、订阅、发票、支付（Stripe/PayPal）与 Webhook
    OrderModule,
    // API Key 模块（Phase 5）：开发者密钥管理、内部校验与用量回写
    ApiKeyModule,
    // 生成历史模块（Phase 5）：记录每次 AI 生成调用上下文与结果
    GenerationModule,
    // 管理后台模块（Phase 7）：用户/订单管理、数据看板
    AdminModule,
  ],
})
export class AppModule {}
