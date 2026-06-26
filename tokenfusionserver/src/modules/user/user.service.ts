import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole, UserStatus } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { InviteCodeUtil } from '../../common/utils/invite-code.util';
import { TempEmailUtil } from '../../common/utils/temp-email.util';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * 用户服务
 * 处理用户注册、查询、信息修改等核心业务逻辑
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 注册新用户
   * 1. 校验邮箱是否为临时邮箱
   * 2. 校验邮箱是否已注册
   * 3. 校验邀请码是否有效
   * 4. 生成唯一邀请码
   * 5. 加密密码
   * 6. 写入数据库
   */
  async register(dto: RegisterDto): Promise<User> {
    // 拦截临时邮箱
    if (TempEmailUtil.isTempEmail(dto.email)) {
      throw new BadRequestException({
        code: ErrorCodes.TEMP_EMAIL_BLOCKED,
        message: '不支持临时邮箱注册，请使用有效邮箱',
      });
    }

    // 校验邮箱是否已注册
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
      select: ['id'],
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.EMAIL_ALREADY_EXISTS,
        message: '该邮箱已注册',
      });
    }

    // 校验邀请码
    let inviterId: number | null = null;
    if (dto.inviteCode) {
      const inviter = await this.userRepository.findOne({
        where: { inviteCode: dto.inviteCode },
        select: ['id'],
      });
      if (!inviter) {
        throw new BadRequestException({
          code: ErrorCodes.PARAM_INVALID,
          message: '邀请码无效',
        });
      }
      inviterId = inviter.id;
    }

    // 生成唯一邀请码（循环直到生成不重复的）
    let inviteCode = InviteCodeUtil.generate();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await this.userRepository.findOne({
        where: { inviteCode },
        select: ['id'],
      });
      if (!exists) break;
      inviteCode = InviteCodeUtil.generate();
      attempts++;
    }

    // 加密密码
    const passwordHash = await CryptoUtil.hashPassword(dto.password);

    // 创建用户记录
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      nickname: dto.nickname || dto.email.split('@')[0],
      inviteCode,
      inviterId,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });

    const saved = await this.userRepository.save(user);
    this.logger.log(`新用户注册成功：${saved.email}（ID: ${saved.id}）`);

    return saved;
  }

  /**
   * 根据邮箱查询用户（含密码哈希，用于登录校验）
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * 根据 ID 查询用户
   */
  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'uuid',
        'email',
        'emailVerified',
        'status',
        'role',
        'nickname',
        'avatarUrl',
        'inviteCode',
        'inviterId',
        'lastLoginAt',
        'createdAt',
      ],
    });
  }

  /**
   * 根据邮箱查询用户（含密码哈希，用于登录校验）
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email: email.toLowerCase().trim() })
      .addSelect('user.passwordHash')
      .getOne();
  }

  /**
   * 更新用户最后登录信息
   */
  async updateLastLogin(id: number, ip: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });
  }

  /**
   * 标记邮箱已验证
   */
  async markEmailVerified(id: number): Promise<void> {
    await this.userRepository.update(id, { emailVerified: true });
  }

  /**
   * 更新用户密码
   */
  async updatePassword(id: number, password: string): Promise<void> {
    const passwordHash = await CryptoUtil.hashPassword(password);
    await this.userRepository.update(id, { passwordHash });
  }

  /**
   * 更新用户资料
   */
  async updateProfile(
    id: number,
    updates: { nickname?: string; avatarUrl?: string },
  ): Promise<void> {
    await this.userRepository.update(id, updates);
  }
}
