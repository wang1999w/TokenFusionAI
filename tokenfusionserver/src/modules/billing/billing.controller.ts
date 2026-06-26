import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { FreezeDto, SettleDto, RollbackDto } from './dto/billing.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * 计费控制器
 *
 * 接口分两类：
 * 1) 普通用户接口（balance / records）：需登录鉴权，使用 @UseGuards(JwtAuthGuard)
 *    （应用已在 main.ts 注册全局 GlobalJwtAuthGuard，此处显式声明以表明鉴权要求）
 * 2) 内部接口（internal/freeze / settle / rollback）：标记为 @Public() 跳过 JWT 全局守卫，
 *    但必须携带正确的 X-Internal-Key 请求头（取自环境变量 INTERNAL_KEY）方可调用。
 */
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 查询当前用户 Token 余额
   * GET /api/v1/billing/balance
   */
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@CurrentUser() user: JwtPayload) {
    return this.billingService.getBalance(user.sub);
  }

  /**
   * 分页查询当前用户 Token 流水
   * GET /api/v1/billing/records?page=1&limit=20
   */
  @Get('records')
  @UseGuards(JwtAuthGuard)
  async getRecords(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.billingService.getRecords(user.sub, pageNum, limitNum);
  }

  /**
   * 内部接口鉴权：校验 X-Internal-Key 请求头
   * 头部值必须与环境变量 INTERNAL_KEY 完全一致，否则拒绝访问
   */
  private assertInternalKey(req: Request): void {
    const header = req.headers['x-internal-key'];
    const provided = Array.isArray(header) ? header[0] : header;
    const expected = this.configService.get<string>('INTERNAL_KEY');
    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHORIZED,
        message: '内部接口调用未授权',
      });
    }
  }

  /**
   * 内部预扣冻结
   * POST /api/v1/billing/internal/freeze
   */
  @Public()
  @Post('internal/freeze')
  @HttpCode(HttpStatus.OK)
  async freeze(@Body() dto: FreezeDto, @Req() req: Request) {
    this.assertInternalKey(req);
    return this.billingService.freezeTokens(
      dto.userId,
      dto.amount,
      dto.bizType,
      dto.bizId,
      dto.idempotencyKey,
    );
  }

  /**
   * 内部结算确认
   * POST /api/v1/billing/internal/settle
   */
  @Public()
  @Post('internal/settle')
  @HttpCode(HttpStatus.OK)
  async settle(@Body() dto: SettleDto, @Req() req: Request) {
    this.assertInternalKey(req);
    return this.billingService.settleTokens(
      dto.userId,
      dto.actualAmount,
      dto.bizType,
      dto.bizId,
      dto.idempotencyKey,
    );
  }

  /**
   * 内部失败回补
   * POST /api/v1/billing/internal/rollback
   */
  @Public()
  @Post('internal/rollback')
  @HttpCode(HttpStatus.OK)
  async rollback(@Body() dto: RollbackDto, @Req() req: Request) {
    this.assertInternalKey(req);
    return this.billingService.rollbackTokens(
      dto.userId,
      dto.amount,
      dto.bizType,
      dto.bizId,
      dto.idempotencyKey,
    );
  }
}
