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
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import {
  PaymentEvent,
  PaymentEventChannel,
} from '../entities/payment-event.entity';
import { OrderService } from '../order.service';
import { CheckoutSessionResult } from './payment.interface';

/**
 * PayPal 支付服务
 * 基于 @paypal/checkout-server-sdk 实现 PayPal 订单的创建、扣款与 Webhook 处理
 *
 * 设计要点：
 * 1. PayPal SDK 通过 require() 在运行时动态加载，避免未安装时编译报错
 * 2. 注入 ConfigService 读取 PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID
 * 3. Webhook 通过 payment_events 表的 event_id 唯一约束实现幂等去重
 * 4. Webhook 签名校验调用 PayPal verify-webhook-signature 接口完成
 *
 * 说明：
 * - checkout-server-sdk 主要用于一次性支付（Orders API）。
 * - PayPal 订阅需使用 Subscriptions API（另行实现），本服务对订阅模式做一次性订单兜底处理。
 */
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);

  /** PayPal HTTP 客户端实例（懒加载） */
  private paypalClient: any = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEventRepository: Repository<PaymentEvent>,
  ) {}

  /**
   * 懒加载 PayPal HTTP 客户端
   * 根据 PAYPAL_MODE 选择沙箱或生产环境
   */
  private getPaypalClient(): any {
    if (this.paypalClient) return this.paypalClient;

    const clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'PAYPAL_CLIENT_SECRET',
    );
    if (!clientId || !clientSecret) {
      throw new Error('未配置 PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET');
    }

    // 运行时动态 require
    const paypal = require('@paypal/checkout-server-sdk');
    const mode = this.configService.get<string>('PAYPAL_MODE', 'sandbox');
    // 根据模式构造对应环境
    const Environment =
      mode === 'live'
        ? paypal.core.LiveEnvironment
        : paypal.core.SandboxEnvironment;
    const environment = new Environment(clientId, clientSecret);
    this.paypalClient = new paypal.core.PayPalHttpClient(environment);
    return this.paypalClient;
  }

  /**
   * 创建支付会话（接口兼容入口）
   * 内部调用 PayPal Orders API 创建订单，返回审批跳转链接
   */
  async createCheckoutSession(
    order: Order,
  ): Promise<CheckoutSessionResult> {
    const result = await this.createOrder(order);
    return {
      sessionId: result.orderId,
      checkoutUrl: result.approveUrl,
      mode: order.payMode === PayMode.SUBSCRIPTION ? 'subscription' : 'payment',
    };
  }

  /**
   * 创建 PayPal 订单
   * 使用 Orders API（intent=CAPTURE），将业务订单号写入 custom_id 便于回调回查
   *
   * @param order 业务订单实体
   * @returns PayPal 订单 ID 与用户审批跳转 URL
   */
  async createOrder(
    order: Order,
  ): Promise<{ orderId: string; approveUrl: string }> {
    // 查询套餐用于商品描述
    const plan = await this.planRepository.findOne({
      where: { id: order.planId },
    });

    const paypal = require('@paypal/checkout-server-sdk');
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    // 金额转换为美元字符串（Stripe 用分，PayPal 用元字符串）
    const value = (order.amountCents / 100).toFixed(2);
    request.requestBody({
      intent: 'CAPTURE',
      // 业务订单号写入 custom_id，Webhook 回查时使用
      custom_id: order.orderNo,
      purchase_units: [
        {
          reference_id: String(order.id),
          description: plan ? plan.name : 'Token Package',
          custom_id: order.orderNo,
          amount: {
            currency_code: order.currency,
            value,
          },
        },
      ],
      application_context: {
        brand_name: 'TokenFusion',
        user_action: 'PAY_NOW',
        return_url:
          this.configService.get<string>('PAYPAL_RETURN_URL') ||
          `${this.configService.get<string>('APP_BASE_URL', '')}/payment/paypal/return`,
        cancel_url:
          this.configService.get<string>('PAYPAL_CANCEL_URL') ||
          `${this.configService.get<string>('APP_BASE_URL', '')}/payment/cancel`,
      },
    });

    const response = await this.getPaypalClient().execute(request);
    const paypalOrder = response.result;

    // 提取审批链接（approve）
    const approveLink = paypalOrder.links?.find(
      (l: any) => l.rel === 'approve',
    );

    // 回写 PayPal 订单 ID 到订单 metadata，便于对账
    await this.orderRepository.update(order.id, {
      metadata: { paypal_order_id: paypalOrder.id },
    });

    this.logger.log(
      `创建 PayPal 订单：业务订单 ${order.orderNo}，PayPal 订单 ${paypalOrder.id}`,
    );

    return {
      orderId: paypalOrder.id,
      approveUrl: approveLink?.href || '',
    };
  }

  /**
   * 确认支付（扣款）
   * 对已审批通过的 PayPal 订单执行 capture 操作，返回扣款结果
   *
   * @param paypalOrderId PayPal 订单 ID
   */
  async capturePayment(
    paypalOrderId: string,
  ): Promise<{ status: string; captureId: string | null }> {
    const paypal = require('@paypal/checkout-server-sdk');
    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.prefer('return=representation');

    const response = await this.getPaypalClient().execute(request);
    const result = response.result;

    // 提取 capture id（purchase_units[0].payments.captures[0].id）
    const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      status: result.status,
      captureId: capture?.id || null,
    };
  }

  /**
   * 校验 Webhook 签名
   * 调用 PayPal verify-webhook-signature 接口，校验请求确实来自 PayPal
   *
   * @param headers PayPal 推送的相关请求头（PAYPAL-TRANSMISSION-* 等）
   * @param body    原始事件体（已解析对象）
   */
  async verifyWebhookSignature(
    headers: Record<string, string>,
    body: Record<string, any>,
  ): Promise<boolean> {
    const webhookId = this.configService.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      this.logger.warn('未配置 PAYPAL_WEBHOOK_ID，跳过 PayPal 签名校验');
      return false;
    }

    // 构造 verify-webhook-signature 请求对象
    // PayPal checkout-server-sdk 未直接提供该请求类，此处通过 client.execute 执行自定义请求
    const verifyRequest = {
      path: () => '/v1/notifications/verify-webhook-signature',
      verb: () => 'POST',
      body: () => ({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: body,
      }),
      headers: () => ({ 'Content-Type': 'application/json' }),
    };

    try {
      const response = await this.getPaypalClient().execute(verifyRequest);
      return response.result?.verification_status === 'SUCCESS';
    } catch (err) {
      this.logger.warn(
        `PayPal Webhook 签名校验失败：${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * 处理 PayPal Webhook
   * 1. 校验签名
   * 2. 幂等去重（event_id 唯一约束）
   * 3. 按事件类型分发处理（主要关注 PAYMENT.CAPTURE.COMPLETED）
   *
   * @param headers 请求头
   * @param body     事件体（已解析）
   */
  async handleWebhook(
    headers: Record<string, string>,
    body: Record<string, any>,
  ): Promise<{ received: boolean }> {
    const eventType: string = body.event_type;
    const eventId: string = body.id;

    // 1. 签名校验
    const valid = await this.verifyWebhookSignature(headers, body);
    if (!valid) {
      this.logger.warn(`PayPal Webhook 签名校验失败：事件 ${eventId}`);
      throw new BadRequestException('PayPal Webhook 签名校验失败');
    }

    // 2. 幂等去重
    try {
      const paymentEvent = this.paymentEventRepository.create({
        channel: PaymentEventChannel.PAYPAL,
        eventId,
        eventType,
        payload: body,
        processed: false,
      });
      await this.paymentEventRepository.save(paymentEvent);
    } catch (err) {
      this.logger.log(`PayPal 重复事件 ${eventId}，跳过处理`);
      return { received: true };
    }

    // 3. 按事件类型分发
    try {
      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentCaptureCompleted(body.resource);
          break;
        case 'CHECKOUT.ORDER.APPROVED':
          // 审批通过事件，等待 capture 完成事件再做充值，此处仅记录
          this.logger.log(`PayPal CHECKOUT.ORDER.APPROVED：${eventId}`);
          break;
        default:
          this.logger.log(`PayPal 事件 ${eventType} 暂不处理，跳过`);
      }
    } catch (err) {
      this.logger.error(
        `PayPal 事件 ${eventType}（${eventId}）处理失败`,
        (err as Error)?.stack,
      );
    }

    // 4. 标记已处理
    await this.paymentEventRepository.update(
      { eventId },
      { processed: true },
    );

    return { received: true };
  }

  /**
   * 处理 PAYMENT.CAPTURE.COMPLETED 事件
   * 通过 capture 关联的 PayPal 订单获取 custom_id（业务订单号），回查本地订单并触发支付成功
   */
  private async handlePaymentCaptureCompleted(capture: any): Promise<void> {
    // 从 capture 资源中获取关联的 PayPal 订单 ID
    const paypalOrderId: string | undefined =
      capture?.supplementary_data?.related_ids?.order_id ||
      capture?.order_id;
    if (!paypalOrderId) {
      this.logger.warn('PayPal capture 缺少关联订单 ID，无法回查');
      return;
    }

    // 获取 PayPal 订单详情以读取 custom_id（业务订单号）
    const paypal = require('@paypal/checkout-server-sdk');
    const getRequest = new paypal.orders.OrdersGetRequest(paypalOrderId);
    const getResponse = await this.getPaypalClient().execute(getRequest);
    const paypalOrder = getResponse.result;
    const orderNo: string | undefined = paypalOrder.custom_id;

    if (!orderNo) {
      this.logger.warn(`PayPal 订单 ${paypalOrderId} 缺少 custom_id`);
      return;
    }

    const order = await this.orderService.findByOrderNo(orderNo);
    if (!order) {
      this.logger.warn(`业务订单 ${orderNo} 未找到，忽略 PayPal 回调`);
      return;
    }

    // capture id 作为交易号
    const captureId = capture?.id || paypalOrderId;

    // 触发支付成功处理（更新状态、生成发票、充值 Token）
    await this.orderService.handlePaymentSuccess(order.id, captureId);
  }

  /**
   * 取消订阅（PayPal Subscriptions API）
   * 由控制器在编排"取消订阅"时调用
   * 注意：PayPal 订阅需使用 Subscriptions API，此处通过 verify-webhook 类似的方式调用取消接口
   *
   * @param externalSubId PayPal 订阅 ID
   */
  async cancelSubscription(externalSubId: string): Promise<void> {
    // PayPal 订阅取消接口：POST /v1/billing/subscriptions/{id}/cancel
    const cancelRequest = {
      path: () => `/v1/billing/subscriptions/${externalSubId}/cancel`,
      verb: () => 'POST',
      body: () => ({ reason: 'User requested cancellation' }),
      headers: () => ({ 'Content-Type': 'application/json' }),
    };
    await this.getPaypalClient().execute(cancelRequest);
    this.logger.log(`PayPal 订阅 ${externalSubId} 已请求取消`);
  }
}
