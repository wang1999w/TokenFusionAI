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
 * Token 璐︽埛瀹炰綋
 * 璁板綍鐢ㄦ埛鐨?Token 浣欓銆佸喕缁撻銆佺疮璁＄粺璁? * 浣跨敤涔愯閿侊紙version 瀛楁锛夐槻姝㈠苟鍙戞墸鍑忓啿绐? */
@Entity('token_accounts')
export class TokenAccount {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Column({ name: 'user_id', type: 'integer', unique: true })
  userId!: number;

  @OneToOne(() => User, (user) => user.tokenAccount)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /** 褰撳墠鍙敤浣欓 */
  @Column({ type: 'integer', default: 0 })
  balance!: number;

  /** 棰勬墸鍐荤粨棰濓紙璇锋眰杩涜涓湭缁撶畻鐨?Token锛?*/
  @Column({ type: 'integer', default: 0 })
  frozen!: number;

  /** 绱鍏呭€?Token 鎬婚噺 */
  @Column({ name: 'total_recharged', type: 'integer', default: 0 })
  totalRecharged!: number;

  /** 绱娑堣€?Token 鎬婚噺 */
  @Column({ name: 'total_consumed', type: 'integer', default: 0 })
  totalConsumed!: number;

  /** 绱鑾疯禒 Token 鎬婚噺锛堟敞鍐岃禒棰濄€侀個璇峰鍔辩瓑锛?*/
  @Column({ name: 'total_gifted', type: 'integer', default: 0 })
  totalGifted!: number;

  /** 涔愯閿佺増鏈彿锛屾瘡娆℃洿鏂拌嚜鍔ㄩ€掑 */
  @Column({ type: 'integer', default: 0 })
  version!: number;

  @UpdateDateColumn({ name: 'updated_at',  })
  updatedAt!: Date;
}
