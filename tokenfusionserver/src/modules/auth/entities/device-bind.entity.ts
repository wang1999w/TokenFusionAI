import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 设备绑定实体
 * 记录用户登录的设备信息，用于多设备管理与免登额度
 */
@Entity('device_binds')
export class DeviceBind {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'device_id', type: 'varchar', length: 128, unique: true })
  deviceId: string;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId: number | null;

  @Column({ type: 'text', nullable: true })
  fingerprint: string | null;

  @Column({ type: 'inet', nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'first_seen', type: 'timestamptz', default: () => 'NOW()' })
  firstSeen: Date;

  @UpdateDateColumn({ name: 'last_seen', type: 'timestamptz' })
  lastSeen: Date;
}
