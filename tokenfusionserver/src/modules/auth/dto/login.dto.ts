import { IsEmail, IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 登录请求 DTO
 */
export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
