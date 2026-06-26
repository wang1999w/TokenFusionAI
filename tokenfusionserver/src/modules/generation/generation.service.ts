import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GenerationHistory,
  GenerationType,
  GenerationStatus,
} from './generation.entity';
import { CreateGenerationDto } from './dto/generation.dto';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * 生成历史服务
 *
 * 职责：
 * 1) create：网关在发起 / 完成一次生成调用时写入历史记录；
 * 2) findByUser：用户历史分页查询，支持按类型过滤；
 * 3) delete：删除用户某条历史记录；
 * 4) getStats：统计用户各类型数量与总 Token 消耗。
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  /** 历史分页单页最大条数 */
  private static readonly MAX_PAGE_SIZE = 50;
  /** 历史分页默认单页条数 */
  private static readonly DEFAULT_PAGE_SIZE = 20;

  constructor(
    @InjectRepository(GenerationHistory)
    private readonly historyRepository: Repository<GenerationHistory>,
  ) {}

  /**
   * 创建生成历史记录（网关调用）
   * 将网关传入的生成上下文与结果落库，供历史查询与统计
   *
   * @param data 生成记录数据
   * @returns 新建记录
   */
  async create(data: CreateGenerationDto): Promise<GenerationHistory> {
    const entity = this.historyRepository.create({
      userId: data.userId ?? null,
      deviceId: data.deviceId,
      type: data.type,
      provider: data.provider,
      model: data.model,
      prompt: data.prompt,
      negativePrompt: data.negativePrompt ?? null,
      params: data.params ?? {},
      result: data.result ?? {},
      tokenCost: data.tokenCost ?? 0,
      durationMs: data.durationMs ?? 0,
      status: data.status,
      errorMsg: data.errorMsg ?? null,
      isPublic: data.isPublic ?? false,
      inviteCode: data.inviteCode ?? null,
    });

    const saved = await this.historyRepository.save(entity);
    this.logger.log(
      `创建生成历史：${saved.id}（类型 ${saved.type}，用户 ${saved.userId ?? '匿名'}）`,
    );
    return saved;
  }

  /**
   * 用户历史分页查询
   *
   * @param userId 用户 ID
   * @param page   页码（从 1 开始）
   * @param limit  每页数量
   * @param type   可选，按生成类型过滤
   */
  async findByUser(
    userId: number,
    page: number,
    limit: number,
    type?: GenerationType,
  ): Promise<{
    items: GenerationHistory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // 参数兜底与边界约束
    const safePage = Number.isFinite(page)
      ? Math.max(1, Math.floor(page))
      : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(
          GenerationService.MAX_PAGE_SIZE,
          Math.max(1, Math.floor(limit)),
        )
      : GenerationService.DEFAULT_PAGE_SIZE;

    // 构造查询条件
    const where: Record<string, unknown> = { userId };
    if (type) {
      // 校验类型合法
      if (!Object.values(GenerationType).includes(type)) {
        throw new BadRequestException({
          code: ErrorCodes.PARAM_INVALID,
          message: '生成类型不合法',
        });
      }
      where.type = type;
    }

    const [items, total] = await this.historyRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * 删除用户某条历史记录
   * 仅允许删除归属于该用户的记录
   *
   * @param userId   用户 ID
   * @param recordId 记录 ID
   */
  async delete(userId: number, recordId: number): Promise<void> {
    const record = await this.historyRepository.findOne({
      where: { id: recordId, userId },
      select: ['id'],
    });
    if (!record) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: '历史记录不存在',
      });
    }
    await this.historyRepository.delete(recordId);
    this.logger.log(`用户 ${userId} 删除历史记录 ${recordId}`);
  }

  /**
   * 统计用户生成情况
   * 返回各类型数量、总消耗 Token、总记录数
   *
   * @param userId 用户 ID
   */
  async getStats(userId: number): Promise<{
    total: number;
    totalTokenCost: number;
    byType: { type: GenerationType; count: number; tokenCost: number }[];
  }> {
    // 按类型聚合：count 与 token_cost 求和
    const rows = await this.historyRepository
      .createQueryBuilder('gh')
      .select('gh.type', 'type')
      .addSelect('COUNT(*)::bigint', 'count')
      .addSelect('COALESCE(SUM(gh.token_cost), 0)::bigint', 'tokenCost')
      .where('gh.user_id = :userId', { userId })
      .groupBy('gh.type')
      .getRawMany<{ type: GenerationType; count: string; tokenCost: string }>();

    // 转为数字并聚合总量
    let total = 0;
    let totalTokenCost = 0;
    const byType = rows.map((row) => {
      const count = Number(row.count);
      const tokenCost = Number(row.tokenCost);
      total += count;
      totalTokenCost += tokenCost;
      return { type: row.type, count, tokenCost };
    });

    return { total, totalTokenCost, byType };
  }
}
