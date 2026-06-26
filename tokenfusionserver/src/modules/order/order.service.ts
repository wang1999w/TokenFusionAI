import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Plan } from './entities/plan.entity';
import {
  Order,
  OrderStatus,
  PayChannel,
  PayMode,
} from './entities/order.entity';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { BillingService } from '../billing/billing.service';

/**
 * 订单服务
 * 处理套餐查询、订单创建与查询、支付成功回调处理、订阅取消等核心业务
 *
 * 依赖关系（避免循环依赖）：
 * - OrderService → BillingService（支付成功后充值 Token）
 * - 支付服务（Stripe/PayPal）→ OrderService（Webhook 回调时调用 handlePaymentSuccess）
 * - 控制器负责编排"创建订单 + 调用支付服务创建支付会话"及"取消订阅时先取消第三方再更新本地"
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly dataSource: DataSource,
    private readonly billingService: BillingService,
  ) {}

  /**
   * 获取已启用的套餐列表
   * 按 sort_order 升序排列，前端用于展示定价表
   */
  async getPlans(): Promise<Plan[]> {
    return this.planRepository.find({
      where: { enabled: true },
      order: { sortOrder: 'ASC' },
    });
  }

  /**
   * 根据套餐 ID 查询套餐（含未启用的，供内部使用）
   */
  async getPlanById(planId: number): Promise<Plan | null> {
    return this.planRepository.findOne({ where: { id: planId } });
  }

  /**
   * 创建订单
   * 1. 校验套餐存在且已启用
   * 2. 校验支付渠道合法
   * 3. 根据套餐类型决定支付模式（one_time/subscription）
   * 4. 生成唯一业务订单号
   * 5. 写入订单（状态 pending）
   *
   * @param userId     用户 ID
   * @param planId     套餐 ID
   * @param payChannel 支付渠道 stripe / paypal
   * @returns 新建的 pending 订单
   */
  async createOrder(
    userId: number,
    planId: number,
    payChannel: PayChannel,
  ): Promise<Order> {
    // 校验支付渠道
    if (!Object.values(PayChannel).includes(payChannel)) {
      throw new BadRequestException('不支持的支付渠道');
    }

    // 查询套餐
    const plan = await this.planRepository.findOne({
      where: { id: planId, enabled: true },
    });
    if (!plan) {
      throw new NotFoundException('套餐不存在或已下架');
    }

    // 根据套餐计费类型决定支付模式
    const payMode =
      plan.type === ('subscription' as string)
        ? PayMode.SUBSCRIPTION
        : PayMode.ONE_TIME;

    // 生成唯一订单号
    const orderNo = await this.generateUniqueOrderNo();

    // 创建订单
    const order = this.orderRepository.create({
      orderNo,
      userId,
      planId: plan.id,
      amountCents: plan.priceCents,
      currency: plan.currency,
      tokenAmount: plan.tokenAmount,
      payChannel,
      payMode,
      status: OrderStatus.PENDING,
    });

    const saved = await this.orderRepository.save(order);
    this.logger.log(
      `创建订单：${orderNo}，用户 ${userId}，套餐 ${plan.code}，渠道 ${payChannel}`,
    );
    return saved;
  }

  /**
   * 根据订单号查询订单（供 Webhook 回调使用）
   */
  async findByOrderNo(orderNo: string): Promise<Order | null> {
    return this.orderRepository.findOne({ where: { orderNo } });
  }

  /**
   * 查询订单详情（按 ID，并校验归属用户）
   */
  async getOrderById(userId: number, orderId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['plan', 'subscription'],
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return order;
  }

  /**
   * 订单列表（分页）
   *
   * @param userId 用户 ID
   * @param page   页码（从 1 开始）
   * @param limit  每页数量
   */
  async getOrders(
    userId: number,
    page: number,
    limit: number,
  ): Promise<{
    items: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const [items, total] = await this.orderRepository.findAndCount({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return { items, total, page: safePage, limit: safeLimit };
  }

  /**
   * 支付成功处理
   * 由支付服务在 Webhook 确认支付成功后调用
   * 1. 幂等校验：订单状态非 pending 则跳过（防止重复处理）
   * 2. 事务内更新订单状态为 paid、记录支付时间与交易号、生成发票
   * 3. 调用 BillingService 充值 Token
   *
   * @param orderId       订单 ID
   * @param transactionId 第三方交易号
   */
  async handlePaymentSuccess(
    orderId: number,
    transactionId: string,
  ): Promise<void> {
    // 查询订单
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(`支付成功回调：订单 ${orderId} 不存在`);
      throw new NotFoundException('订单不存在');
    }

    // 幂等：已支付/已退款则直接返回，避免重复充值
    if (order.status === OrderStatus.PAID) {
      this.logger.log(`订单 ${order.orderNo} 已是已支付状态，跳过重复处理`);
      return;
    }
    if (order.status !== OrderStatus.PENDING) {
      this.logger.warn(
        `订单 ${order.orderNo} 状态为 ${order.status}，不可标记为已支付`,
      );
      return;
    }

    // 事务：更新订单状态 + 生成发票
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 乐观更新：仅当状态仍为 pending 时才置为 paid（并发幂等）
      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(Order)
        .set({
          status: OrderStatus.PAID,
          paidAt: new Date(),
          transactionId: transactionId || order.transactionId,
        })
        .where('id = :id AND status = :pending', {
          id: orderId,
          pending: OrderStatus.PENDING,
        })
        .execute();

      // 并发情况下已被处理，直接返回
      if (!updateResult.affected || updateResult.affected === 0) {
        await queryRunner.commitTransaction();
        this.logger.log(`订单 ${order.orderNo} 已被并发处理，跳过`);
        return;
      }

      // 生成发票
      const invoiceNo = await this.generateUniqueInvoiceNo();
      const invoice = queryRunner.manager.create(Invoice, {
        userId: order.userId,
        orderId: order.id,
        invoiceNo,
        amountCents: order.amountCents,
        status: InvoiceStatus.ISSUED,
        pdfUrl: null,
      });
      await queryRunner.manager.save(invoice);

      await queryRunner.commitTransaction();
      this.logger.log(
        `订单 ${order.orderNo} 已标记为已支付，发票 ${invoiceNo} 已生成`,
      );
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `支付成功处理失败：订单 ${order.orderNo}`,
        (err as Error)?.stack,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }

    // 充值 Token（在事务外执行，BillingService 内部使用乐观锁重试 + 幂等键防重）
    try {
      // 确保账户存在（首次充值或注册未建账户时兜底创建，幂等）
      await this.billingService.createAccount(order.userId);
      // 充值：使用订单号作为业务标识，幂等键基于订单 ID 防止重复充值
      await this.billingService.rechargeTokens(
        order.userId,
        Number(order.tokenAmount),
        order.orderNo,
        `recharge:order:${order.id}`,
      );
      this.logger.log(
        `已为用户 ${order.userId} 充值 ${order.tokenAmount} tokens（订单 ${order.orderNo}）`,
      );
    } catch (err) {
      // 充值失败不影响订单状态，记录日志供人工对账
      this.logger.error(
        `订单 ${order.orderNo} 充值失败，需人工对账`,
        (err as Error)?.stack,
      );
    }
  }

  /**
   * 取消订阅（本地状态更新）
   * 标记订阅为"周期结束时取消"，并将状态置为 cancelled
   *
   * 注意：第三方订阅的实际取消由控制器调用对应支付服务完成，
   * 本方法仅负责本地订阅状态更新，保证调用顺序为"先第三方、后本地"
   *
   * @param userId         用户 ID
   * @param subscriptionId 订阅 ID
   */
  async cancelSubscription(
    userId: number,
    subscriptionId: number,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId },
    });
    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      this.logger.log(`订阅 ${subscriptionId} 已取消，跳过`);
      return subscription;
    }

    // 标记为周期结束取消 + 状态置为 cancelled
    subscription.cancelAtPeriodEnd = true;
    subscription.status = SubscriptionStatus.CANCELLED;
    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(`用户 ${userId} 取消订阅 ${subscriptionId}`);
    return saved;
  }

  /**
   * 查询订阅及其支付渠道（供控制器编排"取消订阅"使用）
   * 通过关联的订单获取支付渠道，以决定调用 Stripe 还是 PayPal 取消
   *
   * @param userId         用户 ID
   * @param subscriptionId 订阅 ID
   */
  async getSubscriptionWithChannel(
    userId: number,
    subscriptionId: number,
  ): Promise<{ subscription: Subscription; channel: PayChannel | null }> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId },
    });
    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    // 通过关联订单确定支付渠道（取最近一笔关联订单）
    const order = await this.orderRepository.findOne({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
    });

    return {
      subscription,
      channel: order ? order.payChannel : null,
    };
  }

  /**
   * 查询发票详情（按 ID，并校验归属用户）
   * 用于发票下载接口
   *
   * @param userId    用户 ID
   * @param invoiceId 发票 ID
   */
  async getInvoiceById(userId: number, invoiceId: number): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, userId },
      relations: ['order'],
    });
    if (!invoice) {
      throw new NotFoundException('发票不存在');
    }
    return invoice;
  }

  /**
   * 生成唯一订单号
   * 格式：ORD + YYYYMMDD + 6 位随机数字，共 17 位（满足 varchar32）
   * 生成后查重，确保唯一
   */
  private async generateUniqueOrderNo(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const orderNo = this.generateOrderNo();
      const exists = await this.orderRepository.findOne({
        where: { orderNo },
        select: ['id'],
      });
      if (!exists) return orderNo;
    }
    // 极端情况下仍冲突，使用时间戳兜底
    return this.generateOrderNo();
  }

  private generateOrderNo(): string {
    const now = new Date();
    const ymd =
      `${now.getFullYear()}` +
      `${String(now.getMonth() + 1).padStart(2, '0')}` +
      `${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `ORD${ymd}${rand}`;
  }

  /**
   * 生成唯一发票号
   * 格式：INV + YYYYMMDD + 6 位随机数字
   */
  private async generateUniqueInvoiceNo(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const now = new Date();
      const ymd =
        `${now.getFullYear()}` +
        `${String(now.getMonth() + 1).padStart(2, '0')}` +
        `${String(now.getDate()).padStart(2, '0')}`;
      const rand = Math.floor(100000 + Math.random() * 900000);
      const invoiceNo = `INV${ymd}${rand}`;
      const exists = await this.invoiceRepository.findOne({
        where: { invoiceNo },
        select: ['id'],
      });
      if (!exists) return invoiceNo;
    }
    return `INV${Date.now()}`;
  }
}
