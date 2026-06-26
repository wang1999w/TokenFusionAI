import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * JWT 策略
 * Passport JWT 插件使用此策略校验 access_token
 * 从 Bearer token 中提取 payload，查询用户是否存在且状态正常
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      // 从 Authorization: Bearer <token> 中提取 JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 不忽略过期时间
      ignoreExpiration: false,
      // 从环境变量读取 JWT 密钥
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * validate - JWT 校验通过后调用
   * payload 已由 JWT 库解密验签，这里再次校验用户是否有效
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'uuid', 'email', 'role', 'status'],
    });

    // 用户不存在
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHORIZED,
        message: '用户不存在',
      });
    }

    // 用户已被封禁
    if (user.status === 0) {
      throw new UnauthorizedException({
        code: ErrorCodes.ACCOUNT_BANNED,
        message: '账户已被封禁',
      });
    }

    // �新的 payload，确保数据为最新
    return {
      sub: user.id,
      uuid: user.uuid,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
