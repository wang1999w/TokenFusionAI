import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

/**
 * TypeORM 数据库配置
 * 返回 TypeOrmModule.forRootAsync 所需的配置对象工厂
 *
 * 支持通过 DB_TYPE 环境变量切换数据库类型：
 * - postgres（默认）：生产/远程数据库
 * - sqlite：本地开发，无需安装 PostgreSQL
 *
 * 配置从环境变量读取：
 * - DB_TYPE: 数据库类型（postgres | sqlite，默认 postgres）
 * - DB_HOST: 数据库主机
 * - DB_PORT: 数据库端口（默认 5432）
 * - DB_USERNAME: 数据库用户名
 * - DB_PASSWORD: 数据库密码
 * - DB_DATABASE: 数据库名称
 */
export const databaseConfig = {
  /**
   * useFactory - 从 ConfigService 读取数据库连接参数
   */
  useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
    const dbType = configService.get<string>('DB_TYPE', 'postgres');

    // SQLite 本地开发模式：无需安装 PostgreSQL
    if (dbType === 'sqlite') {
      return {
        type: 'better-sqlite3',
        database: join(process.cwd(), 'data', 'tokenfusion.db'),
        synchronize: true, // 自动创建表结构（开发模式）
        migrationsRun: false,
        entities: ['dist/**/*.entity.js'],
        migrations: ['dist/database/migrations/*.js'],
        logging: true,
      };
    }

    // PostgreSQL 生产模式
    return {
      type: 'postgres',
      host: configService.get<string>('DB_HOST', 'localhost'),
      port: configService.get<number>('DB_PORT', 5432),
      username: configService.get<string>('DB_USERNAME'),
      password: configService.get<string>('DB_PASSWORD'),
      database: configService.get<string>('DB_DATABASE'),
      synchronize: false, // 生产环境禁用自动同步，使用迁移
      migrationsRun: true, // 启动时自动执行迁移
      entities: ['dist/**/*.entity.js'],
      migrations: ['dist/database/migrations/*.js'],
      logging: configService.get<string>('NODE_ENV') === 'development',
    };
  },
  inject: [ConfigService],
};
