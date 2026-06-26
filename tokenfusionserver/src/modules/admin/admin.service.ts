import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserStatus } from '../user/user.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { TokenAccount } from '../billing/entities/token-account.entity';
import { InviteRelation } from '../invite/invite.entity';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * 数据看板返回结构
 */
export interface DashboardResult {
  /** 日活用户数（今日有生成记录的去重用户数） */
  dau: number;
  /** 注册量统计 */
  registrations: { today: number; total: number };
  /** 充值额统计（Token 数量 + 金额，分） */
  recharge: {
    today: { tokenAmount: number; amountCents: number; orderCount: number };
    total: { tokenAmount: number; amountCents: number; orderCount: number };
  };
  /** API / 生成调用量统计 */
  apiCalls: { today: number; total: number };
  /** 各功能占比 */
  featureRatio: { type: string; count: number; ratio: number }[];
}

/**
 * 管理服务（Phase 7 管理后台）
 *
 * 提供管理后台所需的核心能力：
 * 1) getUsers：用户列表（支持按邮箱 / 昵称搜索）；
 * 2) banUser：封禁 / 解封用户；
 * 3) adjustTokens：调整用户 Token 额度（正增负减）；
 * 4) getOrders：订单列表（分页）；
 * 5) getDashboard：数据看板（DAU、注册量、充值额、API 调用量、各功能占比）。
 *
 * 敏感操作（封禁、调额）会写入 audit_logs 审计日志，便于追溯。
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  /** 用户列表分页单页最大条数 */
  private static readonly MAX_PAGE_SIZE = 50;
  /** 用户列表分页默认单页条数 */
  private static readonly DEFAULT_PAGE_SIZE = 20;
  /** 订单列表分页单页最大条数 */
  private static readonly MAX_ORDER_PAGE_SIZE = 50;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(TokenAccount)
    private readonly tokenAccountRepository: Repository<TokenAccount>,
    @InjectRepository(InviteRelation)
    private readonly inviteRelationRepository: Repository<InviteRelation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 用户列表（分页，支持搜索）
   *
   * @param page   页码（从 1 开始）
   * @param limit  每页数量
   * @param search 搜索关键字（匹配邮箱或昵称，可空）
   */
  async getUsers(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{
    items: Array<{
      id: number;
      uuid: string;
      email: string;
      status: UserStatus;
      role: string;
      nickname: string | null;
      avatarUrl: string | null;
      inviteCode: string;
      inviterId: number | null;
      emailVerified: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
      balance: number;
      frozen: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const safePage = Number.isFinite(page)
      ? Math.max(1, Math.floor(page))
      : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(
          AdminService.MAX_PAGE_SIZE,
          Math.max(1, Math.floor(limit)),
        )
      : AdminService.DEFAULT_PAGE_SIZE;

    // 构造查询：仅查询未删除用户，左连接 Token 账户以展示余额
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.tokenAccount', 'account')
      .where('user.deleted_at IS NULL');

    // 搜索关键字：模糊匹配邮箱或昵称
    if (search && search.trim()) {
      qb.andWhere(
        '(user.email ILIKE :q OR user.nickname ILIKE :q)',
        { q: `%${search.trim()}%` },
      );
    }

    qb.orderBy('user.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    const [users, total] = await qb.getManyAndCount();

    // 映射为简洁的列表项（bigint 余额统一转为数字）
    const items = users.map((u) => ({
      id: u.id,
      uuid: u.uuid,
      email: u.email,
      status: u.status,
      role: u.role,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      inviteCode: u.inviteCode,
      inviterId: u.inviterId,
      emailVerified: u.emailVerified,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      balance: u.tokenAccount ? Number(u.tokenAccount.balance) : 0,
      frozen: u.tokenAccount ? Number(u.tokenAccount.frozen) : 0,
    }));

    return { items, total, page: safePage, limit: safeLimit };
  }

  /**
   * 封禁 / 解封用户
   *
   * @param userId     目标用户 ID
   * @param status     目标状态：1 启用 / 0 封禁
   * @param operatorId 操作管理员 ID（用于审计）
   */
  async banUser(
    userId: number,
    status: UserStatus,
    operatorId: number,
  ): Promise<{ id: number; status: UserStatus }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'status', 'role'],
    });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: '用户不存在',
      });
    }
    // 禁止封禁 / 操作管理员账户，避免误锁后台
    if (user.role === 'admin') {
      throw new BadRequestException({
        code: ErrorCodes.FORBIDDEN,
        message: '不能封禁管理员账户',
      });
    }

    user.status = status;
    await this.userRepository.save(user);

    // 写入审计日志
    await this.writeAuditLog(operatorId, 'user', userId, 'ban', {
      email: user.email,
      status,
    });

    this.logger.log(
      `管理员 ${operatorId} 将用户 ${userId} 状态置为 ${status}`,
    );
    return { id: user.id, status: user.status };
  }

  /**
   * 调整用户 Token 额度
   * 正数增加余额，负数扣减余额（扣减后不低于 0）
   *
   * @param userId     目标用户 ID
   * @param amount     调整额度（正增负减）
   * @param operatorId 操作管理员 ID（用于审计）
   */
  async adjustTokens(
    userId: number,
    amount: number,
    operatorId: number,
  ): Promise<{
    userId: number;
    balanceBefore: number;
    balanceAfter: number;
    delta: number;
  }> {
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException({
        code: ErrorCodes.PARAM_INVALID,
        message: '调整额度不能为 0',
      });
    }

    // 确保用户存在
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: '用户不存在',
      });
    }

    // 确保账户存在（首次调整时兜底创建）
    let account = await this.tokenAccountRepository.findOne({
      where: { userId },
    });
    if (!account) {
      account = this.tokenAccountRepository.create({
        userId,
        balance: 0,
        frozen: 0,
        totalRecharged: 0,
        totalConsumed: 0,
        totalGifted: 0,
        version: 0,
      });
      account = await this.tokenAccountRepository.save(account);
    }

    // 计算调整后余额（bigint 运行时可能为字符串，统一转数字）
    const balanceBefore = Number(account.balance);
    const balanceAfter = Math.max(0, balanceBefore + amount);

    await this.tokenAccountRepository.update(
      { id: account.id },
      { balance: balanceAfter },
    );

    // 写入审计日志
    await this.writeAuditLog(operatorId, 'user', userId, 'adjust_tokens', {
      amount,
      balanceBefore,
      balanceAfter,
    });

    this.logger.log(
      `管理员 ${operatorId} 调整用户 ${userId} Token 额度：${amount}（${balanceBefore} → ${balanceAfter}）`,
    );
    return {
      userId,
      balanceBefore,
      balanceAfter,
      delta: amount,
    };
  }

  /**
   * 订单列表（分页）
   * 按创建时间倒序，关联套餐信息
   *
   * @param page  页码（从 1 开始）
   * @param limit 每页数量
   */
  async getOrders(
    page: number,
    limit: number,
  ): Promise<{
    items: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const safePage = Number.isFinite(page)
      ? Math.max(1, Math.floor(page))
      : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(
          AdminService.MAX_ORDER_PAGE_SIZE,
          Math.max(1, Math.floor(limit)),
        )
      : 20;

    const [items, total] = await this.orderRepository.findAndCount({
      relations: ['plan'],
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return { items, total, page: safePage, limit: safeLimit };
  }

  /**
   * 数据看板
   * 汇总 DAU、注册量、充值额、API 调用量、各功能占比
   *
   * 各指标口径：
   * - DAU：今日有生成记录的去重用户数（活跃用户）；
   * - 注册量：今日 / 累计注册用户数；
   * - 充值额：今日 / 累计已支付订单的 Token 数量与金额（分）；
   * - API 调用量：今日 / 累计生成历史记录数；
   * - 各功能占比：按生成类型（chat/image/video/code）统计数量与占比。
   */
  async getDashboard(): Promise<DashboardResult> {
    // 1. DAU：今日有生成记录的去重用户数
    const dauRows = await this.dataSource.query<
      Array<{ dau: string }>
    >(
      `SELECT COUNT(DISTINCT user_id)::int AS dau
         FROM generation_history
        WHERE created_at >= date_trunc('day', NOW())
          AND user_id IS NOT NULL`,
    );
    const dau = dauRows.length ? Number(dauRows[0].dau) : 0;

    // 2. 注册量：今日 + 累计
    const regRows = await this.dataSource.query<
      Array<{ today: string; total: string }>
    >(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE created_at >= date_trunc('day', NOW()) AND deleted_at IS NULL) AS today,
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) AS total`,
    );
    const registrations = {
      today: regRows.length ? Number(regRows[0].today) : 0,
      total: regRows.length ? Number(regRows[0].total) : 0,
    };

    // 3. 充值额：今日 + 累计（仅统计已支付订单）
    const rechargeRows = await this.dataSource.query<
      Array<{
        today_count: string;
        today_tokens: string;
        today_cents: string;
        total_count: string;
        total_tokens: string;
        total_cents: string;
      }>
    >(
      `SELECT
         (SELECT COUNT(*)::int    FROM orders WHERE status = $1 AND paid_at >= date_trunc('day', NOW())) AS today_count,
         (SELECT COALESCE(SUM(token_amount),0)::bigint FROM orders WHERE status = $1 AND paid_at >= date_trunc('day', NOW())) AS today_tokens,
         (SELECT COALESCE(SUM(amount_cents),0)::bigint FROM orders WHERE status = $1 AND paid_at >= date_trunc('day', NOW())) AS today_cents,
         (SELECT COUNT(*)::int    FROM orders WHERE status = $1) AS total_count,
         (SELECT COALESCE(SUM(token_amount),0)::bigint FROM orders WHERE status = $1) AS total_tokens,
         (SELECT COALESCE(SUM(amount_cents),0)::bigint FROM orders WHERE status = $1) AS total_cents`,
      [OrderStatus.PAID],
    );
    const r = rechargeRows[0] ?? {};
    const recharge = {
      today: {
        tokenAmount: Number(r.today_tokens ?? 0),
        amountCents: Number(r.today_cents ?? 0),
        orderCount: Number(r.today_count ?? 0),
      },
      total: {
        tokenAmount: Number(r.total_tokens ?? 0),
        amountCents: Number(r.total_cents ?? 0),
        orderCount: Number(r.total_count ?? 0),
      },
    };

    // 4. API 调用量：今日 + 累计生成记录数
    const apiRows = await this.dataSource.query<
      Array<{ today: string; total: string }>
    >(
      `SELECT
         (SELECT COUNT(*)::int FROM generation_history WHERE created_at >= date_trunc('day', NOW())) AS today,
         (SELECT COUNT(*)::int FROM generation_history) AS total`,
    );
    const apiCalls = {
      today: apiRows.length ? Number(apiRows[0].today) : 0,
      total: apiRows.length ? Number(apiRows[0].total) : 0,
    };

    // 5. 各功能占比：按生成类型聚合
    const featureRows = await this.dataSource.query<
      Array<{ type: string; count: string }>
    >(
      `SELECT type, COUNT(*)::int AS count
         FROM generation_history
        GROUP BY type
        ORDER BY count DESC`,
    );
    const featureTotal = featureRows.reduce(
      (sum, row) => sum + Number(row.count),
      0,
    );
    const featureRatio = featureRows.map((row) => ({
      type: row.type,
      count: Number(row.count),
      ratio: featureTotal > 0 ? Number(row.count) / featureTotal : 0,
    }));

    return {
      dau,
      registrations,
      recharge,
      apiCalls,
      featureRatio,
    };
  }

  /**
   * 写入审计日志
   * 使用参数化查询，避免 SQL 注入
   *
   * @param operatorId  操作管理员 ID
   * @param targetType  操作对象类型（如 user）
   * @param targetId    操作对象 ID
   * @param action      操作类型（如 ban / adjust_tokens）
   * @param detail      操作详情（JSON）
   */
  private async writeAuditLog(
    operatorId: number,
    targetType: string,
    targetId: number,
    action: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs (operator_id, target_type, target_id, action, detail, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
        [
          operatorId,
          targetType,
          targetId,
          action,
          JSON.stringify(detail),
        ],
      );
    } catch (err) {
      // 审计日志写入失败不应阻断主流程，仅记录日志
      this.logger.error(
        `审计日志写入失败：${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
