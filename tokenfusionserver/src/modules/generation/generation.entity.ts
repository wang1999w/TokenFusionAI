import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 鐢熸垚绫诲瀷鏋氫妇
 * - chat   瀵硅瘽鐢熸垚
 * - image  鍥惧儚鐢熸垚
 * - video  瑙嗛鐢熸垚
 * - code   浠ｇ爜鐢熸垚
 */
export enum GenerationType {
  CHAT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  CODE = 'code',
}

/**
 * 鐢熸垚鐘舵€佹灇涓? * - pending  寰呭鐞嗭紙宸插垱寤轰换鍔★紝灏氭湭寮€濮嬫墽琛岋級
 * - running  鎵ц涓? * - success  鎴愬姛
 * - failed   澶辫触
 */
export enum GenerationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * 鐢熸垚鍘嗗彶瀹炰綋
 *
 * 璁板綍姣忎竴娆?AI 鐢熸垚璋冪敤鐨勫畬鏁翠笂涓嬫枃涓庣粨鏋滐紝渚涳細
 * 1) 鐢ㄦ埛鍦ㄣ€屽巻鍙茶褰曘€嶉〉鏌ョ湅鑷繁鐨勭敓鎴愬巻鍙诧紱
 * 2) 骞冲彴缁熻鍚勫姛鑳斤紙chat/image/video/code锛夎皟鐢ㄩ噺涓?Token 娑堣€楋紱
 * 3) 閭€璇峰満鏅笅鎸?invite_code 褰掑睘鍖垮悕 / 鏈櫥褰曠敤鎴枫€? *
 * 瀛楁璇存槑锛? * - user_id      鍙┖锛屽尶鍚?/ 璁惧鐢ㄦ埛璋冪敤鏃朵负 NULL锛? * - device_id    璁惧鏍囪瘑锛岀敤浜庡尶鍚嶇敤鎴风殑璁板綍褰掑睘锛? * - params       鐢熸垚鍙傛暟锛堝 temperature銆乻ize銆乻teps 绛夛級锛孞SON锛? * - result       鐢熸垚缁撴灉锛堝鏂囨湰鍐呭銆佸浘鐗?URL銆佽棰?URL 绛夛級锛孞SON锛? * - token_cost   鏈娑堣€?Token 鏁伴噺锛? * - duration_ms  鎵ц鑰楁椂锛堟绉掞級锛? * - is_public    鏄惁鍏紑锛堝叕寮€鍐呭鍙湪骞垮満 / 绀惧尯灞曠ず锛夛紱
 * - invite_code  閭€璇风爜锛岀敤浜庨個璇峰叧绯讳笅鍖垮悕璁板綍鐨勫綊灞炰笌濂栧姳缁熻銆? *
 * 绱㈠紩锛? * 1) (user_id, created_at) 鈥斺€?鐢ㄦ埛鍘嗗彶鍒嗛〉锛堟寜鏃堕棿鍊掑簭锛? * 2) (device_id, created_at) 鈥斺€?璁惧鍘嗗彶鍒嗛〉
 * 3) (type, created_at) 鈥斺€?鎸夌被鍨嬬粺璁′笌妫€绱? *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('generation_history')
@Index('idx_generation_user_created', ['userId', 'createdAt'])
@Index('idx_generation_device_created', ['deviceId', 'createdAt'])
@Index('idx_generation_type_created', ['type', 'createdAt'])
export class GenerationHistory {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 鐢ㄦ埛 ID锛堝尶鍚?/ 璁惧鐢ㄦ埛璋冪敤鏃朵负 NULL锛?*/
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null;

  /** 璁惧鏍囪瘑锛堝尶鍚嶇敤鎴峰綊灞烇級 */
  @Column({ name: 'device_id', type: 'varchar', length: 128 })
  deviceId!: string;

  /** 鐢熸垚绫诲瀷锛歝hat / image / video / code */
  @Column({ type: 'varchar', length: 16 })
  type!: GenerationType;

  /** 鏈嶅姟鎻愪緵鏂癸紙濡?openai / stability / runway 绛夛級 */
  @Column({ type: 'varchar', length: 32 })
  provider!: string;

  /** 妯″瀷鏍囪瘑锛堝 gpt-4o / sd-xl 绛夛級 */
  @Column({ type: 'varchar', length: 64 })
  model!: string;

  /** 鐢ㄦ埛杈撳叆鐨勬彁绀鸿瘝 */
  @Column({ type: 'text' })
  prompt!: string;

  /** 鍙嶅悜鎻愮ず璇嶏紙鍥惧儚 / 瑙嗛鐢熸垚鐢紝鍙┖锛?*/
  @Column({ name: 'negative_prompt', type: 'text', nullable: true })
  negativePrompt!: string | null;

  /** 鐢熸垚鍙傛暟锛圝SON锛屽 temperature / size / steps锛?*/
  @Column({ type: 'simple-json', default: () => "'{}'" })
  params!: Record<string, any>;

  /** 鐢熸垚缁撴灉锛圝SON锛屽鏂囨湰 / 鍥剧墖 URL / 瑙嗛 URL锛?*/
  @Column({ type: 'simple-json', default: () => "'{}'" })
  result!: Record<string, any>;

  /** 鏈娑堣€?Token 鏁伴噺 */
  @Column({ name: 'token_cost', type: 'integer', default: 0 })
  tokenCost!: number;

  /** 鎵ц鑰楁椂锛堟绉掞級 */
  @Column({ name: 'duration_ms', type: 'integer', default: 0 })
  durationMs!: number;

  /** 鐘舵€侊細pending / running / success / failed */
  @Column({ type: 'varchar', length: 16, default: GenerationStatus.PENDING })
  status!: GenerationStatus;

  /** 澶辫触鍘熷洜锛坰tatus=failed 鏃跺～鍏咃級 */
  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg!: string | null;

  /** 鏄惁鍏紑锛堝叕寮€鍐呭鍙湪骞垮満灞曠ず锛?*/
  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  /** 閭€璇风爜锛堢敤浜庨個璇峰叧绯讳笅鍖垮悕璁板綍鐨勫綊灞炰笌濂栧姳缁熻锛?*/
  @Column({ name: 'invite_code', type: 'varchar', length: 16, nullable: true })
  inviteCode!: string | null;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
