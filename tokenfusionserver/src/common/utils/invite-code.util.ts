/**
 * 邀请码生成工具
 * 生成 8 位唯一邀请码（大写字母 + 数字）
 */
export class InviteCodeUtil {
  private static readonly CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  private static readonly LENGTH = 8;

  /**
   * 生成随机邀请码
   * 排除易混淆字符（0/O, 1/I）
   */
  static generate(): string {
    let code = '';
    for (let i = 0; i < this.LENGTH; i++) {
      const idx = Math.floor(Math.random() * this.CHARSET.length);
      code += this.CHARSET[idx];
    }
    return code;
  }
}
