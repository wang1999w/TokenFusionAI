import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

/**
 * 应用根控制器
 * 提供健康检查等系统级接口
 */
@Controller()
export class AppController {
  /**
   * 健康检查
   * GET /api/v1/
   */
  @Public()
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'TokenFusion AI API',
    };
  }
}
