import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiKeyService } from './apikey.service';
import {
  CreateApiKeyDto,
  ToggleApiKeyDto,
  ValidateApiKeyDto,
  UpdateApiKeyUsageDto,
} from './dto/apikey.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * API 密钥控制器
 *
 * 接口分两类：
 * 1) 用户接口（列表 / 创建 / 启用禁用 / 删除）：需登录鉴权，
 *    全局 GlobalJwtAuthGuard 已生效，此处不再重复声明。
 * 2) 内部接口（internal/validate、internal/usage）：标记 @Public() 跳过 JWT 全局守卫，
 *    但必须携带正确的 X-Internal-Key 请求头（取自环境变量 INTERNAL_KEY）方可调用。
 *
 * 路由分布（全局前缀 /api/v1）：
 * - GET    /apikeys                  密钥列表（鉴权）
 * - POST   /apikeys                  创建密钥（鉴权，返回明文一次）
 * - PATCH  /apikeys/:id              启用/禁用密钥（鉴权）
 * - DELETE /apikeys/:id              删除密钥（鉴权）
 * - POST   /apikeys/internal/validate   内部校验密钥（@Public + X-Internal-Key）
 * - POST   /apikeys/internal/usage      内部回写用量（@Public + X-Internal-Key）
 */
@Controller('apikeys')
export class ApiKeyController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 密钥列表（需鉴权）
   * 仅返回前缀与元信息，不返回明文
   * GET /api/v1/apikeys
   */
  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.apiKeyService.list(user.sub);
  }

  /**
   * 创建密钥（需鉴权）
   * 明文密钥仅在创建时返回一次，前端需提示用户妥善保存
   * POST /api/v1/apikeys
   */
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeyService.create(user.sub, dto.name);
  }

  /**
   * 启用/禁用密钥（需鉴权）
   * PATCH /api/v1/apikeys/:id
   */
  @Patch(':id')
  async toggle(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleApiKeyDto,
  ) {
    return this.apiKeyService.toggle(user.sub, id, dto.status);
  }

  /**
   * 删除密钥（需鉴权）
   * DELETE /api/v1/apikeys/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.apiKeyService.delete(user.sub, id);
    return { message: '密钥已删除' };
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
   * 内部校验密钥（@Public + X-Internal-Key）
   * 网关在收到携带 API Key 的请求时调用，返回 userId 与配额信息
   * POST /api/v1/apikeys/internal/validate
   */
  @Public()
  @Post('internal/validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body() dto: ValidateApiKeyDto, @Req() req: Request) {
    this.assertInternalKey(req);
    return this.apiKeyService.validate(dto.key);
  }

  /**
   * 内部回写密钥用量（@Public + X-Internal-Key）
   * 网关在调用结算后回写密钥已用 Token 数量
   * POST /api/v1/apikeys/internal/usage
   */
  @Public()
  @Post('internal/usage')
  @HttpCode(HttpStatus.OK)
  async updateUsage(@Body() dto: UpdateApiKeyUsageDto, @Req() req: Request) {
    this.assertInternalKey(req);
    await this.apiKeyService.updateUsage(dto.keyId, dto.usedTokens);
    return { message: '用量已更新' };
  }
}
