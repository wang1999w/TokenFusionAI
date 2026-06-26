import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey, ApiKeyStatus } from './api-key.entity';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * 校验结果：网关调用 validate 后获得的密钥上下文
 */
export interface ApiKeyValidateResult {
  /** 是否有效 */
  valid: boolean;
  /** 所属用户 ID */
  userId: number;
  /** 密钥 ID */
  keyId: number;
  /** 总配额上限（NULL 表示不限额） */
  quotaTotal: number | null;
  /** 已使用配额 */
  quotaUsed: number;
  /** 剩余配额（NULL 表示不限额） */
  quotaRemaining: number | null;
  /** 是否不限额 */
  unlimited: boolean;
  /** 过期时间 */
  expiresAt: Date | null;
}

/**
 * API 密钥服务
 *
 * 职责：
 * 1) 创建密钥：生成 sk-tf- 前缀密钥，明文仅返回一次，数据库存储 SHA256 哈希；
 *    单账号最多持有 5 个密钥。
 * 2) 列表查询：仅返回前缀（sk-tf-xxxxxxxx），不返回明文与哈希。
 * 3) 启用/禁用、删除密钥。
 * 4) validate：网关在收到携带 API Key 的请求时调用，校验密钥有效性并返回
 *    userId 与配额信息，供网关进行鉴权与额度判断。
 * 5) updateUsage：网关在调用结算后回写密钥已用 Token 数量。
 *
 * 安全设计：
 * - 明文密钥从不落库，仅返回给用户一次；
 * - 数据库仅存 key_prefix（展示用）与 key_hash（SHA256，校验用）；
 * - key_hash 列设置 select:false，列表查询默认不返回哈希。
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  /** 单账号最多持有的密钥数量 */
  private static readonly MAX_KEYS_PER_USER = 5;
  /** 密钥前缀（与平台约定） */
  private static readonly KEY_PREFIX = 'sk-tf-';
  /** 密钥随机部分长度 */
  private static readonly RANDOM_PART_LENGTH = 32;
  /** 列表展示用前缀随机部分长度（sk-tf- + 8 位随机） */
  private static readonly PREFIX_DISPLAY_LENGTH = 8;
  /** 随机字符集（大小写字母 + 数字） */
  private static readonly CHARSET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  /**
   * 创建 API 密钥
   * 1. 校验单账号密钥数量上限（最多 5 个）
   * 2. 生成 sk-tf- 前缀的随机密钥
   * 3. 计算 SHA256 哈希、截取展示前缀
   * 4. 写入数据库，明文密钥仅随响应返回一次
   *
   * @param userId 用户 ID
   * @param name   密钥名称
   * @returns 新建密钥信息（含明文密钥，仅此一次）
   */
  async create(
    userId: number,
    name: string,
  ): Promise<{
    id: number;
    name: string;
    keyPrefix: string;
    key: string;
    status: ApiKeyStatus;
    createdAt: Date;
  }> {
    // 校验密钥数量上限
    const count = await this.apiKeyRepository.count({
      where: { userId },
    });
    if (count >= ApiKeyService.MAX_KEYS_PER_USER) {
      throw new ConflictException({
        code: ErrorCodes.PARAM_INVALID,
        message: `每个账号最多创建 ${ApiKeyService.MAX_KEYS_PER_USER} 个 API 密钥`,
      });
    }

    // 生成密钥明文、哈希与展示前缀
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.slice(
      0,
      ApiKeyService.KEY_PREFIX.length + ApiKeyService.PREFIX_DISPLAY_LENGTH,
    );

    // 写入数据库
    const entity = this.apiKeyRepository.create({
      userId,
      name,
      keyPrefix,
      keyHash,
      status: ApiKeyStatus.ENABLED,
      quotaTotal: null,
      quotaUsed: 0,
    });
    const saved = await this.apiKeyRepository.save(entity);
    this.logger.log(
      `用户 ${userId} 创建 API 密钥：${saved.id}（${saved.name}）`,
    );

    return {
      id: saved.id,
      name: saved.name,
      keyPrefix: saved.keyPrefix,
      key: rawKey,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  /**
   * 查询用户密钥列表
   * 仅返回前缀与元信息，不返回明文与哈希
   *
   * @param userId 用户 ID
   */
  async list(userId: number): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'name',
        'keyPrefix',
        'status',
        'quotaTotal',
        'quotaUsed',
        'lastUsedAt',
        'expiresAt',
        'createdAt',
      ],
    });
  }

  /**
   * 启用/禁用密钥
   *
   * @param userId 用户 ID
   * @param keyId  密钥 ID
   * @param status 目标状态：1 启用 / 0 禁用
   * @returns 更新后的密钥摘要
   */
  async toggle(
    userId: number,
    keyId: number,
    status: ApiKeyStatus,
  ): Promise<{ id: number; status: ApiKeyStatus }> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: keyId, userId },
    });
    if (!apiKey) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'API 密钥不存在',
      });
    }

    apiKey.status = status;
    const saved = await this.apiKeyRepository.save(apiKey);
    this.logger.log(
      `用户 ${userId} ${status === ApiKeyStatus.ENABLED ? '启用' : '禁用'} 密钥 ${keyId}`,
    );
    return { id: saved.id, status: saved.status };
  }

  /**
   * 删除密钥
   *
   * @param userId 用户 ID
   * @param keyId  密钥 ID
   */
  async delete(userId: number, keyId: number): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: keyId, userId },
    });
    if (!apiKey) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'API 密钥不存在',
      });
    }
    await this.apiKeyRepository.remove(apiKey);
    this.logger.log(`用户 ${userId} 删除密钥 ${keyId}`);
  }

  /**
   * 校验密钥（网关调用）
   * 1. 基础格式校验（sk-tf- 前缀）
   * 2. 计算哈希并按 key_hash 查询
   * 3. 校验状态（启用）与过期时间
   * 4. 返回 userId 与配额信息，供网关鉴权与额度判断
   *
   * 注意：本方法为只读校验，不更新用量；用量回写请使用 updateUsage。
   *
   * @param key 完整密钥明文
   */
  async validate(key: string): Promise<ApiKeyValidateResult> {
    // 基础格式校验
    if (!key || !key.startsWith(ApiKeyService.KEY_PREFIX)) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHORIZED,
        message: '无效的 API 密钥',
      });
    }

    // 计算哈希并查询
    const keyHash = this.hashKey(key);
    const record = await this.apiKeyRepository.findOne({
      where: { keyHash },
    });
    if (!record) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHORIZED,
        message: '无效的 API 密钥',
      });
    }

    // 状态校验
    if (record.status !== ApiKeyStatus.ENABLED) {
      throw new UnauthorizedException({
        code: ErrorCodes.FORBIDDEN,
        message: 'API 密钥已被禁用',
      });
    }

    // 过期校验
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCodes.FORBIDDEN,
        message: 'API 密钥已过期',
      });
    }

    // 配额校验：若已超额则拒绝
    const unlimited = record.quotaTotal === null;
    const quotaRemaining = unlimited
      ? null
      : Math.max(0, (record.quotaTotal as number) - record.quotaUsed);
    if (!unlimited && quotaRemaining !== null && quotaRemaining <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.TOKEN_INSUFFICIENT,
        message: 'API 密钥配额已用尽',
      });
    }

    return {
      valid: true,
      userId: record.userId,
      keyId: record.id,
      quotaTotal: record.quotaTotal,
      quotaUsed: record.quotaUsed,
      quotaRemaining,
      unlimited,
      expiresAt: record.expiresAt,
    };
  }

  /**
   * 更新密钥用量（网关调用）
   * 累加已用 Token 数量并刷新最后使用时间
   *
   * @param keyId      密钥 ID
   * @param usedTokens 本次消耗的 Token 数量
   */
  async updateUsage(keyId: number, usedTokens: number): Promise<void> {
    if (usedTokens < 0) {
      throw new BadRequestException({
        code: ErrorCodes.PARAM_INVALID,
        message: '消耗数量不能为负',
      });
    }

    // 累加已用配额
    await this.apiKeyRepository.increment(
      { id: keyId },
      'quotaUsed',
      usedTokens,
    );
    // 刷新最后使用时间
    await this.apiKeyRepository.update(
      { id: keyId },
      { lastUsedAt: new Date() },
    );
    this.logger.log(`密钥 ${keyId} 用量增加 ${usedTokens}`);
  }

  /**
   * 生成完整密钥明文
   * 格式：sk-tf- + 32 位随机字母数字
   * 使用 crypto.randomBytes 提供密码学安全的随机源
   */
  private generateRawKey(): string {
    const bytes = randomBytes(ApiKeyService.RANDOM_PART_LENGTH);
    let random = '';
    for (let i = 0; i < ApiKeyService.RANDOM_PART_LENGTH; i++) {
      random += ApiKeyService.CHARSET[bytes[i] % ApiKeyService.CHARSET.length];
    }
    return ApiKeyService.KEY_PREFIX + random;
  }

  /**
   * 计算密钥的 SHA256 哈希
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
