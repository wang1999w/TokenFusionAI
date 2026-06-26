/**
 * 临时邮箱域名检测工具
 * 拦截临时邮箱注册（前端 + 后端双校验）
 */
export class TempEmailUtil {
  /**
   * 常见临时邮箱域名黑名单
   */
  private static readonly TEMP_DOMAINS: ReadonlySet<string> = new Set([
    '10minutemail.com',
    'tempmail.com',
    'tempmail.io',
    'guerrillamail.com',
    'mailinator.com',
    'throwawaymail.com',
    'getnada.com',
    'temp-mail.org',
    'yopmail.com',
    'sharklasers.com',
    'guerrillamail.info',
    'grr.la',
    'dispostable.com',
    'maildrop.cc',
    'fakeinbox.com',
    'mailnesia.com',
    'mailcatch.com',
    'tempinbox.com',
    'mintemail.com',
    'tempr.email',
    'burnermail.io',
    'moakt.com',
    'tmpmail.org',
    'tmpmail.net',
    'emailondeck.com',
    'trashmail.com',
    'trashmail.net',
    'mytemp.email',
    'tempemail.com',
    'tempemail.net',
    'disposablemail.com',
    'mailtemp.top',
    'tempmailo.com',
  ]);

  /**
   * 检测邮箱是否使用临时域名
   * @param email 邮箱地址
   * @returns 是否为临时邮箱
   */
  static isTempEmail(email: string): boolean {
    const domain = email.toLowerCase().split('@')[1]?.trim();
    if (!domain) return false;

    // 直接命中黑名单
    if (this.TEMP_DOMAINS.has(domain)) return true;

    // 检测常见临时邮箱关键词
    const tempKeywords = ['temp', 'throw', 'disposable', 'trash', 'fake', 'tmp'];
    return tempKeywords.some((keyword) => domain.includes(keyword));
  }
}
