import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 生成类型枚举
 * - chat   对话生成
 * - image  图像生成
 * - video  视频生成
 * - code   代码生成
 */
export enum GenerationType {
  CHAT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  CODE = 'code',
}

/**
 * 生成状态枚举
 * - pending  待处理（已创建任务，尚未开始执行）
 * - running  执行中
 * - success  成功
 * - failed   失败
 */
export enum GenerationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * 生成历史实体
 *
 * 记录每一次 AI 生成调用的完整上下文与结果，供：
 * 1) 用户在「历史记录」页查看自己的生成历史；
 * 2) 平台统计各功能（chat/image/video/code）调用量与 Token 消耗；
 * 3) 邀请场景下按 invite_code 归属匿名 / 未登录用户。
 *
 * 字段说明：
 * - user_id      可空，匿名 / 设备用户调用时为 NULL；
 * - device_id    设备标识，用于匿名用户的记录归属；
 * - params       生成参数（如 temperature、size、steps 等），JSON；
 * - result       生成结果（如文本内容、图片 URL、视频 URL 等），JSON；
 * - token_cost   本次消耗 Token 数量；
 * - duration_ms  执行耗时（毫秒）；
 * - is_public    是否公开（公开内容可在广场 / 社区展示）；
 * - invite_code  邀请码，用于邀请关系下匿名记录的归属与奖励统计。
 *
 * 索引：
 * 1) (user_id, created_at) —— 用户历史分页（按时间倒序）
 * 2) (device_id, created_at) —— 设备历史分页
 * 3) (type, created_at) —— 按类型统计与检索
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('generation_history')
@Index('idx_generation_user_created', ['userId', 'createdAt'])
@Index('idx_generation_device_created', ['deviceId', 'createdAt'])
@Index('idx_generation_type_created', ['type', 'createdAt'])
export class GenerationHistory {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 用户 ID（匿名 / 设备用户调用时为 NULL） */
  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId!: number | null;

  /** 设备标识（匿名用户归属） */
  @Column({ name: 'device_id', type: 'varchar', length: 128 })
  deviceId!: string;

  /** 生成类型：chat / image / video / code */
  @Column({ type: 'varchar', length: 16 })
  type!: GenerationType;

  /** 服务提供方（如 openai / stability / runway 等） */
  @Column({ type: 'varchar', length: 32 })
  provider!: string;

  /** 模型标识（如 gpt-4o / sd-xl 等） */
  @Column({ type: 'varchar', length: 64 })
  model!: string;

  /** 用户输入的提示词 */
  @Column({ type: 'text' })
  prompt!: string;

  /** 反向提示词（图像 / 视频生成用，可空） */
  @Column({ name: 'negative_prompt', type: 'text', nullable: true })
  negativePrompt!: string | null;

  /** 生成参数（JSON，如 temperature / size / steps） */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  params!: Record<string, any>;

  /** 生成结果（JSON，如文本 / 图片 URL / 视频 URL） */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  result!: Record<string, any>;

  /** 本次消耗 Token 数量 */
  @Column({ name: 'token_cost', type: 'bigint', default: 0 })
  tokenCost!: number;

  /** 执行耗时（毫秒） */
  @Column({ name: 'duration_ms', type: 'integer', default: 0 })
  durationMs!: number;

  /** 状态：pending / running / success / failed */
  @Column({ type: 'varchar', length: 16, default: GenerationStatus.PENDING })
  status!: GenerationStatus;

  /** 失败原因（status=failed 时填充） */
  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg!: string | null;

  /** 是否公开（公开内容可在广场展示） */
  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  /** 邀请码（用于邀请关系下匿名记录的归属与奖励统计） */
  @Column({ name: 'invite_code', type: 'varchar', length: 16, nullable: true })
  inviteCode!: string | null;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
