import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 支付渠道枚举（用于支付事件记录）
 */
export enum PaymentEventChannel {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

/**
 * 支付事件实体（幂等去重表）
 * 用于记录第三方支付平台推送的每一个 Webhook 事件
 * 通过 event_id 唯一约束保证同一事件不会被重复处理
 *
 * 幂等处理流程：
 * 1. 收到 Webhook 后，以 (channel, event_id) 查询是否已存在
 * 2. 若已存在且 processed=true，直接返回（跳过处理）
 * 3. 若不存在，先插入一条记录（占位），处理完成后置 processed=true
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('payment_events')
export class PaymentEvent {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 支付渠道：stripe / paypal */
  @Index()
  @Column({ type: 'varchar', length: 16 })
  channel!: PaymentEventChannel;

  /** 第三方事件唯一 ID（Stripe event id / PayPal event id），用于幂等去重 */
  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'varchar', length: 128, unique: true })
  eventId!: string;

  /** 事件类型，如 checkout.session.completed / PAYMENT.CAPTURE.COMPLETED */
  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: string;

  /** 原始事件载荷（JSON），便于追溯排查 */
  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  /** 是否已处理完成（幂等标记） */
  @Column({ type: 'boolean', default: false })
  processed!: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
