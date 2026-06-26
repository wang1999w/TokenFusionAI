import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 鍏嶈垂棰濆害鍙戞斁鍦烘櫙鏋氫妇
 * - register        娉ㄥ唽璧犻
 * - invite_first     棣栨閭€璇锋垚鍔熻禒棰? * - first_recharge   棣栧厖璧犻
 * - daily_device     姣忔棩璁惧璧犻
 */
export enum FreeQuotaScene {
  REGISTER = 'register',
  INVITE_FIRST = 'invite_first',
  FIRST_RECHARGE = 'first_recharge',
  DAILY_DEVICE = 'daily_device',
}

/**
 * 鍏嶈垂棰濆害瑙勫垯瀹炰綋
 * 瀹氫箟鍚勫満鏅笅璧犻€佺殑 Token 鏁伴噺鍙婂惎鐢ㄧ姸鎬? *
 * 鍚屼竴 scene 鍏ㄥ眬鍞竴锛岄伩鍏嶅嚭鐜伴噸澶嶈鍒欍€? * 杩愯惀鍙湪璇ヨ〃閰嶇疆涓嶅悓鍦烘櫙鐨勮禒棰濋搴︼紝涓氬姟渚ф寜 scene 璇诲彇瑙勫垯鍚庤皟鐢ㄨ璐规湇鍔＄殑璧犻鎺ュ彛銆? *
 * 娉細灞炴€т娇鐢?`!`锛堢‘瀹氭€ц祴鍊兼柇瑷€锛夛紝琛ㄧず杩欎簺瀛楁鐢?TypeORM 鍦ㄦ煡璇㈡椂鑷姩濉厖锛? * 鏃犻渶鍦ㄦ瀯閫犳椂鍒濆鍖栵紙婊¤冻 strictPropertyInitialization 妫€鏌ワ級銆? */
@Entity('free_quota_rules')
@Index('idx_free_quota_rules_scene', ['scene'], { unique: true })
export class FreeQuotaRule {
  /** 瑙勫垯鑷涓婚敭 */
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  /** 璧犻鍦烘櫙 */
  @Column({ type: 'varchar', length: 32 })
  scene!: FreeQuotaScene;

  /** 璧犻€?Token 鏁伴噺 */
  @Column({ type: 'integer' })
  amount!: number;

  /** 鏄惁鍚敤 */
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** 鍒涘缓鏃堕棿 */
  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
