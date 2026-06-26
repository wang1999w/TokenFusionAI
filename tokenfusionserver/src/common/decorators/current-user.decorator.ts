import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser() 装饰器
 * 从请求中提取当前登录用户信息
 * 用法：getProfile(@CurrentUser() user: JwtPayload)
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // 支持 @CurrentUser('id') 提取单个字段
    return data ? user?.[data] : user;
  },
);
