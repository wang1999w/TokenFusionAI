import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';

/**
 * 鍒锋柊浠ょ墝瀹炰綋
 * 鏀寔澶氳澶囩櫥褰曚笌浠ょ墝鍚婇攢
 * 姣忎釜 refresh_token 鍝堝笇瀛樺偍锛屼笉瀛樻槑鏂? */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @ManyToOne(() => User, (user) => user.refreshTokens)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 128, nullable: true })
  deviceId!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip!: string | null;

  @Column({ type: 'datetime', name: 'expires_at',  })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;
}
