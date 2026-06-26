import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 閭€璇峰鍔辩姸鎬佹灇涓? * - pending                    寰呭彂鏀撅紙琚個璇蜂汉宸叉敞鍐屼絾鏈弧瓒冲鍔辨潯浠讹級
 * - register_rewarded          娉ㄥ唽濂栧姳宸插彂鏀? * - first_recharge_rewarded    棣栧厖濂栧姳宸插彂鏀? */
export enum InviteRewardStatus {
  PENDING = 'pending',
  REGISTER_REWARDED = 'register_rewarded',
  FIRST_RECHARGE_REWARDED = 'first_recharge_rewarded',
}

/**
 * 閭€璇峰叧绯诲疄浣? *
 * 璁板綍涓€娆?閭€璇蜂汉 - 琚個璇蜂汉"鐨勯個璇峰叧绯诲強濂栧姳鍙戞斁杩涘害銆? * 閭€璇峰鍔遍€氬父鍒嗕袱闃舵鍙戞斁锛? * 1) 琚個璇蜂汉瀹屾垚娉ㄥ唽 鈫?鍙戞斁娉ㄥ唽濂栧姳锛坮egister_rewarded锛夛紱
 * 2) 琚個璇蜂汉瀹屾垚棣栨鍏呭€?鈫?鍙戞斁棣栧厖濂栧姳锛坒irst_recharge_rewarded锛夈€? *
 * 瀛楁璇存槑锛? * - inviter_id      閭€璇蜂汉鐢ㄦ埛 ID
 * - invitee_id      琚個璇蜂汉鐢ㄦ埛 ID
 * - reward_status   濂栧姳鍙戞斁杩涘害
 * - inviter_reward  閭€璇蜂汉鑾峰緱鐨勫鍔?Token 鏁伴噺
 * - invitee_reward  琚個璇蜂汉鑾峰緱鐨勫鍔?Token 鏁伴噺
 *
 * 绱㈠紩锛? * 1) inviter_id 鈥斺€?鎸夐個璇蜂汉鏌ヨ鍏堕個璇峰垪琛? * 2) invitee_id 鈥斺€?鎸夎閭€璇蜂汉鏌ヨ鍏堕個璇锋潵婧愶紙鍞竴锛屼竴浜轰粎鑳借閭€璇蜂竴娆★級
 *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('invite_relations')
@Index('idx_invite_relations_inviter', ['inviterId'])
@Index('idx_invite_relations_invitee', ['inviteeId'])
export class InviteRelation {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 閭€璇蜂汉鐢ㄦ埛 ID */
  @Column({ name: 'inviter_id', type: 'integer' })
  inviterId!: number;

  /** 琚個璇蜂汉鐢ㄦ埛 ID */
  @Column({ name: 'invitee_id', type: 'integer' })
  inviteeId!: number;

  /** 濂栧姳鍙戞斁杩涘害锛歱ending / register_rewarded / first_recharge_rewarded */
  @Column({ name: 'reward_status', type: 'varchar', length: 32, default: InviteRewardStatus.PENDING })
  rewardStatus!: InviteRewardStatus;

  /** 閭€璇蜂汉鑾峰緱鐨勫鍔?Token 鏁伴噺 */
  @Column({ name: 'inviter_reward', type: 'integer', default: 0 })
  inviterReward!: number;

  /** 琚個璇蜂汉鑾峰緱鐨勫鍔?Token 鏁伴噺 */
  @Column({ name: 'invitee_reward', type: 'integer', default: 0 })
  inviteeReward!: number;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
