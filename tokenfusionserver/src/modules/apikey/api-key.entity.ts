import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * API 密钥状态枚举
 * - ENABLED  = 1 启用（网关校验通过后可正常调用）
 * - DISABLED = 0 禁用（密钥失效，网关拒绝请求）
 */
export enum ApiKeyStatus {
  ENABLED = 1,
  DISABLED = 0,
}

/**
 * API 密钥实体
 *
 * 用于开放给开发者通过 API Key 调用平台能力（chat / image / video / code）。
 * 密钥明文仅在创建时返回一次，数据库仅存储：
 * 1) key_prefix：密钥前缀（如 sk-tf-xxxxxxxx），用于列表展示与识别，不可逆推出完整密钥；
 * 2) key_hash  ：完整密钥的 SHA256 哈希，用于校验时比对，不可逆。
 *
 * 配额说明：
 * - quota_total：密钥可用 Token 总配额上限，为 NULL 表示不限额；
 * - quota_used ：已使用 Token 数量，每次调用结算后累加。
 *
 * 索引：user_id（支持按用户查询其密钥列表）
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('api_keys')
export class ApiKey {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 所属用户 ID */
  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /** 密钥名称（用户自定义，便于区分用途） */
  @Column({ type: 'varchar', length: 64 })
  name!: string;

  /** 密钥前缀（明文展示用，如 sk-tf-xxxxxxxx），仅保留密钥前 14 位 */
  @Column({ name: 'key_prefix', type: 'varchar', length: 16 })
  keyPrefix!: string;

  /** 完整密钥的 SHA256 哈希（不可逆），默认不查询返回（select: false） */
  @Column({ name: 'key_hash', type: 'varchar', length: 255, select: false })
  keyHash!: string;

  /** 状态：1 启用 / 0 禁用 */
  @Column({ type: 'smallint', default: ApiKeyStatus.ENABLED })
  status!: ApiKeyStatus;

  /** Token 总配额上限，为 NULL 表示不限额 */
  @Column({ name: 'quota_total', type: 'bigint', nullable: true })
  quotaTotal!: number | null;

  /** 已使用 Token 数量 */
  @Column({ name: 'quota_used', type: 'bigint', default: 0 })
  quotaUsed!: number;

  /** 最近一次使用时间（网关校验或结算时更新） */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  /** 过期时间，为 NULL 表示永不过期 */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
