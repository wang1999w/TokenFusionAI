import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

/**
 * 密码加密工具
 * 使用 bcrypt 进行密码哈希与校验
 */
export class CryptoUtil {
  private static readonly SALT_ROUNDS = 12;

  /**
   * 加密密码（bcrypt 哈希）
   * @param password 明文密码
   * @returns 哈希后的密码
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * 校验密码是否匹配
   * @param password 明文密码
   * @param hash 哈希密码
   * @returns 是否匹配
   */
  static async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 生成 token 的 SHA256 哈希
   * 用于存储 refresh_token 的哈希值，不存明文
   * @param token 原始 token
   * @returns SHA256 哈希
   */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * 生成随机 token（用于 refresh_token / 邮箱验证 / 密码重置）
   * @param bytes 字节数，默认 32
   * @returns base64url 编码的随机字符串
   */
  static generateToken(bytes: number = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /**
   * 生成 6 位数字验证码
   * 用于邮箱验证码
   */
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
