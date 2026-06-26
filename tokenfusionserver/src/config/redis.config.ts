import { registerAs } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

/**
 * Redis (ioredis) 连接配置。
 *
 * 通过 registerAs('redis', ...) 注册为命名空间配置，
 * 后续可直接用于 `new Redis(redisOptions)`。
 */
export default registerAs('redis', (): RedisOptions => ({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD,
}));
