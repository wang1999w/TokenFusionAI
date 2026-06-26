import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 璁惧缁戝畾瀹炰綋
 * 璁板綍鐢ㄦ埛鐧诲綍鐨勮澶囦俊鎭紝鐢ㄤ簬澶氳澶囩鐞嗕笌鍏嶇櫥棰濆害
 */
@Entity('device_binds')
export class DeviceBind {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Index()
  @Column({ name: 'device_id', type: 'varchar', length: 128, unique: true })
  deviceId!: string;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null;

  @Column({ type: 'text', nullable: true })
  fingerprint!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'datetime', name: 'first_seen', default: () => 'CURRENT_TIMESTAMP' })
  firstSeen!: Date;

  @UpdateDateColumn({ name: 'last_seen',  })
  lastSeen!: Date;
}
