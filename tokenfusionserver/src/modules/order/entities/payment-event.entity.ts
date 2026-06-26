import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 鏀粯娓犻亾鏋氫妇锛堢敤浜庢敮浠樹簨浠惰褰曪級
 */
export enum PaymentEventChannel {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

/**
 * 鏀粯浜嬩欢瀹炰綋锛堝箓绛夊幓閲嶈〃锛? * 鐢ㄤ簬璁板綍绗笁鏂规敮浠樺钩鍙版帹閫佺殑姣忎竴涓?Webhook 浜嬩欢
 * 閫氳繃 event_id 鍞竴绾︽潫淇濊瘉鍚屼竴浜嬩欢涓嶄細琚噸澶嶅鐞? *
 * 骞傜瓑澶勭悊娴佺▼锛? * 1. 鏀跺埌 Webhook 鍚庯紝浠?(channel, event_id) 鏌ヨ鏄惁宸插瓨鍦? * 2. 鑻ュ凡瀛樺湪涓?processed=true锛岀洿鎺ヨ繑鍥烇紙璺宠繃澶勭悊锛? * 3. 鑻ヤ笉瀛樺湪锛屽厛鎻掑叆涓€鏉¤褰曪紙鍗犱綅锛夛紝澶勭悊瀹屾垚鍚庣疆 processed=true
 *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('payment_events')
export class PaymentEvent {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 鏀粯娓犻亾锛歴tripe / paypal */
  @Index()
  @Column({ type: 'varchar', length: 16 })
  channel!: PaymentEventChannel;

  /** 绗笁鏂逛簨浠跺敮涓€ ID锛圫tripe event id / PayPal event id锛夛紝鐢ㄤ簬骞傜瓑鍘婚噸 */
  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'varchar', length: 128, unique: true })
  eventId!: string;

  /** 浜嬩欢绫诲瀷锛屽 checkout.session.completed / PAYMENT.CAPTURE.COMPLETED */
  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: string;

  /** 鍘熷浜嬩欢杞借嵎锛圝SON锛夛紝渚夸簬杩芥函鎺掓煡 */
  @Column({ type: 'simple-json' })
  payload!: Record<string, any>;

  /** 鏄惁宸插鐞嗗畬鎴愶紙骞傜瓑鏍囪锛?*/
  @Column({ type: 'boolean', default: false })
  processed!: boolean;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
