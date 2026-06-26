import { IsString, IsOptional } from 'class-validator';

/**
 * 刷新令牌请求 DTO
 */
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
