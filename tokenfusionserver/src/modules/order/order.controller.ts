import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import { OrderService } from './order.service';
import { StripeService } from './payment/stripe.service';
import { PaypalService } from './payment/paypal.service';
import { CreateCheckoutDto } from './dto/order.dto';
import { PayChannel } from './entities/order.entity';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * 订单与支付控制器
 * 路由分布：
 * - GET    /plans              套餐列表（公开）
 * - POST   /orders/checkout    创建支付订单（鉴权）
 * - GET    /orders/:id         订单详情（鉴权）
 * - GET    /orders             订单列表（鉴权）
 * - POST   /orders/:id/cancel  取消订阅（鉴权）
 * - GET    /invoices/:id/download 发票下载（鉴权）
 * - POST   /webhooks/stripe    Stripe 回调（公开）
 * - POST   /webhooks/paypal    PayPal 回调（公开）
 *
 * 说明：控制器负责编排"创建订单 + 创建支付会话"及"取消订阅时先取消第三方再更新本地"，
 * 避免在 OrderService 与支付服务之间形成循环依赖。
 */
@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly stripeService: StripeService,
    private readonly paypalService: PaypalService,
  ) {}

  /**
   * 套餐列表（公开接口，无需鉴权）
   * 供前端定价页展示
   */
  @Public()
  @Get('plans')
  async getPlans() {
    return this.orderService.getPlans();
  }

  /**
   * 创建支付订单（需鉴权）
   * 1. 创建 pending 订单
   * 2. 根据支付渠道调用对应支付服务创建支付会话
   * 3. 返回订单与支付跳转信息
   */
  @Post('orders/checkout')
  async createCheckout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCheckoutDto,
  ) {
    // 创建 pending 订单
    const order = await this.orderService.createOrder(
      user.sub,
      dto.planId,
      dto.payChannel,
    );

    // 根据支付渠道创建支付会话
    let checkout: { sessionId: string; checkoutUrl: string; mode: string };
    if (dto.payChannel === PayChannel.STRIPE) {
      checkout = await this.stripeService.createCheckoutSession(order);
    } else {
      checkout = await this.paypalService.createCheckoutSession(order);
    }

    return {
      order,
      checkout,
    };
  }

  /**
   * 订单详情（需鉴权）
   */
  @Get('orders/:id')
  async getOrderById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.getOrderById(user.sub, id);
  }

  /**
   * 订单列表（需鉴权，分页）
   */
  @Get('orders')
  async getOrders(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.getOrders(
      user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * 取消订阅（需鉴权）
   * :id 为订单 ID，通过订单关联的订阅进行取消
   * 流程：先调用第三方取消订阅，再更新本地订阅状态
   */
  @Post('orders/:id/cancel')
  async cancelSubscription(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // 查询订单并校验归属
    const order = await this.orderService.getOrderById(user.sub, id);
    if (!order.subscriptionId) {
      throw new BadRequestException('该订单不是订阅订单，无法取消');
    }

    // 获取订阅与其支付渠道
    const { subscription, channel } =
      await this.orderService.getSubscriptionWithChannel(
        user.sub,
        order.subscriptionId,
      );

    // 先在第三方平台取消订阅（避免继续扣费）
    if (channel === PayChannel.STRIPE) {
      await this.stripeService.cancelSubscription(subscription.externalSubId);
    } else if (channel === PayChannel.PAYPAL) {
      await this.paypalService.cancelSubscription(subscription.externalSubId);
    }

    // 再更新本地订阅状态
    await this.orderService.cancelSubscription(user.sub, order.subscriptionId);

    return { message: '订阅已取消', subscriptionId: subscription.id };
  }

  /**
   * 发票下载（需鉴权）
   * 返回发票信息与 PDF 下载地址（由前端打开下载）
   */
  @Get('invoices/:id/download')
  async downloadInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const invoice = await this.orderService.getInvoiceById(user.sub, id);
    return {
      invoiceNo: invoice.invoiceNo,
      amountCents: invoice.amountCents,
      status: invoice.status,
      pdfUrl: invoice.pdfUrl,
      createdAt: invoice.createdAt,
      message: invoice.pdfUrl
        ? '请通过 pdfUrl 下载发票'
        : '发票 PDF 暂未生成',
    };
  }

  /**
   * Stripe Webhook 回调（公开接口）
   * 需要 Stripe 原始请求体（rawBody）进行签名校验
   */
  @Public()
  @Post('webhooks/stripe')
  async stripeWebhook(@Req() req: RawBodyRequest<Request>) {
    // rawBody 由 NestJS rawBody 选项提供（已在 main.ts 中开启 rawBody: true）
    const rawBody = req.rawBody;
    const signature = req.headers['stripe-signature'] as string;

    if (!rawBody || !signature) {
      throw new BadRequestException('缺少 Stripe 回调原始体或签名');
    }

    return this.stripeService.handleWebhook(rawBody, signature);
  }

  /**
   * PayPal Webhook 回调（公开接口）
   * 使用请求头与已解析的请求体进行签名校验
   */
  @Public()
  @Post('webhooks/paypal')
  async paypalWebhook(@Req() req: Request) {
    const headers = req.headers as unknown as Record<string, string>;
    const body = req.body as Record<string, any>;

    if (!body || !body.event_type) {
      throw new BadRequestException('无效的 PayPal 回调请求体');
    }

    return this.paypalService.handleWebhook(headers, body);
  }
}
