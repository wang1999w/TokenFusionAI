import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { User, UserStatus } from '../user/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { DeviceBind } from './entities/device-bind.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/forgot-password.dto';
import { JwtPayload, AuthResponse } from './interfaces/jwt-payload.interface';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { EmailService } from '../../common/utils/email.util';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * 认证服务
 * 处理登录、登出、Token 刷新、邮箱验证、密码重置等核心认证逻辑
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(DeviceBind)
    private readonly deviceBindRepository: Repository<DeviceBind>,
  ) {}

  /**
   * 用户登录
   * 1. 校验邮箱和密码
   * 2. 校验账户状态
   * 3. 签发 access_token 和 refresh_token
   * 4. 记录设备信息和登录时间
   */
  async login(dto: LoginDto, ip: string, userAgent: string): Promise<AuthResponse> {
    // 查询用户（含密码哈希）
    const user = await this.userService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: '用户不存在',
      });
    }

    // 校验密码
    const isPasswordValid = await CryptoUtil.comparePassword(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: ErrorCodes.PASSWORD_INCORRECT,
        message: '邮箱或密码不正确',
      });
    }

    // 校验账户状态
    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException({
        code: ErrorCodes.ACCOUNT_BANNED,
        message: '账户已被封禁',
      });
    }

    // 签发 Token
    const tokens = await this.issueTokens(user, dto.deviceId, ip, userAgent);

    // 更新最后登录信息
    await this.userService.updateLastLogin(user.id, ip);

    // 记录设备绑定
    if (dto.deviceId) {
      await this.bindDevice(dto.deviceId, user.id, ip, userAgent);
    }

    this.logger.log(`用户登录成功：${user.email}（ID: ${user.id}）`);

    return tokens;
  }

  /**
   * 刷新 access_token
   * 1. 校验 refresh_token 是否有效
   * 2. 旧 refresh_token 吊销（旋转）
   * 3. 签发新 token 对
   */
  async refreshToken(dto: RefreshTokenDto, ip: string): Promise<AuthResponse> {
    // 哈希 refresh_token 进行查询
    const tokenHash = CryptoUtil.hashToken(dto.refreshToken);

    // 查询 refresh_token 记录
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!stored) {
      throw new UnauthorizedException({
        code: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: '刷新令牌无效',
      });
    }

    // 检查是否已吊销
    if (stored.revoked) {
      throw new UnauthorizedException({
        code: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: '刷新令牌已失效，请重新登录',
      });
    }

    // 检查是否已过期
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCodes.TOKEN_EXPIRED,
        message: '刷新令牌已过期，请重新登录',
      });
    }

    // 吊销旧 refresh_token（Token 旋转，防止重放攻击）
    stored.revoked = true;
    await this.refreshTokenRepository.save(stored);

    // 签发新 Token 对
    const tokens = await this.issueTokens(
      stored.user,
      dto.deviceId || stored.deviceId || undefined,
      ip,
      stored.userAgent || '',
    );

    this.logger.log(`Token 刷新成功：用户 ID ${stored.user.id}`);

    return tokens;
  }

  /**
   * 登出
   * 吊销当前用户的所有 refresh_token（或指定设备的）
   */
  async logout(userId: number, deviceId?: string): Promise<void> {
    if (deviceId) {
      // 仅吊销指定设备的 refresh_token
      await this.refreshTokenRepository.update(
        { userId, deviceId, revoked: false },
        { revoked: true },
      );
    } else {
      // 吊销所有 refresh_token
      await this.refreshTokenRepository.update(
        { userId, revoked: false },
        { revoked: true },
      );
    }
    this.logger.log(`用户登出：ID ${userId}`);
  }

  /**
   * 发送邮箱验证码
   */
  async sendVerificationCode(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      // 安全考虑：不暴露用户是否存在
      return;
    }

    const code = CryptoUtil.generateVerificationCode();

    // 将验证码存入 Redis（10 分钟过期）
    // 注意：RedisService 将在 Phase 2 接入，当前使用数据库临时存储
    // TODO: Phase 2 接入 Redis 后迁移验证码存储
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });
    await redis.set(`verify:${email}`, code, 'EX', 600); // 10 分钟过期
    await redis.disconnect();

    // 发送验证码邮件
    await this.emailService.sendVerificationCode(email, code);
    this.logger.log(`验证码已发送至：${email}`);
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });

    const storedCode = await redis.get(`verify:${dto.email}`);
    await redis.disconnect();

    if (!storedCode) {
      throw new BadRequestException({
        code: ErrorCodes.VERIFICATION_CODE_EXPIRED,
        message: '验证码已过期，请重新获取',
      });
    }

    if (storedCode !== dto.code) {
      throw new BadRequestException({
        code: ErrorCodes.INVALID_VERIFICATION_CODE,
        message: '验证码不正确',
      });
    }

    // 验证成功，标记邮箱已验证
    const user = await this.userService.findByEmail(dto.email);
    if (user) {
      await this.userService.markEmailVerified(user.id);
    }

    // 删除验证码
    const redis2 = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });
    await redis2.del(`verify:${dto.email}`);
    await redis2.disconnect();

    this.logger.log(`邮箱验证成功：${dto.email}`);
  }

  /**
   * 发送密码重置邮件
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      // 安全考虑：不暴露用户是否存在
      return;
    }

    // 生成重置令牌
    const resetToken = CryptoUtil.generateToken();

    // 存入 Redis（30 分钟过期）
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });
    await redis.set(`reset:${resetToken}`, user.id, 'EX', 1800); // 30 分钟过期
    await redis.disconnect();

    // 发送重置邮件
    await this.emailService.sendPasswordReset(user.email, resetToken);
    this.logger.log(`密码重置邮件已发送至：${user.email}`);
  }

  /**
   * 重置密码
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });

    const userId = await redis.get(`reset:${dto.token}`);
    if (!userId) {
      throw new BadRequestException({
        code: ErrorCodes.RESET_TOKEN_EXPIRED,
        message: '重置链接已过期，请重新获取',
      });
    }

    // 更新密码
    await this.userService.updatePassword(parseInt(userId, 10), dto.password);

    // 删除重置令牌
    await redis.del(`reset:${dto.token}`);
    await redis.disconnect();

    // 吊销该用户所有 refresh_token
    await this.refreshTokenRepository.update(
      { userId: parseInt(userId, 10), revoked: false },
      { revoked: true },
    );

    this.logger.log(`密码重置成功：用户 ID ${userId}`);
  }

  /**
   * 签发 access_token 和 refresh_token
   */
  private async issueTokens(
    user: User,
    deviceId?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      uuid: user.uuid,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    // 签发 access_token（短期）
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    // 生成 refresh_token（随机字符串，非 JWT）
    const refreshToken = CryptoUtil.generateToken();
    const tokenHash = CryptoUtil.hashToken(refreshToken);

    // 计算 refresh_token 过期时间
    const refreshExpiresIn = this.parseExpiresIn(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );

    // 存储 refresh_token 哈希
    const refreshRecord = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      deviceId: deviceId || null,
      userAgent: userAgent || null,
      ip: ip || null,
      expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
      revoked: false,
    });
    await this.refreshTokenRepository.save(refreshRecord);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(
        this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      ),
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  /**
   * 绑定设备
   * 如果设备不存在则创建，存在则更新最后活跃时间
   */
  private async bindDevice(
    deviceId: string,
    userId: number,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    const existing = await this.deviceBindRepository.findOne({
      where: { deviceId },
    });

    if (existing) {
      // 更新已存在的设备记录
      existing.userId = userId;
      existing.ip = ip;
      existing.userAgent = userAgent;
      existing.lastSeen = new Date();
      await this.deviceBindRepository.save(existing);
    } else {
      // 创建新设备记录
      const device = this.deviceBindRepository.create({
        deviceId,
        userId,
        ip,
        userAgent,
        firstSeen: new Date(),
        lastSeen: new Date(),
      });
      await this.deviceBindRepository.save(device);
    }
  }

  /**
   * 解析过期时间字符串为秒数
   * 支持：15m, 7d, 1h, 3600
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])?$/);
    if (!match) return 900; // 默认 15 分钟

    const value = parseInt(match[1], 10);
    const unit = match[2] || 's';

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}
