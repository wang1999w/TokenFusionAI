import { ConfigModuleOptions } from '@nestjs/config';
import { databaseConfig } from './database.config';

/**
 * 必须配置的环境变量列表
 */
const REQUIRED_ENV_VARS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
] as const;

/**
 * 校验环境变量，缺失或非法时直接抛出异常以阻止应用启动
 */
const validateEnvironment = (
  config: Record<string, any>,
): Record<string, any> => {
  for (const envVar of REQUIRED_ENV_VARS) {
    if (config[envVar] === undefined || config[envVar] === '') {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  if (Number.isNaN(Number(config.DB_PORT))) {
    throw new Error('DB_PORT must be a valid number');
  }

  if (Number.isNaN(Number(config.REDIS_PORT))) {
    throw new Error('REDIS_PORT must be a valid number');
  }

  return config;
};

/**
 * Redis 配置加载函数（供 ConfigModule.load 使用）
 * 返回 ioredis 连接参数
 */
const loadRedisConfig = () => ({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD,
});

/**
 * @nestjs/config 配置：
 * - isGlobal: 全局注入 ConfigService
 * - envFilePath: 按 NODE_ENV 选择环境文件，回退到 .env
 * - validate: 环境变量校验
 * - load: 内部加载 database / redis 配置（redis 用函数，database 已在 TypeOrmModule 中配置）
 */
export const envConfig: ConfigModuleOptions = {
  isGlobal: true,
  envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
  validate: validateEnvironment,
  load: [loadRedisConfig],
};
