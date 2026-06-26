import { IsInt, IsOptional, IsIn } from 'class-validator';
import { UserStatus } from '../../user/user.entity';

/**
 * 管理后台更新用户请求 DTO
 * 用于 PATCH /admin/users/:id 接口
 *
 * 该接口同时支持「封禁/解封」与「调整 Token 额度」两类操作：
 * - 传入 status 时，更新用户状态（封禁 / 启用）；
 * - 传入 tokenAmount 时，对用户 Token 余额进行增减（正数增加，负数扣减）。
 * 两个字段均为可选，可同时传入。
 *
 * 注：属性使用 `!`（确定性赋值断言），表示字段由请求体反序列化后填充，
 * 无需在构造时初始化（满足 strictPropertyInitialization 检查）。
 */
export class UpdateUserAdminDto {
  /** 目标状态：1 启用 / 0 封禁（可选） */
  @IsOptional()
  @IsInt()
  @IsIn([UserStatus.ACTIVE, UserStatus.BANNED], {
    message: '状态值仅支持 1（启用）或 0（封禁）',
  })
  status?: UserStatus;

  /** Token 调整额度：正数增加，负数扣减（可选） */
  @IsOptional()
  @IsInt()
  tokenAmount?: number;
}
