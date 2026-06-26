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
 * 鏀粯娓犻亾鏋氫妇
 * - stripe: Stripe锛堟敮鎸佷俊鐢ㄥ崱 / 璁㈤槄锛? * - paypal: PayPal
 */
export enum PayChannel {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

/**
 * 鏀粯妯″紡鏋氫妇
 * - one_time: 涓€娆℃€т粯娆? * - subscription: 璁㈤槄鍛ㄦ湡鎵ｆ
 */
export enum PayMode {
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
}

/**
 * 璁㈠崟鐘舵€佹灇涓? * - pending: 寰呮敮浠橈紙宸插垱寤烘湭瀹屾垚鏀粯锛? * - paid: 宸叉敮浠? * - failed: 鏀粯澶辫触
 * - refunded: 宸查€€娆? * - cancelled: 宸插彇娑? */
export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

/**
 * 璁㈠崟瀹炰綋
 * 璁板綍鐢ㄦ埛鐨勪竴娆¤喘涔拌涓猴細濂楅銆侀噾棰濄€佹敮浠樻笭閬撱€佹敮浠樼姸鎬併€佸叧鑱旂殑绗笁鏂逛氦鏄撳彿绛? *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('orders')
export class Order {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 涓氬姟璁㈠崟鍙凤紙鍞竴锛夛紝鐢ㄤ簬瀵瑰灞曠ず涓庡璐︼紝濡?ORD20240627xxxx */
  @Index({ unique: true })
  @Column({ name: 'order_no', type: 'varchar', length: 32, unique: true })
  orderNo!: string;

  /** 涓嬪崟鐢ㄦ埛 ID */
  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** 濂楅 ID锛堝叧鑱?plans 琛級 */
  @Column({ name: 'plan_id', type: 'integer' })
  planId!: number;

  /** 鍏宠仈鐨勫椁愶紙澶氬涓€锛?*/
  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan;

  /** 瀹炰粯閲戦锛堝崟浣嶏細鍒嗭級 */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  /** 甯佺 */
  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency!: string;

  /** 璇ヨ鍗曞搴旂殑 Token 鏁伴噺 */
  @Column({ name: 'token_amount', type: 'integer' })
  tokenAmount!: number;

  /** 鏀粯娓犻亾锛歴tripe / paypal */
  @Column({ name: 'pay_channel', type: 'varchar', length: 16 })
  payChannel!: PayChannel;

  /** 鏀粯妯″紡锛歰ne_time / subscription */
  @Column({ name: 'pay_mode', type: 'varchar', length: 16 })
  payMode!: PayMode;

  /** 璁㈠崟鐘舵€侊細pending/paid/failed/refunded/cancelled */
  @Index()
  @Column({ type: 'varchar', length: 32, default: OrderStatus.PENDING })
  status!: OrderStatus;

  /** 绗笁鏂规敮浠樹氦鏄撳彿锛堝 Stripe charge id / PayPal capture id锛?*/
  @Column({ name: 'transaction_id', type: 'varchar', length: 128, nullable: true })
  transactionId!: string | null;

  /** Stripe Checkout Session ID锛堢敤浜庢煡璇?瀵硅处锛?*/
  @Column({ name: 'stripe_session_id', type: 'varchar', length: 128, nullable: true })
  stripeSessionId!: string | null;

  /** 鍏宠仈鐨勮闃?ID锛堜粎璁㈤槄璁㈠崟鏈夊€硷級 */
  @Column({ name: 'subscription_id', type: 'integer', nullable: true })
  subscriptionId!: number | null;

  /** 鍏宠仈鐨勮闃呭疄浣?*/
  @ManyToOne(() => Subscription, { nullable: true })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: Subscription | null;

  /** 鏀粯鎴愬姛鏃堕棿 */
  @Column({ type: 'datetime', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  /** 閫€娆炬椂闂?*/
  @Column({ type: 'datetime', name: 'refunded_at', nullable: true })
  refundedAt!: Date | null;

  /** 鎵╁睍鍏冩暟鎹紙JSON锛夛紝濡傛敮浠樻笭閬撹繑鍥炵殑鍘熷淇℃伅 */
  @Column({ type: 'simple-json', default: () => "'{}'" })
  metadata!: Record<string, any>;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;

  /** 鏇存柊鏃堕棿 */
  @UpdateDateColumn({ name: 'updated_at',  })
  updatedAt!: Date;
}
