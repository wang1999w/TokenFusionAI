import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './api-key.entity';
import { ApiKeyService } from './apikey.service';
import { ApiKeyController } from './apikey.controller';

/**
 * API 密钥模块（Phase 5）
 *
 * 注册 api_keys 实体仓储，对外提供 API Key 管理服务（ApiKeyService）与
 * API Key 管理接口（ApiKeyController）。
 * 导出 ApiKeyService 以供网关 / 计费等模块调用密钥校验与用量更新。
 */
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  providers: [ApiKeyService],
  controllers: [ApiKeyController],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
