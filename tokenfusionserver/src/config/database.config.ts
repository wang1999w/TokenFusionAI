import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * TypeORM 配置（TypeOrmModule.forRootAsync 的配置对象）。
 *
 * 通过 registerAs('database', ...) 注册为命名空间配置，
 * 后续可在 TypeOrmModule.forRootAsync 中使用：
 *   useFactory: (config: ConfigService) => config.get('database')
 */
export default registerAs('database', (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  migrationsRun: true,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
}));
