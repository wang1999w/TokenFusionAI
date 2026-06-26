import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envConfig } from './config/env.config';
import { databaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';

/**
 * 应用根模块
 * 导入配置、数据库连接和所有业务模块
 */
@Module({
  imports: [
    // 加载环境变量校验配置，并在 ConfigModule 内部加载 database / redis 配置
    ConfigModule.forRoot(envConfig),
    // TypeORM 数据库连接配置
    TypeOrmModule.forRootAsync(databaseConfig),
    // 业务模块
    UserModule,
    AuthModule,
  ],
})
export class AppModule {}
