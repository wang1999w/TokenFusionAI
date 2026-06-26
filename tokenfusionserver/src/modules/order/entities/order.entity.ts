import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plan } from './plan.entity';
import { Subscription } from './subscription.entity';

/**
 * 支付渠道枚举
 * - stripe: Stripe（支持信用卡 / 订阅）
 * - paypal: PayPal
 */
export enum PayChannel {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

/**
 * 支付模式枚举
 * - one_time: 一次性付款
 * - subscription: 订阅周期扣款
 */
export enum PayMode {
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
}

/**
 * 订单状态枚举
 * - pending: 待支付（已创建未完成支付）
 * - paid: 已支付
 * - failed: 支付失败
 * - refunded: 已退款
 * - cancelled: 已取消
 */
export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

/**
 * 订单实体
 * 记录用户的一次购买行为：套餐、金额、支付渠道、支付状态、关联的第三方交易号等
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('orders')
export class Order {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 业务订单号（唯一），用于对外展示与对账，如 ORD20240627xxxx */
  @Index({ unique: true })
  @Column({ name: 'order_no', type: 'varchar', length: 32, unique: true })
  orderNo!: string;

  /** 下单用户 ID */
  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /** 套餐 ID（关联 plans 表） */
  @Column({ name: 'plan_id', type: 'bigint' })
  planId!: number;

  /** 关联的套餐（多对一） */
  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan;

  /** 实付金额（单位：分） */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  /** 币种 */
  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency!: string;

  /** 该订单对应的 Token 数量 */
  @Column({ name: 'token_amount', type: 'bigint' })
  tokenAmount!: number;

  /** 支付渠道：stripe / paypal */
  @Column({ name: 'pay_channel', type: 'varchar', length: 16 })
  payChannel!: PayChannel;

  /** 支付模式：one_time / subscription */
  @Column({ name: 'pay_mode', type: 'varchar', length: 16 })
  payMode!: PayMode;

  /** 订单状态：pending/paid/failed/refunded/cancelled */
  @Index()
  @Column({ type: 'varchar', length: 32, default: OrderStatus.PENDING })
  status!: OrderStatus;

  /** 第三方支付交易号（如 Stripe charge id / PayPal capture id） */
  @Column({ name: 'transaction_id', type: 'varchar', length: 128, nullable: true })
  transactionId!: string | null;

  /** Stripe Checkout Session ID（用于查询/对账） */
  @Column({ name: 'stripe_session_id', type: 'varchar', length: 128, nullable: true })
  stripeSessionId!: string | null;

  /** 关联的订阅 ID（仅订阅订单有值） */
  @Column({ name: 'subscription_id', type: 'bigint', nullable: true })
  subscriptionId!: number | null;

  /** 关联的订阅实体 */
  @ManyToOne(() => Subscription, { nullable: true })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: Subscription | null;

  /** 支付成功时间 */
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  /** 退款时间 */
  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt!: Date | null;

  /** 扩展元数据（JSON），如支付渠道返回的原始信息 */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, any>;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
