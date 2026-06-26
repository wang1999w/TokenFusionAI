import { SetMetadata } from '@nestjs/common';

/**
 * @Public() 装饰器
 * 标记接口为公开访问（无需 JWT 鉴权）
 * 用于登录、注册、健康检查等接口
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
