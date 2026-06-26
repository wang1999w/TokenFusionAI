import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { TokenAccount } from '../billing/entities/token-account.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

/**
 * 鐢ㄦ埛瑙掕壊鏋氫妇
 */
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  PAID = 'paid',
  DEVELOPER = 'developer',
  ADMIN = 'admin',
}

/**
 * 鐢ㄦ埛鐘舵€佹灇涓? */
export enum UserStatus {
  ACTIVE = 1,
  BANNED = 0,
  PENDING = 2,
}

/**
 * 鐢ㄦ埛涓昏〃瀹炰綋
 * 瀛樺偍鐢ㄦ埛鍩烘湰淇℃伅銆佽鑹层€侀個璇峰叧绯荤瓑
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'varchar', unique: true, default: () => "(lower(hex(randomblob(16))))" })
  uuid!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'smallint', default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ type: 'varchar', length: 32, default: UserRole.USER })
  role!: UserRole;

  @Column({ name: 'nickname', type: 'varchar', length: 64, nullable: true })
  nickname!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true })
  avatarUrl!: string | null;

  @Index()
  @Column({ name: 'invite_code', type: 'varchar', length: 16, unique: true })
  inviteCode!: string;

  @Column({ name: 'inviter_id', type: 'integer', nullable: true })
  inviterId!: number | null;

  @Column({ type: 'datetime', name: 'last_login_at', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'last_login_ip', type: 'varchar', nullable: true })
  lastLoginIp!: string | null;

  @CreateDateColumn({ name: 'created_at',  })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at',  })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;

  // 鍏宠仈鍏崇郴
  @OneToOne(() => TokenAccount, (account) => account.user)
  tokenAccount!: TokenAccount;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens!: RefreshToken[];
}
