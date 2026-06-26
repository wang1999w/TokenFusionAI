import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { TokenAccount } from './entities/token-account.entity';
import {
  TokenRecord,
  TokenRecordType,
  BizType,
} from './entities/token-record.entity';
import { ErrorCodes } from '../../common/constants/error-codes';

/** 账户可变字段的子集（不含 id / userId / version / updatedAt） */
type AccountMutable = Pick<
  TokenAccount,
  'balance' | 'frozen' | 'totalRecharged' | 'totalConsumed' | 'totalGifted'
>;

/** 待写入的流水载荷（由各业务方法计算后传入） */
interface RecordPayload {
  /** 流水类型 */
  type: TokenRecordType;
  /** 变动金额：正进负出 */
  amount: number;
  /** 业务类型（充值/赠额可为 null） */
  bizType: BizType | null;
  /** 业务 ID */
  bizId: string | null;
  /** 变动后的账户可用余额快照 */
  balanceAfter: number;
  /** 备注 */
  remark: string | null;
}

/**
 * 乐观锁版本冲突哨兵错误
 * 仅用于在事务内部标记"版本号不匹配需重试"，不应向外抛出
 */
class OptimisticLockConflictError extends Error {
  constructor() {
    super('optimistic lock version mismatch');
    this.name = 'OptimisticLockConflictError';
  }
}

