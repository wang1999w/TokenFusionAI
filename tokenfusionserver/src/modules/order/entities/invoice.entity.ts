import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

/**
 * 发票状态枚举
 * - issued: 已开具
 * - void: 已作废
 */
export enum InvoiceStatus {
  ISSUED = 'issued',
  VOID = 'void',
}

/**
 * 发票实体
 * 订单支付成功后生成，记录发票编号、金额及 PDF 下载地址
 *
 * 注意：实体属性由 TypeORM 在运行时通过装饰器反射注入（如查询结果回填），
 * 因此使用 ! 定型断言声明"由框架赋值"，以兼容 strictPropertyInitialization。
 */
@Entity('invoices')
export class Invoice {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  /** 发票所属用户 ID */
  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  /**
   * 关联的订单 ID
   * 订阅周期续费产生的发票无对应订单（直接由订阅触发），故可为空
   */
  @Column({ name: 'order_id', type: 'bigint', nullable: true })
  orderId!: number | null;

  /** 关联的订单（订阅续费发票时为 null） */
  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order!: Order | null;

  /** 发票编号（唯一），如 INV20240627xxxx */
  @Index({ unique: true })
  @Column({ name: 'invoice_no', type: 'varchar', length: 32, unique: true })
  invoiceNo!: string;

  /** 发票金额（单位：分） */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  /** 发票 PDF 下载地址（由第三方生成或本地生成后存储） */
  @Column({ name: 'pdf_url', type: 'varchar', length: 512, nullable: true })
  pdfUrl!: string | null;

  /** 发票状态：issued / void */
  @Column({ type: 'varchar', length: 16, default: InvoiceStatus.ISSUED })
  status!: InvoiceStatus;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
