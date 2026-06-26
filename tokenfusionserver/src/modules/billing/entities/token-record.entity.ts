import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Token 娴佹按绫诲瀷鏋氫妇
 * 姣忕绫诲瀷瀵瑰簲涓€娆¤处鎴疯祫閲戝彉鍔ㄦ柟鍚戯細
 * - recharge   鍏呭€硷紙balance 澧炲姞锛? * - consume    娑堣€楃粨绠楋紙frozen 鍑忓皯锛宼otalConsumed 澧炲姞锛宐alance 涓嶅彉锛? * - freeze     棰勬墸鍐荤粨锛坆alance 鍑忓皯锛宖rozen 澧炲姞锛? * - unfreeze   鍐荤粨閲婃斁锛坒rozen 鍑忓皯锛宐alance 澧炲姞锛? * - rollback   澶辫触鍥炶ˉ锛坒rozen 鍑忓皯锛宐alance 澧炲姞锛? * - gift       璧犻锛坆alance 澧炲姞锛宼otalGifted 澧炲姞锛? * - expire     杩囨湡澶辨晥锛堜綑棰?鍐荤粨鎵ｅ噺锛? * - refund     閫€娆撅紙balance 澧炲姞锛? */
export enum TokenRecordType {
  RECHARGE = 'recharge',
  CONSUME = 'consume',
  FREEZE = 'freeze',
  UNFREEZE = 'unfreeze',
  ROLLBACK = 'rollback',
  GIFT = 'gift',
  EXPIRE = 'expire',
  REFUND = 'refund',
}

/**
 * 涓氬姟绫诲瀷鏋氫妇
 * 鏍囪瘑 Token 娑堣€楁潵婧愪簬鍝竴绫讳笟鍔★紝渚夸簬鎸変笟鍔＄淮搴﹀璐︿笌缁熻
 */
export enum BizType {
  CHAT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  CODE = 'code',
  API = 'api',
}

/**
 * Token 娴佹按瀹炰綋
 * 璁板綍姣忎竴娆?Token 鍙樺姩鐨勬槑缁嗚处鐩紝灞炰簬涓嶅彲鍙樿处鏈紙鍙涓嶆敼锛? *
 * 瀛楁绾﹀畾锛? * - amount 姝ｆ暟琛ㄧず璧勯噾娴佸叆锛岃礋鏁拌〃绀鸿祫閲戞祦鍑猴紙姝ｈ繘璐熷嚭锛? * - balance_after 涓烘湰娆″彉鍔ㄥ悗鐨勮处鎴峰彲鐢ㄤ綑棰濆揩鐓э紝渚夸簬鏍稿涓庡璁? * - idempotency_key 鍏ㄥ眬鍞竴锛岀敤浜庢帴鍙ｅ箓绛夐槻閲嶏紝閬垮厤鍚屼竴绗旀搷浣滆閲嶅鎵ц
 *
 * 绱㈠紩璇存槑锛堝疄闄呯储寮曠敱杩佺Щ鏂囦欢鍒涘缓锛屾澶勮楗板櫒浠呬綔鍏冩暟鎹０鏄庯級锛? * 1) (user_id, created_at) 鈥斺€?鏀寔鐢ㄦ埛娴佹按鍒嗛〉鏌ヨ锛堟寜鏃堕棿鍊掑簭锛? * 2) (biz_type, biz_id)     鈥斺€?鏀寔鎸変笟鍔＄淮搴﹀璐? * 3) idempotency_key        鈥斺€?鍒楃骇 UNIQUE锛岃嚜鍔ㄧ敓鎴愬敮涓€绱㈠紩鐢ㄤ簬闃查噸
 *
 * 娉細灞炴€т娇鐢?`!`锛堢‘瀹氭€ц祴鍊兼柇瑷€锛夛紝琛ㄧず杩欎簺瀛楁鐢?TypeORM 鍦ㄦ煡璇㈡椂鑷姩濉厖锛? * 鏃犻渶鍦ㄦ瀯閫犳椂鍒濆鍖栵紙婊¤冻 strictPropertyInitialization 妫€鏌ワ級銆? */
@Entity('token_records')
@Index('idx_token_records_user_created', ['userId', 'createdAt'])
@Index('idx_token_records_biz', ['bizType', 'bizId'])
export class TokenRecord {
  /** 娴佹按鑷涓婚敭 */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 鎵€灞炵敤鎴?ID */
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** 鍏宠仈鐨?Token 璐︽埛 ID锛坱oken_accounts.id锛?*/
  @Column({ name: 'account_id', type: 'integer' })
  accountId!: number;

  /** 鍙樺姩閲戦锛氭杩涜礋鍑猴紙鍏呭€?璧犻/鍥炶ˉ涓烘锛屽喕缁?娑堣€椾负璐燂級 */
  @Column({ type: 'integer' })
  amount!: number;

  /** 娴佹按绫诲瀷 */
  @Column({ type: 'varchar', length: 32 })
  type!: TokenRecordType;

  /** 涓氬姟绫诲瀷锛坈hat/image/video/code/api锛夛紱鍏呭€?璧犻绛夋棤涓氬姟涓婁笅鏂囨椂涓?NULL */
  @Column({ name: 'biz_type', type: 'varchar', length: 32, nullable: true })
  bizType!: BizType | null;

  /** 涓氬姟 ID锛堝璁㈠崟鍙枫€佸璇?ID 绛夛級锛岀敤浜庝笟鍔″璐?*/
  @Column({ name: 'biz_id', type: 'varchar', length: 64, nullable: true })
  bizId!: string | null;

  /** 鏈鍙樺姩鍚庣殑璐︽埛鍙敤浣欓蹇収 */
  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter!: number;

  /** 骞傜瓑閿細鍏ㄥ眬鍞竴锛岄槻姝㈠悓涓€绗旀搷浣滈噸澶嶆墽琛?*/
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, unique: true })
  idempotencyKey!: string;

  /** 澶囨敞锛堝璁㈠崟鍙枫€佽禒棰濆満鏅瓑璇存槑淇℃伅锛?*/
  @Column({ type: 'text', nullable: true })
  remark!: string | null;

  /** 鍒涘缓鏃堕棿锛堟祦姘村彧澧炰笉鏀癸紝浠呭惈 created_at锛?*/
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
