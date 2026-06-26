import {
  IsInt,
  IsString,
  IsIn,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiKeyStatus } from '../api-key.entity';

/**
 * 创建 API 密钥请求 DTO
 * 用于 POST /apikeys 接口
 *
 * 注：属性使用 `!`（确定性赋值断言），表示字段由请求体反序列化后填充，
 * 无需在构造时初始化（满足 strictPropertyInitialization 检查）。
 */
export class CreateApiKeyDto {
  /** 密钥名称（便于用户区分不同用途） */
  @IsString()
  @MinLength(1, { message: '密钥名称不能为空' })
  @MaxLength(64, { message: '密钥名称长度不能超过 64' })
  name!: string;
}

/**
 * 启用/禁用 API 密钥请求 DTO
 * 用于 PATCH /apikeys/:id 接口
 */
export class ToggleApiKeyDto {
  /** 目标状态：1 启用 / 0 禁用 */
  @IsInt()
  @IsIn([ApiKeyStatus.ENABLED, ApiKeyStatus.DISABLED], {
    message: '状态值仅支持 1（启用）或 0（禁用）',
  })
  status!: ApiKeyStatus;
}

/**
 * 内部校验 API 密钥请求 DTO
 * 用于 POST /apikeys/internal/validate 接口（网关调用）
 */
export class ValidateApiKeyDto {
  /** 待校验的完整密钥明文（sk-tf- 开头） */
  @IsString()
  @MinLength(1, { message: '密钥不能为空' })
  @MaxLength(128, { message: '密钥长度非法' })
  key!: string;
}

/**
 * 内部更新用量请求 DTO
 * 用于网关在调用结算后回写密钥用量
 */
export class UpdateApiKeyUsageDto {
  /** 密钥 ID */
  @IsInt()
  @Min(1, { message: '密钥 ID 必须为正整数' })
  keyId!: number;

  /** 本次消耗的 Token 数量（正整数） */
  @IsInt()
  @Min(0, { message: '消耗数量不能为负' })
  usedTokens!: number;
}
