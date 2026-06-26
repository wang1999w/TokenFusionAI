import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * 用户控制器
 * 提供用户资料查询与修改接口
 */
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前用户资料
   * GET /api/v1/user/profile
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.userService.findById(user.sub);
    if (!profile) {
      return { message: '用户不存在' };
    }
    return {
      id: profile.id,
      uuid: profile.uuid,
      email: profile.email,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
      role: profile.role,
      emailVerified: profile.emailVerified,
      inviteCode: profile.inviteCode,
      createdAt: profile.createdAt,
    };
  }

  /**
   * 更新用户资料
   * PUT /api/v1/user/profile
   */
  @Put('profile')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    await this.userService.updateProfile(user.sub, dto);
    return { message: '资料更新成功' };
  }
}
