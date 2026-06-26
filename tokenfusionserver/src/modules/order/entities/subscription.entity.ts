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

/**
 * 订阅状态枚举
 * - active: 生效中
 * - cancelled: 已取消（周期结束不再续费）
 * - past_due: 逾期未支付（扣款失败待重试）
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
}

/**
 * 订阅实体
 * 记录用户的周期性订阅关系，对应第三方（Stripe / PayPal）的订阅对象
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('subscriptions')
export class Subscription {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 订阅所属用户 ID */
  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /** 订阅的套餐 ID */
  @Column({ name: 'plan_id', type: 'bigint' })
  planId!: number;

  /** 关联的套餐 */
  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan;

  /** 第三方订阅 ID（如 Stripe subscription id / PayPal subscription id） */
  @Column({ name: 'external_sub_id', type: 'varchar', length: 128 })
  externalSubId!: string;

  /** 订阅状态：active/cancelled/past_due */
  @Index()
  @Column({ type: 'varchar', length: 32, default: SubscriptionStatus.ACTIVE })
  status!: SubscriptionStatus;

  /** 当前周期结束时间（到期后决定是否续费） */
  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  /** 是否在周期结束时取消（用户主动取消订阅时置为 true） */
  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
