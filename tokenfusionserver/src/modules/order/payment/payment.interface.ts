import { Order } from '../entities/order.entity';

/**
 * 支付提供商统一接口
 * 定义所有支付渠道（Stripe / PayPal 等）需要实现的标准方法
 * 通过依赖倒置，使 OrderService 不直接依赖具体支付渠道实现
 */
export interface IPaymentProvider {
  /**
   * 创建支付会话 / 订单
   * 根据业务订单信息，在第三方平台创建一个可供用户完成支付的会话或订单
   *
   * @param order 业务订单实体（含金额、套餐、用户等信息）
   * @returns 支付会话信息（如 checkout url、session id、第三方订单 id 等）
   */
  createCheckoutSession(order: Order): Promise<CheckoutSessionResult>;

  /**
   * 校验 Webhook 请求签名
   * 确认请求确实来自对应支付平台，防止伪造回调
   *
   * @param rawBody   原始请求体（未解析的字节流，签名基于其计算）
   * @param signature 请求头中的签名串
   * @returns 校验通过返回 true，否则 false
   */
  verifyWebhook(rawBody: string | Buffer, signature: string): Promise<boolean>;

  /**
   * 解析 Webhook 事件
   * 将原始请求体解析为统一的事件结构，便于业务层分发处理
   *
   * @param payload 原始请求体（字符串或已解析对象）
   * @returns 标准化的事件对象
   */
  parseWebhookEvent(payload: string | Record<string, any>): ParsedWebhookEvent;
}

/**
 * 创建支付会话的返回结果
 */
export interface CheckoutSessionResult {
  /** 支付会话 / 订单唯一标识（如 Stripe session id、PayPal order id） */
  sessionId: string;
  /** 供前端跳转完成支付的 URL */
  checkoutUrl: string;
  /** 支付模式：one_time / subscription */
  mode: string;
}

/**
 * 标准化后的 Webhook 事件结构
 * 屏蔽不同支付平台事件格式差异，统一字段
 */
export interface ParsedWebhookEvent {
  /** 第三方事件唯一 ID（用于幂等去重） */
  eventId: string;
  /** 事件类型，如 checkout.session.completed / PAYMENT.CAPTURE.COMPLETED */
  eventType: string;
  /** 关联的业务订单号（若事件中携带） */
  orderNo?: string;
  /** 第三方交易号 / 资源 ID */
  transactionId?: string;
  /** 关联的第三方订阅 ID（订阅类事件） */
  subscriptionId?: string;
  /** 原始事件载荷，供业务层按需读取 */
  raw: Record<string, any>;
}
