import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * API 瀵嗛挜鐘舵€佹灇涓? * - ENABLED  = 1 鍚敤锛堢綉鍏虫牎楠岄€氳繃鍚庡彲姝ｅ父璋冪敤锛? * - DISABLED = 0 绂佺敤锛堝瘑閽ュけ鏁堬紝缃戝叧鎷掔粷璇锋眰锛? */
export enum ApiKeyStatus {
  ENABLED = 1,
  DISABLED = 0,
}

/**
 * API 瀵嗛挜瀹炰綋
 *
 * 鐢ㄤ簬寮€鏀剧粰寮€鍙戣€呴€氳繃 API Key 璋冪敤骞冲彴鑳藉姏锛坈hat / image / video / code锛夈€? * 瀵嗛挜鏄庢枃浠呭湪鍒涘缓鏃惰繑鍥炰竴娆★紝鏁版嵁搴撲粎瀛樺偍锛? * 1) key_prefix锛氬瘑閽ュ墠缂€锛堝 sk-tf-xxxxxxxx锛夛紝鐢ㄤ簬鍒楄〃灞曠ず涓庤瘑鍒紝涓嶅彲閫嗘帹鍑哄畬鏁村瘑閽ワ紱
 * 2) key_hash  锛氬畬鏁村瘑閽ョ殑 SHA256 鍝堝笇锛岀敤浜庢牎楠屾椂姣斿锛屼笉鍙€嗐€? *
 * 閰嶉璇存槑锛? * - quota_total锛氬瘑閽ュ彲鐢?Token 鎬婚厤棰濅笂闄愶紝涓?NULL 琛ㄧず涓嶉檺棰濓紱
 * - quota_used 锛氬凡浣跨敤 Token 鏁伴噺锛屾瘡娆¤皟鐢ㄧ粨绠楀悗绱姞銆? *
 * 绱㈠紩锛歶ser_id锛堟敮鎸佹寜鐢ㄦ埛鏌ヨ鍏跺瘑閽ュ垪琛級
 *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('api_keys')
export class ApiKey {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 鎵€灞炵敤鎴?ID */
  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** 瀵嗛挜鍚嶇О锛堢敤鎴疯嚜瀹氫箟锛屼究浜庡尯鍒嗙敤閫旓級 */
  @Column({ type: 'varchar', length: 64 })
  name!: string;

  /** 瀵嗛挜鍓嶇紑锛堟槑鏂囧睍绀虹敤锛屽 sk-tf-xxxxxxxx锛夛紝浠呬繚鐣欏瘑閽ュ墠 14 浣?*/
  @Column({ name: 'key_prefix', type: 'varchar', length: 16 })
  keyPrefix!: string;

  /** 瀹屾暣瀵嗛挜鐨?SHA256 鍝堝笇锛堜笉鍙€嗭級锛岄粯璁や笉鏌ヨ杩斿洖锛坰elect: false锛?*/
  @Column({ name: 'key_hash', type: 'varchar', length: 255, select: false })
  keyHash!: string;

  /** 鐘舵€侊細1 鍚敤 / 0 绂佺敤 */
  @Column({ type: 'smallint', default: ApiKeyStatus.ENABLED })
  status!: ApiKeyStatus;

  /** Token 鎬婚厤棰濅笂闄愶紝涓?NULL 琛ㄧず涓嶉檺棰?*/
  @Column({ name: 'quota_total', type: 'integer', nullable: true })
  quotaTotal!: number | null;

  /** 宸蹭娇鐢?Token 鏁伴噺 */
  @Column({ name: 'quota_used', type: 'integer', default: 0 })
  quotaUsed!: number;

  /** 鏈€杩戜竴娆′娇鐢ㄦ椂闂达紙缃戝叧鏍￠獙鎴栫粨绠楁椂鏇存柊锛?*/
  @Column({ type: 'datetime', name: 'last_used_at', nullable: true })
  lastUsedAt!: Date | null;

  /** 杩囨湡鏃堕棿锛屼负 NULL 琛ㄧず姘镐笉杩囨湡 */
  @Column({ type: 'datetime', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
