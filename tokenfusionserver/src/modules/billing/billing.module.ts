import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { TokenAccount } from './entities/token-account.entity';
import { TokenRecord } from './entities/token-record.entity';
import { FreeQuotaRule } from './entities/free-quota-rule.entity';

/**
 * 计费模块
 *
 * 注册 Token 账户、Token 流水、免费额度规则三个实体仓储，
 * 对外提供计费服务（BillingService）与计费接口（BillingController）。
 * 导出 BillingService 以供其它模块（如订单、注册赠额等）调用。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TokenAccount, TokenRecord, FreeQuotaRule]),
  ],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
