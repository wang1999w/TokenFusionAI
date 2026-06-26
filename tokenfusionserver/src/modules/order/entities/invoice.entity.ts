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
 * 鍙戠エ鐘舵€佹灇涓? * - issued: 宸插紑鍏? * - void: 宸蹭綔搴? */
export enum InvoiceStatus {
  ISSUED = 'issued',
  VOID = 'void',
}

/**
 * 鍙戠エ瀹炰綋
 * 璁㈠崟鏀粯鎴愬姛鍚庣敓鎴愶紝璁板綍鍙戠エ缂栧彿銆侀噾棰濆強 PDF 涓嬭浇鍦板潃
 *
 * 娉ㄦ剰锛氬疄浣撳睘鎬х敱 TypeORM 鍦ㄨ繍琛屾椂閫氳繃瑁呴グ鍣ㄥ弽灏勬敞鍏ワ紙濡傛煡璇㈢粨鏋滃洖濉級锛? * 鍥犳浣跨敤 ! 瀹氬瀷鏂█澹版槑"鐢辨鏋惰祴鍊?锛屼互鍏煎 strictPropertyInitialization銆? */
@Entity('invoices')
export class Invoice {
  /** 涓婚敭 ID */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 鍙戠エ鎵€灞炵敤鎴?ID */
  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  /**
   * 鍏宠仈鐨勮鍗?ID
   * 璁㈤槄鍛ㄦ湡缁垂浜х敓鐨勫彂绁ㄦ棤瀵瑰簲璁㈠崟锛堢洿鎺ョ敱璁㈤槄瑙﹀彂锛夛紝鏁呭彲涓虹┖
   */
  @Column({ name: 'order_id', type: 'integer', nullable: true })
  orderId!: number | null;

  /** 鍏宠仈鐨勮鍗曪紙璁㈤槄缁垂鍙戠エ鏃朵负 null锛?*/
  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order!: Order | null;

  /** 鍙戠エ缂栧彿锛堝敮涓€锛夛紝濡?INV20240627xxxx */
  @Index({ unique: true })
  @Column({ name: 'invoice_no', type: 'varchar', length: 32, unique: true })
  invoiceNo!: string;

  /** 鍙戠エ閲戦锛堝崟浣嶏細鍒嗭級 */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  /** 鍙戠エ PDF 涓嬭浇鍦板潃锛堢敱绗笁鏂圭敓鎴愭垨鏈湴鐢熸垚鍚庡瓨鍌級 */
  @Column({ name: 'pdf_url', type: 'varchar', length: 512, nullable: true })
  pdfUrl!: string | null;

  /** 鍙戠エ鐘舵€侊細issued / void */
  @Column({ type: 'varchar', length: 16, default: InvoiceStatus.ISSUED })
  status!: InvoiceStatus;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
