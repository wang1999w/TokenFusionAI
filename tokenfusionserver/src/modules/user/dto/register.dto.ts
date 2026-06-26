import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 注册请求 DTO
 */
export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d\W]+$/, {
    message: '密码必须包含字母和数字',
  })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  inviteCode?: string;
}
