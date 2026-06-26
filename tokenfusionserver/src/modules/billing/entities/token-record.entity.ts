import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Token 流水类型枚举
 * 每种类型对应一次账户资金变动方向：
 * - recharge   充值（balance 增加）
 * - consume    消耗结算（frozen 减少，totalConsumed 增加，balance 不变）
 * - freeze     预扣冻结（balance 减少，frozen 增加）
 * - unfreeze   冻结释放（frozen 减少，balance 增加）
 * - rollback   失败回补（frozen 减少，balance 增加）
 * - gift       赠额（balance 增加，totalGifted 增加）
 * - expire     过期失效（余额/冻结扣减）
 * - refund     退款（balance 增加）
 */
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
 * 业务类型枚举
 * 标识 Token 消耗来源于哪一类业务，便于按业务维度对账与统计
 */
export enum BizType {
  CHAT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  CODE = 'code',
  API = 'api',
}

/**
 * Token 流水实体
 * 记录每一次 Token 变动的明细账目，属于不可变账本（只增不改）
 *
 * 字段约定：
 * - amount 正数表示资金流入，负数表示资金流出（正进负出）
 * - balance_after 为本次变动后的账户可用余额快照，便于核对与审计
 * - idempotency_key 全局唯一，用于接口幂等防重，避免同一笔操作被重复执行
 *
 * 索引说明（实际索引由迁移文件创建，此处装饰器仅作元数据声明）：
 * 1) (user_id, created_at) —— 支持用户流水分页查询（按时间倒序）
 * 2) (biz_type, biz_id)     —— 支持按业务维度对账
 * 3) idempotency_key        —— 列级 UNIQUE，自动生成唯一索引用于防重
 *
 * 注：属性使用 `!`（确定性赋值断言），表示这些字段由 TypeORM 在查询时自动填充，
 * 无需在构造时初始化（满足 strictPropertyInitialization 检查）。
 */
@Entity('token_records')
@Index('idx_token_records_user_created', ['userId', 'createdAt'])
@Index('idx_token_records_biz', ['bizType', 'bizId'])
export class TokenRecord {
  /** 流水自增主键 */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 所属用户 ID */
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /** 关联的 Token 账户 ID（token_accounts.id） */
  @Column({ name: 'account_id', type: 'bigint' })
  accountId!: number;

  /** 变动金额：正进负出（充值/赠额/回补为正，冻结/消耗为负） */
  @Column({ type: 'bigint' })
  amount!: number;

  /** 流水类型 */
  @Column({ type: 'varchar', length: 32 })
  type!: TokenRecordType;

  /** 业务类型（chat/image/video/code/api）；充值/赠额等无业务上下文时为 NULL */
  @Column({ name: 'biz_type', type: 'varchar', length: 32, nullable: true })
  bizType!: BizType | null;

  /** 业务 ID（如订单号、对话 ID 等），用于业务对账 */
  @Column({ name: 'biz_id', type: 'varchar', length: 64, nullable: true })
  bizId!: string | null;

  /** 本次变动后的账户可用余额快照 */
  @Column({ name: 'balance_after', type: 'bigint' })
  balanceAfter!: number;

  /** 幂等键：全局唯一，防止同一笔操作重复执行 */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, unique: true })
  idempotencyKey!: string;

  /** 备注（如订单号、赠额场景等说明信息） */
  @Column({ type: 'text', nullable: true })
  remark!: string | null;

  /** 创建时间（流水只增不改，仅含 created_at） */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
