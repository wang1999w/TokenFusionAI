import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';

/**
 * Token 账户实体
 * 记录用户的 Token 余额、冻结额、累计统计
 * 使用乐观锁（version 字段）防止并发扣减冲突
 */
@Entity('token_accounts')
export class TokenAccount {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint', unique: true })
  userId!: number;

  @OneToOne(() => User, (user) => user.tokenAccount)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /** 当前可用余额 */
  @Column({ type: 'bigint', default: 0 })
  balance!: number;

  /** 预扣冻结额（请求进行中未结算的 Token） */
  @Column({ type: 'bigint', default: 0 })
  frozen!: number;

  /** 累计充值 Token 总量 */
  @Column({ name: 'total_recharged', type: 'bigint', default: 0 })
  totalRecharged!: number;

  /** 累计消耗 Token 总量 */
  @Column({ name: 'total_consumed', type: 'bigint', default: 0 })
  totalConsumed!: number;

  /** 累计获赠 Token 总量（注册赠额、邀请奖励等） */
  @Column({ name: 'total_gifted', type: 'bigint', default: 0 })
  totalGifted!: number;

  /** 乐观锁版本号，每次更新自动递增 */
  @Column({ type: 'integer', default: 0 })
  version!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
