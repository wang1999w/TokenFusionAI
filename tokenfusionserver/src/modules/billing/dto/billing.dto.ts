import {
  IsInt,
  IsString,
  IsIn,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BizType } from '../entities/token-record.entity';

/**
 * 内部预扣冻结请求 DTO
 * 由业务网关在发起一次 Token 消耗请求前调用，预先冻结对应额度
 *
 * 注：属性使用 `!`（确定性赋值断言），表示字段由请求体反序列化后填充，
 * 无需在构造时初始化（满足 strictPropertyInitialization 检查）。
 */
export class FreezeDto {
  /** 用户 ID */
  @IsInt()
  @Min(1, { message: '用户 ID 必须为正整数' })
  userId!: number;

  /** 预扣冻结金额（正整数） */
  @IsInt()
  @Min(1, { message: '冻结金额必须大于 0' })
  amount!: number;

  /** 业务类型 */
  @IsString()
  @IsIn(Object.values(BizType), { message: '业务类型不合法' })
  bizType!: BizType;

  /** 业务 ID（如对话 ID、任务 ID 等） */
  @IsString()
  @MinLength(1, { message: '业务 ID 不能为空' })
  @MaxLength(64, { message: '业务 ID 长度不能超过 64' })
  bizId!: string;

  /** 幂等键：同一笔操作重复调用只生效一次 */
  @IsString()
  @MinLength(1, { message: '幂等键不能为空' })
  @MaxLength(64, { message: '幂等键长度不能超过 64' })
  idempotencyKey!: string;
}

/**
 * 内部结算确认请求 DTO
 * 业务完成后，按实际消耗量结算此前冻结的额度
 */
export class SettleDto {
  /** 用户 ID */
  @IsInt()
  @Min(1, { message: '用户 ID 必须为正整数' })
  userId!: number;

  /** 实际消耗金额（正整数，应小于等于已冻结额度） */
  @IsInt()
  @Min(1, { message: '实际消耗金额必须大于 0' })
  actualAmount!: number;

  /** 业务类型 */
  @IsString()
  @IsIn(Object.values(BizType), { message: '业务类型不合法' })
  bizType!: BizType;

  /** 业务 ID（需与预扣冻结时一致） */
  @IsString()
  @MinLength(1, { message: '业务 ID 不能为空' })
  @MaxLength(64, { message: '业务 ID 长度不能超过 64' })
  bizId!: string;

  /** 幂等键：同一笔结算重复调用只生效一次 */
  @IsString()
  @MinLength(1, { message: '幂等键不能为空' })
  @MaxLength(64, { message: '幂等键长度不能超过 64' })
  idempotencyKey!: string;
}

/**
 * 内部失败回补请求 DTO
 * 业务失败或结算后需将剩余冻结额度退回可用余额时调用
 */
export class RollbackDto {
  /** 用户 ID */
  @IsInt()
  @Min(1, { message: '用户 ID 必须为正整数' })
  userId!: number;

  /** 回补金额（正整数，应小于等于已冻结额度） */
  @IsInt()
  @Min(1, { message: '回补金额必须大于 0' })
  amount!: number;

  /** 业务类型 */
  @IsString()
  @IsIn(Object.values(BizType), { message: '业务类型不合法' })
  bizType!: BizType;

  /** 业务 ID（需与预扣冻结时一致） */
  @IsString()
  @MinLength(1, { message: '业务 ID 不能为空' })
  @MaxLength(64, { message: '业务 ID 长度不能超过 64' })
  bizId!: string;

  /** 幂等键：同一笔回补重复调用只生效一次 */
  @IsString()
  @MinLength(1, { message: '幂等键不能为空' })
  @MaxLength(64, { message: '幂等键长度不能超过 64' })
  idempotencyKey!: string;
}
