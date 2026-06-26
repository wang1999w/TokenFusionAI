import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envConfig } from './config/env.config';

@Module({
  imports: [
    // 加载环境变量校验配置，并在 ConfigModule 内部加载 database / redis 配置
    ConfigModule.forRoot(envConfig),
    // 业务模块暂未导入，后续在此处添加 feature modules
  ],
})
export class AppModule {}
