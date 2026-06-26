import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateUserAdminDto } from './dto/admin.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UserRole, UserStatus } from '../user/user.entity';

/**
 * 管理后台控制器（Phase 7）
 *
 * 全部接口需管理员角色（@Roles(ADMIN)），JWT 鉴权由全局 GlobalJwtAuthGuard 完成，
 * 角色校验由 RoleGuard 完成（在类级别声明）。
 *
 * 路由分布（全局前缀 /api/v1）：
 * - GET   /admin/users        用户管理（分页，可搜索）
 * - PATCH /admin/users/:id    封禁/调额
 * - GET   /admin/orders       订单管理（分页）
 * - GET   /admin/dashboard    数据看板
 */
@Controller('admin')
@UseGuards(RoleGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * 用户管理（仅管理员）
   * GET /api/v1/admin/users?page=1&limit=20&search=keyword
   */
  @Get('users')
  @Roles(UserRole.ADMIN)
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  /**
   * 封禁 / 调额（仅管理员）
   * PATCH /api/v1/admin/users/:id
   * - 传入 status 时：封禁（0）/ 启用（1）
   * - 传入 tokenAmount 时：调整 Token 额度（正增负减）
   */
  @Patch('users/:id')
  @Roles(UserRole.ADMIN)
  async updateUser(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserAdminDto,
  ) {
    const result: {
      ban?: { id: number; status: UserStatus };
      tokens?: {
        userId: number;
        balanceBefore: number;
        balanceAfter: number;
        delta: number;
      };
    } = {};

    // 封禁 / 启用
    if (dto.status !== undefined) {
      result.ban = await this.adminService.banUser(id, dto.status, admin.sub);
    }

    // 调整 Token 额度
    if (dto.tokenAmount !== undefined) {
      result.tokens = await this.adminService.adjustTokens(
        id,
        dto.tokenAmount,
        admin.sub,
      );
    }

    return result;
  }

  /**
   * 订单管理（仅管理员）
   * GET /api/v1/admin/orders?page=1&limit=20
   */
  @Get('orders')
  @Roles(UserRole.ADMIN)
  async getOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getOrders(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * 数据看板（仅管理员）
   * GET /api/v1/admin/dashboard
   */
  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  async getDashboard() {
    return this.adminService.getDashboard();
  }
}
