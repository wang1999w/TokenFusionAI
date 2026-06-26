import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * 套餐类型枚举
 * - one_time: 一次性付费（按次购买 Token）
 * - subscription: 订阅制（周期性扣费）
 */
export enum PlanType {
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
}

/**
 * 订阅周期枚举
 * - month: 月付
 * - year: 年付
 */
export enum PlanInterval {
  MONTH = 'month',
  YEAR = 'year',
}

/**
 * 套餐配置实体
 * 定义可购买的 Token 套餐：免费、入门、专业、开发者等
 * 记录价格、Token 数量、计费方式及功能特性列表
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('plans')
export class Plan {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 套餐唯一编码（free/starter/pro/developer），用于业务层引用 */
  @Column({ type: 'varchar', length: 32, unique: true })
  code!: string;

  /** 套餐展示名称 */
  @Column({ type: 'varchar', length: 64 })
  name!: string;

  /** 价格（单位：分），避免浮点精度问题，例如 499 = $4.99 */
  @Column({ name: 'price_cents', type: 'integer' })
  priceCents!: number;

  /** 币种，ISO 4217 货币代码，默认 USD */
  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency!: string;

  /** 该套餐包含的 Token 数量（大整数，使用 bigint） */
  @Column({ name: 'token_amount', type: 'bigint' })
  tokenAmount!: number;

  /** 计费类型：one_time 一次性 / subscription 订阅 */
  @Column({ type: 'varchar', length: 16 })
  type!: PlanType;

  /** 订阅周期：month / year；一次性套餐为 null */
  @Column({ type: 'varchar', length: 16, nullable: true })
  interval!: PlanInterval | null;

  /** 功能特性列表（JSON 数组），如 ["2000 tokens", "邮件支持"] */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  features!: string[];

  /** 是否标记为"推荐"套餐（前端高亮展示） */
  @Column({ name: 'is_popular', type: 'boolean', default: false })
  isPopular!: boolean;

  /** 排序权重，数值越小越靠前 */
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  /** 是否启用（下架的套餐不会展示给用户） */
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
