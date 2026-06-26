import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCodes } from '../constants/error-codes';

/**
 * JWT 鉴权守卫
 * 校验请求头中的 Authorization: Bearer <token>
 * 未通过则抛出 401 未授权异常
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * 重写handleRequest，统一错误返回格式
   */
  handleRequest(err: unknown, user: unknown, info: unknown) {
    if (err || !user) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHORIZED,
        message: '请先登录',
      });
    }
    return user as Express.User;
  }

  /**
   * canActivate - 默认使用 Passport JWT 策略
   */
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
