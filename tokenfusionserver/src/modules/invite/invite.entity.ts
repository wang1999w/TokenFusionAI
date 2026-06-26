import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 邀请奖励状态枚举
 * - pending                    待发放（被邀请人已注册但未满足奖励条件）
 * - register_rewarded          注册奖励已发放
 * - first_recharge_rewarded    首充奖励已发放
 */
export enum InviteRewardStatus {
  PENDING = 'pending',
  REGISTER_REWARDED = 'register_rewarded',
  FIRST_RECHARGE_REWARDED = 'first_recharge_rewarded',
}

/**
 * 邀请关系实体
 *
 * 记录一次"邀请人 - 被邀请人"的邀请关系及奖励发放进度。
 * 邀请奖励通常分两阶段发放：
 * 1) 被邀请人完成注册 → 发放注册奖励（register_rewarded）；
 * 2) 被邀请人完成首次充值 → 发放首充奖励（first_recharge_rewarded）。
 *
 * 字段说明：
 * - inviter_id      邀请人用户 ID
 * - invitee_id      被邀请人用户 ID
 * - reward_status   奖励发放进度
 * - inviter_reward  邀请人获得的奖励 Token 数量
 * - invitee_reward  被邀请人获得的奖励 Token 数量
 *
 * 索引：
 * 1) inviter_id —— 按邀请人查询其邀请列表
 * 2) invitee_id —— 按被邀请人查询其邀请来源（唯一，一人仅能被邀请一次）
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('invite_relations')
@Index('idx_invite_relations_inviter', ['inviterId'])
@Index('idx_invite_relations_invitee', ['inviteeId'])
export class InviteRelation {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 邀请人用户 ID */
  @Column({ name: 'inviter_id', type: 'bigint' })
  inviterId!: number;

  /** 被邀请人用户 ID */
  @Column({ name: 'invitee_id', type: 'bigint' })
  inviteeId!: number;

  /** 奖励发放进度：pending / register_rewarded / first_recharge_rewarded */
  @Column({ name: 'reward_status', type: 'varchar', length: 32, default: InviteRewardStatus.PENDING })
  rewardStatus!: InviteRewardStatus;

  /** 邀请人获得的奖励 Token 数量 */
  @Column({ name: 'inviter_reward', type: 'bigint', default: 0 })
  inviterReward!: number;

  /** 被邀请人获得的奖励 Token 数量 */
  @Column({ name: 'invitee_reward', type: 'bigint', default: 0 })
  inviteeReward!: number;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
