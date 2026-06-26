import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { GenerationService } from './generation.service';
import { CreateGenerationDto } from './dto/generation.dto';
import { GenerationType } from './generation.entity';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * 生成历史控制器
 *
 * 接口分两类：
 * 1) 用户接口（列表 / 删除）：需登录鉴权，全局 GlobalJwtAuthGuard 已生效。
 * 2) 内部接口（internal/create）：标记 @Public() 跳过 JWT 全局守卫，
 *    但必须携带正确的 X-Internal-Key 请求头（取自环境变量 INTERNAL_KEY）方可调用。
 *
 * 路由分布（全局前缀 /api/v1）：
 * - GET    /history              历史列表（鉴权，分页，可按类型过滤）
 * - DELETE /history/:id          删除记录（鉴权）
 * - POST   /history/internal/create  内部创建记录（@Public + X-Internal-Key）
 */
@Controller('history')
export class GenerationController {
  constructor(
    private readonly generationService: GenerationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 历史列表（需鉴权，分页）
   * GET /api/v1/history?page=1&limit=20&type=chat
   */
  @Get()
  async findByUser(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    // type 为可选，未传则为 undefined（不过滤）
    const typeFilter = type
      ? (type as GenerationType)
      : undefined;
    return this.generationService.findByUser(
      user.sub,
      pageNum,
      limitNum,
      typeFilter,
    );
  }

  /**
   * 删除记录（需鉴权）
   * DELETE /api/v1/history/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.generationService.delete(user.sub, id);
    return { message: '记录已删除' };
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
   * 内部创建生成历史（@Public + X-Internal-Key）
   * 网关在发起 / 完成一次生成调用时写入历史记录
   * POST /api/v1/history/internal/create
   */
  @Public()
  @Post('internal/create')
  @HttpCode(HttpStatus.OK)
  async create(@Body() dto: CreateGenerationDto, @Req() req: Request) {
    this.assertInternalKey(req);
    return this.generationService.create(dto);
  }
}
