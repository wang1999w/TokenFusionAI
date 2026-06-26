import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, PayMode } from '../entities/order.entity';
import { Plan } from '../entities/plan.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../entities/subscription.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import {
  PaymentEvent,
  PaymentEventChannel,
} from '../entities/payment-event.entity';
import { OrderService } from '../order.service';
import { BillingService } from '../../billing/billing.service';
import {
  IPaymentProvider,
  CheckoutSessionResult,
  ParsedWebhookEvent,
} from './payment.interface';

/**
 * Stripe 支付服务
 * 实现 IPaymentProvider 接口，提供 Stripe Checkout 创建与 Webhook 处理能力
 *
 * 设计要点：
 * 1. Stripe SDK 通过 require() 在运行时动态加载，避免未安装时编译报错
 * 2. 注入 ConfigService 读取 STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
 * 3. Webhook 通过 payment_events 表的 event_id 唯一约束实现幂等去重
 */
@Injectable()
export class StripeService implements IPaymentProvider {
  private readonly logger = new Logger(StripeService.name);

  /** Stripe 客户端实例（懒加载） */
  private stripeClient: any = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly billingService: BillingService,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepository: Repository<PaymentEvent>,
  ) {}

  /**
   * 懒加载 Stripe 客户端
   * 使用 require 动态导入 stripe 包；若包未安装会在运行时抛错（不影响编译）
   */
  private getStripe(): any {
    if (this.stripeClient) return this.stripeClient;

    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('未配置 STRIPE_SECRET_KEY');
    }

    // 运行时动态 require，兼容 ESM 默认导出
    const stripeModule = require('stripe');
    const StripeConstructor = stripeModule.default || stripeModule;
    // apiVersion 锁定以避免 SDK 警告
    this.stripeClient = new StripeConstructor(secretKey, {
      apiVersion: '2023-10-16',
    });
    return this.stripeClient;
  }

  /**
   * 创建 Stripe Checkout Session
   * 支持一次性支付（mode=payment）与订阅（mode=subscription）
   *
   * @param order 业务订单实体
   * @returns 支付会话信息（session id + 跳转 URL）
   */
  async createCheckoutSession(
    order: Order,
  ): Promise<CheckoutSessionResult> {
    // 查询套餐信息（用于商品名称与订阅周期）
    const plan = await this.planRepository.findOne({
      where: { id: order.planId },
    });
    if (!plan) {
      throw new BadRequestException('套餐不存在');
    }

    const isSubscription = order.payMode === PayMode.SUBSCRIPTION;
    const mode = isSubscription ? 'subscription' : 'payment';

    // 构造 Stripe 前后台回调地址
    const successUrl =
      this.configService.get<string>('STRIPE_SUCCESS_URL') ||
      `${this.configService.get<string>('APP_BASE_URL', '')}/payment/success?order=${order.orderNo}`;
    const cancelUrl =
      this.configService.get<string>('STRIPE_CANCEL_URL') ||
      `${this.configService.get<string>('APP_BASE_URL', '')}/payment/cancel?order=${order.orderNo}`;

    // 构造订单项（line item），金额单位转换为 Stripe 使用的最小货币单位（分）
    const lineItem: any = {
      quantity: 1,
      price_data: {
        currency: order.currency.toLowerCase(),
        unit_amount: order.amountCents,
        product_data: {
          name: plan.name,
          metadata: { plan_code: plan.code, order_no: order.orderNo },
        },
      },
    };

    // 订阅模式需指定 recurring 周期
    if (isSubscription) {
      const interval = plan.interval || 'month';
      lineItem.price_data.recurring = {
        interval: interval as any, // 'month' | 'year'
      };
    }

    // 调用 Stripe API 创建 Checkout Session
    const session = await this.getStripe().checkout.sessions.create({
      mode,
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // 业务订单号写入 client_reference_id 与 metadata，供 Webhook 回查订单
      client_reference_id: order.orderNo,
      metadata: {
        order_no: order.orderNo,
        order_id: String(order.id),
        user_id: String(order.userId),
      },
    });

    // 回写 Stripe Session ID 到订单，便于后续对账
    await this.orderRepository.update(order.id, {
      stripeSessionId: session.id,
    });

    this.logger.log(
      `创建 Stripe Checkout Session：订单 ${order.orderNo}，session=${session.id}，mode=${mode}`,
    );

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      mode,
    };
  }

  /**
   * 校验 Webhook 签名
   * 利用 Stripe SDK 的 constructEvent 进行签名验证
   *
   * @param rawBody   原始请求体（字节流）
   * @param signature Stripe-Signature 请求头
   * @returns 校验通过返回 true，否则 false
   */
  async verifyWebhook(
    rawBody: string | Buffer,
    signature: string,
  ): Promise<boolean> {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret || !signature) return false;

    try {
      this.getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
      return true;
    } catch (err) {
      this.logger.warn(`Stripe Webhook 签名校验失败：${(err as Error).message}`);
      return false;
    }
  }

  /**
   * 解析 Webhook 事件为统一结构
   *
   * @param payload 原始请求体（字符串或对象）
   */
  parseWebhookEvent(payload: string | Record<string, any>): ParsedWebhookEvent {
    const event =
      typeof payload === 'string' ? JSON.parse(payload) : payload;

    return {
      eventId: event.id,
      eventType: event.type,
      raw: event,
    };
  }

  /**
   * 处理 Stripe Webhook
   * 1. 验签（constructEvent 同时完成验签与解析）
   * 2. 幂等去重：基于 event_id 唯一约束
   * 3. 按事件类型分发处理
   *
   * @param rawBody   原始请求体
   * @param signature Stripe-Signature 请求头
   */
  async handleWebhook(
    rawBody: string | Buffer,
    signature: string,
  ): Promise<{ received: boolean }> {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    // 1. 验签 + 解析事件（constructEvent 在验签失败时抛错）
    let event: any;
    try {
      event = this.getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.warn(`Stripe Webhook 验签失败：${(err as Error).message}`);
      throw new BadRequestException('Stripe Webhook 签名校验失败');
    }

    // 2. 幂等去重：插入事件记录，若唯一约束冲突则视为重复事件直接返回
    try {
      const paymentEvent = this.paymentEventRepository.create({
        channel: PaymentEventChannel.STRIPE,
        eventId: event.id,
        eventType: event.type,
        payload: event as Record<string, any>,
        processed: false,
      });
      await this.paymentEventRepository.save(paymentEvent);
    } catch (err) {
      // 唯一约束冲突 => 已处理过的重复事件
      this.logger.log(`Stripe 重复事件 ${event.id}，跳过处理`);
      return { received: true };
    }

    // 3. 按事件类型分发处理
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        default:
          this.logger.log(`Stripe 事件 ${event.type} 暂不处理，跳过`);
      }
    } catch (err) {
      // 处理失败记录日志，但不抛错以让 Stripe 收到 200（避免重试风暴）
      // 实际生产可在此处触发告警/重试队列
      this.logger.error(
        `Stripe 事件 ${event.type}（${event.id}）处理失败`,
        (err as Error)?.stack,
      );
    }

    // 4. 标记事件已处理
    await this.paymentEventRepository.update(
      { eventId: event.id },
      { processed: true },
    );

    return { received: true };
  }

  /**
   * 处理 checkout.session.completed 事件
   * 首次支付完成（一次性或订阅首次）。回查订单并触发支付成功流程
   */
  private async handleCheckoutSessionCompleted(session: any): Promise<void> {
    const orderNo: string =
      session.client_reference_id || session.metadata?.order_no;
    if (!orderNo) {
      this.logger.warn('Stripe checkout.session.completed 缺少订单号引用');
      return;
    }

    const order = await this.orderService.findByOrderNo(orderNo);
    if (!order) {
      this.logger.warn(`订单号 ${orderNo} 未找到，忽略 Stripe 回调`);
      return;
    }

    // 回写 session id 与交易号
    const transactionId =
      session.payment_intent || session.subscription || session.id;

    // 若为订阅模式，创建本地订阅记录并关联到订单
    if (
      order.payMode === PayMode.SUBSCRIPTION &&
      session.subscription &&
      !order.subscriptionId
    ) {
      const subscription = await this.createSubscriptionRecord(
        order,
        session.subscription,
        session,
      );
      await this.orderRepository.update(order.id, {
        subscriptionId: subscription.id,
        stripeSessionId: session.id,
        transactionId,
      });
    } else {
      await this.orderRepository.update(order.id, {
        stripeSessionId: session.id,
        transactionId,
      });
    }

    // 触发支付成功处理（更新状态、生成发票、充值 Token）
    await this.orderService.handlePaymentSuccess(order.id, transactionId);
  }

  /**
   * 处理 invoice.paid 事件
   * 订阅周期性续费成功。首次续费由 checkout.session.completed 处理，此处仅处理续订
   */
  private async handleInvoicePaid(invoice: any): Promise<void> {
    // billing_reason=subscription_create 表示首次订阅，已由 checkout 事件处理
    if (invoice.billing_reason === 'subscription_create') {
      this.logger.log('Stripe invoice 为首次订阅，已由 checkout 事件处理，跳过');
      return;
    }

    const externalSubId: string = invoice.subscription;
    if (!externalSubId) return;

    // 通过第三方订阅 ID 查找本地订阅
    const subscription = await this.subscriptionRepository.findOne({
      where: { externalSubId },
    });
    if (!subscription) {
      this.logger.warn(
        `Stripe invoice.paid：未找到订阅 ${externalSubId}，跳过充值`,
      );
      return;
    }

    // 续费金额（Stripe invoice.total 单位为分）
    const amountCents = invoice.total ?? 0;
    // 生成续费发票记录
    const invoiceNo = `INV${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await this.invoiceRepository.save(
      this.invoiceRepository.create({
        userId: subscription.userId,
        orderId: null,
        invoiceNo,
        amountCents,
        status: InvoiceStatus.ISSUED,
        pdfUrl: invoice.invoice_pdf || null,
      }),
    );

    // 查询套餐 Token 数量，按周期续费充值
    const plan = await this.planRepository.findOne({
      where: { id: subscription.planId },
    });
    const tokenAmount = plan ? Number(plan.tokenAmount) : 0;
    if (tokenAmount > 0) {
      // 续费充值：先确保账户存在（兜底创建，幂等），再调用充值接口
      // 幂等键基于订阅 ID + 发票号，确保同一续费周期不会重复充值
      await this.billingService.createAccount(subscription.userId);
      await this.billingService.rechargeTokens(
        subscription.userId,
        tokenAmount,
        externalSubId,
        `recharge:sub:${externalSubId}:${invoice.number || invoice.id}`,
      );
      this.logger.log(
        `订阅续费充值成功：用户 ${subscription.userId}，+${tokenAmount} tokens`,
      );
    }
  }

  /**
   * 处理 customer.subscription.deleted 事件
   * 订阅被删除（用户取消到期或管理员删除），更新本地订阅状态为 cancelled
   */
  private async handleSubscriptionDeleted(
    stripeSubscription: any,
  ): Promise<void> {
    const externalSubId: string = stripeSubscription.id;
    const subscription = await this.subscriptionRepository.findOne({
      where: { externalSubId },
    });
    if (!subscription) {
      this.logger.warn(
        `Stripe subscription.deleted：未找到订阅 ${externalSubId}`,
      );
      return;
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelAtPeriodEnd = true;
    await this.subscriptionRepository.save(subscription);
    this.logger.log(`订阅 ${externalSubId} 已删除，本地状态更新为 cancelled`);
  }

  /**
   * 创建本地订阅记录（首次订阅成功时）
   */
  private async createSubscriptionRecord(
    order: Order,
    externalSubId: string,
    session: any,
  ): Promise<Subscription> {
    // current_period_end 可从 session.subscription_details 或后续 invoice 获取
    const periodEnd = session.subscription_details?.current_period_end;

    const subscription = this.subscriptionRepository.create({
      userId: order.userId,
      planId: order.planId,
      externalSubId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: false,
    });
    return this.subscriptionRepository.save(subscription);
  }

  /**
   * 取消订阅（调用 Stripe API 在周期结束时取消）
   * 由控制器在编排"取消订阅"时调用
   *
   * @param externalSubId Stripe 订阅 ID
   */
  async cancelSubscription(externalSubId: string): Promise<void> {
    await this.getStripe().subscriptions.update(externalSubId, {
      cancel_at_period_end: true,
    });
    this.logger.log(`Stripe 订阅 ${externalSubId} 已请求周期结束取消`);
  }
}
