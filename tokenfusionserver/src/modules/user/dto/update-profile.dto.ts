import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * 更新用户资料 DTO
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;
}
