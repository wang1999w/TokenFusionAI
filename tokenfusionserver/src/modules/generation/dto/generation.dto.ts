import {
  IsInt,
  IsString,
  IsBoolean,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
  MinLength,
  IsObject,
} from 'class-validator';
import {
  GenerationType,
  GenerationStatus,
} from '../generation.entity';

/**
 * 内部创建生成历史请求 DTO
 * 用于 POST /history/internal/create 接口（网关调用）
 *
 * 网关在发起一次生成调用时（或完成后）写入历史记录，
 * 字段与 generation_history 实体对应。
 *
 * 注：属性使用 `!`（确定性赋值断言），表示字段由请求体反序列化后填充，
 * 无需在构造时初始化（满足 strictPropertyInitialization 检查）。
 */
export class CreateGenerationDto {
  /** 用户 ID（匿名 / 设备用户调用时可不传） */
  @IsOptional()
  @IsInt()
  @Min(1, { message: '用户 ID 必须为正整数' })
  userId?: number;

  /** 设备标识（匿名用户归属） */
  @IsString()
  @MinLength(1, { message: '设备标识不能为空' })
  @MaxLength(128, { message: '设备标识长度不能超过 128' })
  deviceId!: string;

  /** 生成类型：chat / image / video / code */
  @IsString()
  @IsIn(Object.values(GenerationType), { message: '生成类型不合法' })
  type!: GenerationType;

  /** 服务提供方（如 openai / stability / runway） */
  @IsString()
  @MinLength(1, { message: '服务提供方不能为空' })
  @MaxLength(32, { message: '服务提供方长度不能超过 32' })
  provider!: string;

  /** 模型标识 */
  @IsString()
  @MinLength(1, { message: '模型不能为空' })
  @MaxLength(64, { message: '模型长度不能超过 64' })
  model!: string;

  /** 提示词 */
  @IsString()
  @MinLength(1, { message: '提示词不能为空' })
  prompt!: string;

  /** 反向提示词（图像 / 视频生成用，可空） */
  @IsOptional()
  @IsString()
  negativePrompt?: string;

  /** 生成参数（JSON） */
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  /** 生成结果（JSON） */
  @IsOptional()
  @IsObject()
  result?: Record<string, any>;

  /** 消耗 Token 数量 */
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Token 消耗不能为负' })
  tokenCost?: number;

  /** 执行耗时（毫秒） */
  @IsOptional()
  @IsInt()
  @Min(0, { message: '耗时不能为负' })
  durationMs?: number;

  /** 状态 */
  @IsString()
  @IsIn(Object.values(GenerationStatus), { message: '生成状态不合法' })
  status!: GenerationStatus;

  /** 失败原因 */
  @IsOptional()
  @IsString()
  errorMsg?: string;

  /** 是否公开 */
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /** 邀请码 */
  @IsOptional()
  @IsString()
  @MaxLength(16, { message: '邀请码长度不能超过 16' })
  inviteCode?: string;
}
