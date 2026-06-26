import { IsEmail, IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 找回密码请求 DTO（发送重置邮件）
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;
}

/**
 * 重置密码请求 DTO（携带重置 token）
 */
export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @IsOptional()
  password: string;
}

/**
 * 邮箱验证请求 DTO
 */
export class VerifyEmailDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  code: string;
}