/**
 * 计费核心服务
 *
 * 负责 Token 账户的创建、余额查询、流水分页，以及预扣冻结 / 结算 / 回补 / 充值 / 赠额等资金操作。
 *
 * 并发安全设计：
 * 1) 幂等防重：每次资金操作前先按 idempotencyKey 查询是否已存在流水，存在则直接返回；
 *    写入时依赖 idempotency_key 的 UNIQUE 约束兜底，并发重复时回查既有流水返回。
 * 2) 乐观锁重试：账户更新使用 UPDATE ... WHERE id = ? AND version = ? 的方式，
 *    若 affected = 0 表示版本已被其它事务修改，则回滚当前事务并重试，最多重试 3 次。
 * 3) 事务一致性：账户更新与流水写入放在同一事务内，保证账实一致（账户变动必伴随流水）。
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  /** 乐观锁最大重试次数 */
  private static readonly MAX_OPTIMISTIC_RETRIES = 3;
  /** 流水分页单页最大条数 */
  private static readonly MAX_PAGE_SIZE = 100;
  /** 流水分页默认单页条数 */
  private static readonly DEFAULT_PAGE_SIZE = 20;

  constructor(
    @InjectRepository(TokenAccount)
    private readonly tokenAccountRepository: Repository<TokenAccount>,
    @InjectRepository(TokenRecord)
    private readonly tokenRecordRepository: Repository<TokenRecord>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建 Token 账户
   * 若该用户已存在账户则直接返回（幂等），并发创建时通过唯一约束兜底
   */
  async createAccount(userId: number): Promise<TokenAccount> {
    // 幂等：已存在则直接返回
    const existing = await this.tokenAccountRepository.findOne({
      where: { userId },
    });
    if (existing) {
      return existing;
    }

    const account = this.tokenAccountRepository.create({
      userId,
      balance: 0,
      frozen: 0,
      totalRecharged: 0,
      totalConsumed: 0,
      totalGifted: 0,
      version: 0,
    });

    try {
      return await this.tokenAccountRepository.save(account);
    } catch (err) {
      // 并发创建导致 user_id 唯一约束冲突，回查已存在的账户返回
      if (this.isUniqueViolation(err)) {
        const existed = await this.tokenAccountRepository.findOne({
          where: { userId },
        });
        if (existed) return existed;
      }
      throw err;
    }
  }

  /**
   * 查询账户余额及累计统计
   */
  async getBalance(userId: number): Promise<{
    balance: number;
    frozen: number;
    totalRecharged: number;
    totalConsumed: number;
    totalGifted: number;
  }> {
    const account = await this.tokenAccountRepository.findOne({
      where: { userId },
    });
    if (!account) {
      throw new NotFoundException({
        code: ErrorCodes.USER_NOT_FOUND,
        message: 'Token 账户不存在，请先创建账户',
      });
    }
    return {
      balance: account.balance,
      frozen: account.frozen,
      totalRecharged: account.totalRecharged,
      totalConsumed: account.totalConsumed,
      totalGifted: account.totalGifted,
    };
  }

  /**
   * 分页查询 Token 流水（按创建时间倒序）
   */
  async getRecords(
    userId: number,
    page: number,
    limit: number,
  ): Promise<{
    list: TokenRecord[];
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
          BillingService.MAX_PAGE_SIZE,
          Math.max(1, Math.floor(limit)),
        )
      : BillingService.DEFAULT_PAGE_SIZE;

    const [list, total] = await this.tokenRecordRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      list,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * 预扣冻结
   * 业务发起一次 Token 消耗请求前调用：
   * - balance 减少 amount，frozen 增加 amount
   * - 写入流水 type=freeze，amount 为负（资金从可用余额转出）
   */
  async freezeTokens(
    userId: number,
    amount: number,
    bizType: BizType,
    bizId: string,
    idempotencyKey: string,
  ): Promise<TokenRecord> {
    if (amount <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.PARAM_INVALID,
        message: '冻结金额必须大于 0',
      });
    }

    return this.executeWithOptimisticLock(userId, idempotencyKey, (account) => {
      // 余额校验
      if (account.balance < amount) {
        throw new BadRequestException({
          code: ErrorCodes.TOKEN_INSUFFICIENT,
          message: '可用余额不足，无法冻结',
        });
      }
      const newBalance = account.balance - amount;
      return {
        update: {
          balance: newBalance,
          frozen: account.frozen + amount,
        },
        record: {
          type: TokenRecordType.FREEZE,
          amount: -amount, // 资金从可用余额转出，记为负
          bizType,
          bizId,
          balanceAfter: newBalance,
          remark: null,
        },
      };
    });
  }

  /**
   * 结算确认
   * 业务完成后按实际消耗量结算：
   * - frozen 减少 actualAmount，totalConsumed 增加 actualAmount
   * - balance 不变（冻结时已从余额转出）
   * - 写入流水 type=consume，amount 为负（资金被消耗）
   *
   * 若实际消耗小于此前冻结量，剩余冻结额度需由调用方另行调用 rollbackTokens 回补。
   */
  async settleTokens(
    userId: number,
    actualAmount: number,
    bizType: BizType,
    bizId: string,
    idempotencyKey: string,
  ): Promise<TokenRecord> {
    if (actualAmount <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.PARAM_INVALID,
        message: '结算金额必须大于 0',
      });
    }

    return this.executeWithOptimisticLock(userId, idempotencyKey, (account) => {
      // 冻结额度校验
      if (account.frozen < actualAmount) {
        throw new BadRequestException({
          code: ErrorCodes.PARAM_INVALID,
          message: '冻结额度不足，无法结算',
        });
      }
      return {
        update: {
          frozen: account.frozen - actualAmount,
          totalConsumed: account.totalConsumed + actualAmount,
        },
        record: {
          type: TokenRecordType.CONSUME,
          amount: -actualAmount, // 资金被消耗，记为负
          bizType,
          bizId,
          balanceAfter: account.balance, // 结算不改变可用余额
          remark: null,
        },
      };
    });
  }

  /**
   * 失败回补
   * 业务失败或结算后将剩余冻结额度退回可用余额：
   * - frozen 减少 amount，balance 增加 amount
   * - 写入流水 type=rollback，amount 为正（资金回流可用余额）
   */
  async rollbackTokens(
    userId: number,
    amount: number,
    bizType: BizType,
    bizId: string,
    idempotencyKey: string,
  ): Promise<TokenRecord> {
    if (amount <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.PARAM_INVALID,
        message: '回补金额必须大于 0',
      });
    }

    return this.executeWithOptimisticLock(userId, idempotencyKey, (account) => {
      // 冻结额度校验
      if (account.frozen < amount) {
        throw new BadRequestException({
          code: ErrorCodes.PARAM_INVALID,
          message: '冻结额度不足，无法回补',
        });
      }
      const newBalance = account.balance + amount;
      return {
        update: {
          frozen: account.frozen - amount,
          balance: newBalance,
        },
        record: {
          type: TokenRecordType.ROLLBACK,
          amount: amount, // 资金回流可用余额，记为正
          bizType,
          bizId,
          balanceAfter: newBalance,
          remark: null,
        },
      };
    });
  }

  /**
   * 充值
   * 支付回调成功后调用：
   * - balance 增加 amount，totalRecharged 增加 amount
   * - 写入流水 type=recharge，amount 为正，bizId 记录订单号
   */
  async rechargeTokens(
    userId: number,
    amount: number,
    orderId: string,
    idempotencyKey: string,
  ): Promise<TokenRecord> {
    if (amount <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.PARAM_INVALID,
        message: '充值金额必须大于 0',
      });
    }

    return this.executeWithOptimisticLock(userId, idempotencyKey, (account) => {
      const newBalance = account.balance + amount;
      return {
        update: {
          balance: newBalance,
          totalRecharged: account.totalRecharged + amount,
        },
        record: {
          type: TokenRecordType.RECHARGE,
          amount: amount,
          bizType: null, // 充值无业务类型
          bizId: orderId, // 记录订单号便于对账
          balanceAfter: newBalance,
          remark: `充值订单：${orderId}`,
        },
      };
    });
  }

  /**
   * 赠额
   * 注册赠额、邀请奖励、首充赠额等场景调用：
   * - balance 增加 amount，totalGifted 增加 amount
   * - 写入流水 type=gift，amount 为正，bizId 记录赠额场景
   */
  async giftTokens(
    userId: number,
    amount: number,
    scene: string,
    idempotencyKey: string,
  ): Promise<TokenRecord> {
    if (amount <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.PARAM_INVALID,
        message: '赠额数量必须大于 0',
      });
    }

    return this.executeWithOptimisticLock(userId, idempotencyKey, (account) => {
      const newBalance = account.balance + amount;
      return {
        update: {
          balance: newBalance,
          totalGifted: account.totalGifted + amount,
        },
        record: {
          type: TokenRecordType.GIFT,
          amount: amount,
          bizType: null, // 赠额无业务类型
          bizId: scene, // 记录赠额场景便于对账
          balanceAfter: newBalance,
          remark: `赠额场景：${scene}`,
        },
      };
    });
  }

  /**
   * 资金操作的统一执行器（乐观锁重试 + 幂等防重 + 事务一致性）
   *
   * 执行流程：
   * 1. 幂等预检：按 idempotencyKey 查询，若已存在流水则直接返回。
   * 2. 进入事务：
   *    a. 加载账户（含当前 version）
   *    b. 调用 apply 计算本次账户变更与流水载荷（期间可做余额/额度校验）
   *    c. 乐观锁更新账户：UPDATE ... WHERE id=? AND version=?，affected=0 视为冲突
   *    d. 冲突则抛哨兵错误触发事务回滚并重试；成功则写入流水并提交。
   * 3. 异常分流：
   *    - 哨兵冲突 → 重试（最多 MAX_OPTIMISTIC_RETRIES 次）
   *    - 幂等键唯一冲突 → 并发重复，回查既有流水返回
   *    - 其它业务异常（如余额不足）→ 直接抛出
   */
  private async executeWithOptimisticLock(
    userId: number,
    idempotencyKey: string,
    apply: (account: TokenAccount) => {
      update: Partial<AccountMutable>;
      record: RecordPayload;
    },
  ): Promise<TokenRecord> {
    // 1. 幂等预检
    const existed = await this.tokenRecordRepository.findOne({
      where: { idempotencyKey },
    });
    if (existed) {
      this.logger.warn(`幂等键已存在，返回既有流水：${idempotencyKey}`);
      return existed;
    }

    // 2. 乐观锁重试循环
    for (
      let attempt = 1;
      attempt <= BillingService.MAX_OPTIMISTIC_RETRIES;
      attempt++
    ) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          // a. 加载账户（带当前 version）
          const account = await manager.findOne(TokenAccount, {
            where: { userId },
          });
          if (!account) {
            throw new NotFoundException({
              code: ErrorCodes.USER_NOT_FOUND,
              message: 'Token 账户不存在，请先创建账户',
            });
          }

          // b. 计算本次变更（apply 内部会做余额/额度校验）
          const { update, record } = apply(account);

          // c. 乐观锁更新：WHERE id AND version = account.version
          const result = await manager.update(
            TokenAccount,
            { id: account.id, version: account.version },
            { ...update, version: account.version + 1 },
          );
          if (!result.affected || result.affected === 0) {
            // 版本冲突，抛哨兵错误触发事务回滚并重试
            throw new OptimisticLockConflictError();
          }

          // d. 写入流水
          const tokenRecord = manager.create(TokenRecord, {
            userId,
            accountId: account.id,
            amount: record.amount,
            type: record.type,
            bizType: record.bizType,
            bizId: record.bizId,
            balanceAfter: record.balanceAfter,
            idempotencyKey,
            remark: record.remark,
          });
          return manager.save(tokenRecord);
        });
      } catch (err) {
        // 3a. 乐观锁冲突 → 重试
        if (err instanceof OptimisticLockConflictError) {
          if (attempt < BillingService.MAX_OPTIMISTIC_RETRIES) {
            this.logger.warn(
              `乐观锁冲突，即将进行第 ${attempt + 1} 次重试（userId=${userId}）`,
            );
            continue;
          }
          throw new InternalServerErrorException({
            code: ErrorCodes.INTERNAL_ERROR,
            message: '账户并发更新冲突，重试次数耗尽',
          });
        }

        // 3b. 幂等键唯一冲突 → 并发重复，回查既有流水返回
        if (this.isUniqueViolation(err)) {
          const existedRecord = await this.tokenRecordRepository.findOne({
            where: { idempotencyKey },
          });
          if (existedRecord) {
            this.logger.warn(
              `并发写入导致幂等键冲突，返回既有流水：${idempotencyKey}`,
            );
            return existedRecord;
          }
        }

        // 3c. 其它异常直接抛出（如余额不足、账户不存在等）
        throw err;
      }
    }

    // 理论不可达：重试耗尽已在循环内抛出
    throw new InternalServerErrorException({
      code: ErrorCodes.INTERNAL_ERROR,
      message: '账户并发更新冲突',
    });
  }

  /**
   * 判断异常是否为唯一约束冲突（PostgreSQL error code 23505）
   * 用于识别幂等键重复等并发场景
   */
  private isUniqueViolation(err: unknown): boolean {
    if (err instanceof QueryFailedError) {
      const driverErr = (
        err as unknown as { driverError?: { code?: string } }
      ).driverError;
      const code =
        driverErr?.code ??
        (err as unknown as { code?: string }).code;
      return code === '23505';
    }
    return false;
  }
}
