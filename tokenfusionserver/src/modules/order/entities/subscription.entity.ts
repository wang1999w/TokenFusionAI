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
 * 璁㈤槄鐘舵€佹灇涓? * - active: 鐢熸晥涓? * - cancelled: 宸插彇娑堬紙鍛ㄦ湡缁撴潫涓嶅啀缁垂锛? * - past_due: 閫炬湡鏈敮浠橈紙鎵ｆ澶辫触寰呴噸璇曪級
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
}

/**
 * 璁㈤槄瀹炰綋
 * 璁板綍鐢ㄦ埛鐨勫懆鏈熸€ц闃呭叧绯伙紝瀵瑰簲绗笁鏂癸紙Stripe / PayPal锛夌殑璁㈤槄瀵硅薄
 *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('subscriptions')
export class Subscription {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 璁㈤槄鎵€灞炵敤鎴?ID */
  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** 璁㈤槄鐨勫椁?ID */
  @Column({ name: 'plan_id', type: 'integer' })
  planId!: number;

  /** 鍏宠仈鐨勫椁?*/
  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan;

  /** 绗笁鏂硅闃?ID锛堝 Stripe subscription id / PayPal subscription id锛?*/
  @Column({ name: 'external_sub_id', type: 'varchar', length: 128 })
  externalSubId!: string;

  /** 璁㈤槄鐘舵€侊細active/cancelled/past_due */
  @Index()
  @Column({ type: 'varchar', length: 32, default: SubscriptionStatus.ACTIVE })
  status!: SubscriptionStatus;

  /** 褰撳墠鍛ㄦ湡缁撴潫鏃堕棿锛堝埌鏈熷悗鍐冲畾鏄惁缁垂锛?*/
  @Column({ type: 'datetime', name: 'current_period_end', nullable: true })
  currentPeriodEnd!: Date | null;

  /** 鏄惁鍦ㄥ懆鏈熺粨鏉熸椂鍙栨秷锛堢敤鎴蜂富鍔ㄥ彇娑堣闃呮椂缃负 true锛?*/
  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;

  /** 鏇存柊鏃堕棿 */
  @UpdateDateColumn({ name: 'updated_at',  })
  updatedAt!: Date;
}
