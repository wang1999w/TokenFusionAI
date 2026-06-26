import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 免费额度发放场景枚举
 * - register        注册赠额
 * - invite_first     首次邀请成功赠额
 * - first_recharge   首充赠额
 * - daily_device     每日设备赠额
 */
export enum FreeQuotaScene {
  REGISTER = 'register',
  INVITE_FIRST = 'invite_first',
  FIRST_RECHARGE = 'first_recharge',
  DAILY_DEVICE = 'daily_device',
}

/**
 * 免费额度规则实体
 * 定义各场景下赠送的 Token 数量及启用状态
 *
 * 同一 scene 全局唯一，避免出现重复规则。
 * 运营可在该表配置不同场景的赠额额度，业务侧按 scene 读取规则后调用计费服务的赠额接口。
 *
 * 注：属性使用 `!`（确定性赋值断言），表示这些字段由 TypeORM 在查询时自动填充，
 * 无需在构造时初始化（满足 strictPropertyInitialization 检查）。
 */
@Entity('free_quota_rules')
@Index('idx_free_quota_rules_scene', ['scene'], { unique: true })
export class FreeQuotaRule {
  /** 规则自增主键 */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 赠额场景 */
  @Column({ type: 'varchar', length: 32 })
  scene!: FreeQuotaScene;

  /** 赠送 Token 数量 */
  @Column({ type: 'bigint' })
  amount!: number;

  /** 是否启用 */
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
