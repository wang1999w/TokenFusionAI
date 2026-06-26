import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RegisterDto } from '../user/dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/forgot-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * 认证控制器
 * 提供注册、登录、登出、Token 刷新、邮箱验证、密码重置等接口
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  /**
   * 用户注册
   * POST /api/v1/auth/register
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const user = await this.userService.register(dto);

    // 注册成功后自动发送验证码
    await this.authService.sendVerificationCode(user.email);

    return {
      message: '注册成功，请查收邮箱完成验证',
      userId: user.id,
    };
  }

  /**
   * 用户登录
   * POST /api/v1/auth/login
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, userAgent);
  }

  /**
   * 刷新 Token
   * POST /api/v1/auth/refresh
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '';
    return this.authService.refreshToken(dto, ip);
  }

  /**
   * 登出
   * POST /api/v1/auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { deviceId?: string },
  ) {
    await this.authService.logout(user.sub, body.deviceId);
    return { message: '登出成功' };
  }

  /**
   * 发送邮箱验证码
   * POST /api/v1/auth/send-verification
   */
  @Public()
  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  async sendVerification(@Body() body: { email: string }) {
    await this.authService.sendVerificationCode(body.email);
    return { message: '验证码已发送' };
  }

  /**
   * 验证邮箱
   * POST /api/v1/auth/verify-email
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto);
    return { message: '邮箱验证成功' };
  }

  /**
   * 找回密码（发送重置邮件）
   * POST /api/v1/auth/forgot-password
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { message: '如果该邮箱已注册，您将收到重置邮件' };
  }

  /**
   * 重置密码
   * POST /api/v1/auth/reset-password
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: '密码重置成功，请使用新密码登录' };
  }
}
