import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ErrorCodes } from '../constants/error-codes';

/**
 * 全局 JWT 守卫
 * 与普通 JwtAuthGuard 不同，此守卫支持 @Public() 装饰器
 * 被 @Public() 标记的接口无需 JWT 鉴权即可访问
 *
 * 使用方式：在 main.ts 中 app.useGlobalGuards(new GlobalJwtAuthGuard(reflector))
 */
@Injectable()
export class GlobalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * canActivate - 检查接口是否标记为 @Public
   * 如果标记为公开则跳过鉴权，否则执行 JWT 校验
   */
  canActivate(context: ExecutionContext) {
    // 检查是否有 @Public() 装饰器
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // 公开接口，跳过鉴权
      return true;
    }

    // 非公开接口，执行 JWT 校验
    return super.canActivate(context);
  }

  /**
   * handleRequest - 统一处理鉴权错误
   */
  handleRequest<TUser = Express.User>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHORIZED,
        message: '请先登录',
      });
    }
    return user as TUser;
  }
}
