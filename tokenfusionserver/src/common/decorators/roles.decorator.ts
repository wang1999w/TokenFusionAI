import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/user/user.entity';

/**
 * @Roles() 装饰器
 * 标记接口所需的角色，配合 RoleGuard 使用
 * 用法：@Roles(UserRole.ADMIN)
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
