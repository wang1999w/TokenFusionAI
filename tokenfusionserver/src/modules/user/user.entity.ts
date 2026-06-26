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
import { TokenAccount } from '../../billing/entities/token-account.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

/**
 * 用户角色枚举
 */
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  PAID = 'paid',
  DEVELOPER = 'developer',
  ADMIN = 'admin',
}

/**
 * 用户状态枚举
 */
export enum UserStatus {
  ACTIVE = 1,
  BANNED = 0,
  PENDING = 2,
}

/**
 * 用户主表实体
 * 存储用户基本信息、角色、邀请关系等
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
  uuid: string;

  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'smallint', default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'varchar', length: 32, default: UserRole.USER })
  role: UserRole;

  @Column({ name: 'nickname', type: 'varchar', length: 64, nullable: true })
  nickname: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true })
  avatarUrl: string | null;

  @Index()
  @Column({ name: 'invite_code', type: 'varchar', length: 16, unique: true })
  inviteCode: string;

  @Column({ name: 'inviter_id', type: 'bigint', nullable: true })
  inviterId: number | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'last_login_ip', type: 'inet', nullable: true })
  lastLoginIp: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // 关联关系
  @OneToOne(() => TokenAccount, (account) => account.user)
  tokenAccount: TokenAccount;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];
}
