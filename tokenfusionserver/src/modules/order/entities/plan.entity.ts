import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * 濂楅绫诲瀷鏋氫妇
 * - one_time: 涓€娆℃€т粯璐癸紙鎸夋璐拱 Token锛? * - subscription: 璁㈤槄鍒讹紙鍛ㄦ湡鎬ф墸璐癸級
 */
export enum PlanType {
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription',
}

/**
 * 璁㈤槄鍛ㄦ湡鏋氫妇
 * - month: 鏈堜粯
 * - year: 骞翠粯
 */
export enum PlanInterval {
  MONTH = 'month',
  YEAR = 'year',
}

/**
 * 濂楅閰嶇疆瀹炰綋
 * 瀹氫箟鍙喘涔扮殑 Token 濂楅锛氬厤璐广€佸叆闂ㄣ€佷笓涓氥€佸紑鍙戣€呯瓑
 * 璁板綍浠锋牸銆乀oken 鏁伴噺銆佽璐规柟寮忓強鍔熻兘鐗规€у垪琛? *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('plans')
export class Plan {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 濂楅鍞竴缂栫爜锛坒ree/starter/pro/developer锛夛紝鐢ㄤ簬涓氬姟灞傚紩鐢?*/
  @Column({ type: 'varchar', length: 32, unique: true })
  code!: string;

  /** 濂楅灞曠ず鍚嶇О */
  @Column({ type: 'varchar', length: 64 })
  name!: string;

  /** 浠锋牸锛堝崟浣嶏細鍒嗭級锛岄伩鍏嶆诞鐐圭簿搴﹂棶棰橈紝渚嬪 499 = $4.99 */
  @Column({ name: 'price_cents', type: 'integer' })
  priceCents!: number;

  /** 甯佺锛孖SO 4217 璐у竵浠ｇ爜锛岄粯璁?USD */
  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency!: string;

  /** 璇ュ椁愬寘鍚殑 Token 鏁伴噺锛堝ぇ鏁存暟锛屼娇鐢?bigint锛?*/
  @Column({ name: 'token_amount', type: 'integer' })
  tokenAmount!: number;

  /** 璁¤垂绫诲瀷锛歰ne_time 涓€娆℃€?/ subscription 璁㈤槄 */
  @Column({ type: 'varchar', length: 16 })
  type!: PlanType;

  /** 璁㈤槄鍛ㄦ湡锛歮onth / year锛涗竴娆℃€у椁愪负 null */
  @Column({ type: 'varchar', length: 16, nullable: true })
  interval!: PlanInterval | null;

  /** 鍔熻兘鐗规€у垪琛紙JSON 鏁扮粍锛夛紝濡?["2000 tokens", "閭欢鏀寔"] */
  @Column({ type: 'simple-json', default: () => "'[]'" })
  features!: string[];

  /** 鏄惁鏍囪涓?鎺ㄨ崘"濂楅锛堝墠绔珮浜睍绀猴級 */
  @Column({ name: 'is_popular', type: 'boolean', default: false })
  isPopular!: boolean;

  /** 鎺掑簭鏉冮噸锛屾暟鍊艰秺灏忚秺闈犲墠 */
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  /** 鏄惁鍚敤锛堜笅鏋剁殑濂楅涓嶄細灞曠ず缁欑敤鎴凤級 */
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
