import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Order } from './entities/order.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { StripeService } from './payment/stripe.service';
import { PaypalService } from './payment/paypal.service';
import { BillingModule } from '../billing/billing.module';

/**
 * 订单模块（Phase 3 支付与订单）
 *
 * 导入 BillingModule 以使用 BillingService 完成支付成功后的 Token 充值
 *
 * 依赖关系（无循环依赖）：
 * - OrderService  → BillingService（充值 Token）
 * - StripeService → OrderService（Webhook 回调 handlePaymentSuccess）+ BillingService（续费充值）
 * - PaypalService → OrderService（Webhook 回调 handlePaymentSuccess）
 * - 控制器编排"创建订单 + 创建支付会话"与"取消订阅"，不依赖 OrderService ↔ 支付服务的双向引用
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plan,
      Order,
      Subscription,
      Invoice,
      PaymentEvent,
    ]),
    BillingModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, StripeService, PaypalService],
  exports: [OrderService],
})
export class OrderModule {}
