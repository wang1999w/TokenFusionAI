import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '../constants/error-codes';
import { UserRole } from '../../modules/user/user.entity';

/**
 * 角色权限守卫
 * 配合 @Roles() 装饰器使用，校验当前用户是否有权限访问
 * 用法示例：@Roles(UserRole.ADMIN) → 仅管理员可访问
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 从路由元数据获取所需的角色列表
    const requiredRoles = this.reflector.get<UserRole[]>(
      'roles',
      context.getHandler(),
    );

    // 未设置 @Roles() 装饰器，表示无需特定角色，放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: '无权限访问',
      });
    }

    // 校验用户角色是否在允许列表中
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: '无权限访问',
      });
    }

    return true;
  }
}
