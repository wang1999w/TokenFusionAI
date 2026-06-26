import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationHistory } from './generation.entity';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';

/**
 * 生成历史模块（Phase 5）
 *
 * 注册 generation_history 实体仓储，对外提供生成历史服务（GenerationService）与
 * 生成历史接口（GenerationController）。
 * 导出 GenerationService 以供管理后台统计、邀请奖励等模块调用。
 */
@Module({
  imports: [TypeOrmModule.forFeature([GenerationHistory])],
  providers: [GenerationService],
  controllers: [GenerationController],
  exports: [GenerationService],
})
export class GenerationModule {}
