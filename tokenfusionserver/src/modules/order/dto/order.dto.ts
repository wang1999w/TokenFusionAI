import { IsInt, IsString, IsIn, Min } from 'class-validator';
import { PayChannel } from '../entities/order.entity';

/**
 * 创建支付订单请求 DTO
 * 用于 POST /orders/checkout 接口
 *
 * 注意：属性由 class-validator / NestJS 管道在运行时根据请求体填充，
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
export class CreateCheckoutDto {
  /** 套餐 ID */
  @IsInt()
  @Min(1, { message: '套餐 ID 非法' })
  planId!: number;

  /** 支付渠道：stripe / paypal */
  @IsString()
  @IsIn([PayChannel.STRIPE, PayChannel.PAYPAL], {
    message: '支付渠道仅支持 stripe 或 paypal',
  })
  payChannel!: PayChannel;
}
