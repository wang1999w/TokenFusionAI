import { z } from 'zod';

/**
 * 表单校验 Schema 集合
 *
 * 本文件定义登录、注册、找回密码三个表单的 Zod 校验规则，
 * 并提供临时邮箱检测与密码强度计算工具函数。
 *
 * 校验规则与后端 DTO 保持一致：
 *  - 登录：tokenfusionserver/src/modules/auth/dto/login.dto.ts
 *  - 注册：tokenfusionserver/src/modules/user/dto/register.dto.ts
 *  - 找回密码：tokenfusionserver/src/modules/auth/dto/forgot-password.dto.ts
 *
 * 注意：所有 error message 均使用 next-intl 的相对 key 路径（如 'errors.emailRequired'），
 * 组件中通过 useTranslations('auth') 调用 t(error.message) 即可解析为对应语言的文案。
 */

/* -------------------------------------------------------------------------- */
/*                           临时邮箱域名黑名单（与后端同步）                    */
/* -------------------------------------------------------------------------- */

/**
 * 常见临时邮箱域名黑名单
 * 与后端 tokenfusionserver/src/common/utils/temp-email.util.ts 中的 TEMP_DOMAINS 完全同步
 * 前后端双校验，防止用户绕过前端校验直接调用后端接口
 */
const TEMP_DOMAINS: ReadonlySet<string> = new Set([
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
 * 逻辑与后端 TempEmailUtil.isTempEmail 完全一致：
 *  1. 提取邮箱域名（小写、去空格）
 *  2. 直接命中黑名单 → 判定为临时邮箱
 *  3. 域名包含常见临时邮箱关键词 → 判定为临时邮箱
 *
 * @param email 邮箱地址
 * @returns 是否为临时邮箱
 */
export function isTempEmail(email: string): boolean {
  // 提取 @ 后的域名部分并标准化
  const domain = email.toLowerCase().split('@')[1]?.trim();
  if (!domain) return false;

  // 直接命中黑名单
  if (TEMP_DOMAINS.has(domain)) return true;

  // 检测常见临时邮箱关键词（与后端 tempKeywords 保持一致）
  const tempKeywords = ['temp', 'throw', 'disposable', 'trash', 'fake', 'tmp'];
  return tempKeywords.some((keyword) => domain.includes(keyword));
}

/* -------------------------------------------------------------------------- */
/*                              通用字段校验规则                                 */
/* -------------------------------------------------------------------------- */

/**
 * 邮箱字段校验规则
 * - 非空：errors.emailRequired
 * - 格式校验：errors.emailInvalid
 * 与后端 @IsEmail 装饰器对应
 *
 * 注意：此处不使用 .transform() 进行小写/去空格转换，
 * 以避免与 react-hook-form 的 input/output 类型不一致问题。
 * 大小写归一化在表单 onSubmit 中手动处理（与后端 @Transform 行为一致）。
 */
const emailField = z.string().min(1, 'errors.emailRequired').email('errors.emailInvalid');

/**
 * 密码字段校验规则（用于注册场景，规则较严格）
 * - 非空：errors.passwordRequired
 * - 最少 8 位：errors.passwordTooShort（与后端 @MinLength(8) 一致）
 * - 最多 64 位（与后端 @MaxLength(64) 一致）
 * - 必须包含字母和数字：errors.passwordWeak（与后端 @Matches 正则一致）
 */
const passwordField = z
  .string()
  .min(1, 'errors.passwordRequired')
  .min(8, 'errors.passwordTooShort')
  .max(64, 'errors.passwordTooShort')
  .regex(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d\W]+$/, 'errors.passwordWeak');

/* -------------------------------------------------------------------------- */
/*                                表单 Schema                                   */
/* -------------------------------------------------------------------------- */

/**
 * 登录表单 Schema
 * - email：邮箱（必填，格式校验）
 * - password：密码（必填，登录场景不强制复杂度，仅需非空）
 * - rememberMe：记住我（布尔值，前端逻辑使用，不参与后端校验）
 *
 * 与后端 LoginDto 对应
 */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'errors.passwordRequired'),
  // 记住我：前端逻辑使用（如持久化策略），不参与后端校验
  rememberMe: z.boolean().optional(),
});

/**
 * 注册表单 Schema
 * - email：邮箱（必填，格式校验 + 临时邮箱拦截）
 * - password：密码（必填，复杂度校验）
 * - confirmPassword：确认密码（必填，需与 password 一致）
 * - nickname：昵称（可选，最长 64 字符，与后端 @MaxLength(64) 一致）
 * - inviteCode：邀请码（可选，最长 16 字符，与后端 @MaxLength(16) 一致）
 *
 * 使用 .superRefine 在根级别校验两次密码是否一致，
 * 并将错误绑定到 confirmPassword 字段路径上。
 *
 * 与后端 RegisterDto 对应
 */
export const registerSchema = z
  .object({
    email: emailField.refine((val) => !isTempEmail(val), {
      message: 'errors.tempEmailBlocked',
    }),
    password: passwordField,
    confirmPassword: z.string().min(1, 'errors.passwordRequired'),
    // 昵称：可选，最长 64 字符（与后端 @MaxLength(64) 一致）
    nickname: z.string().max(64).optional(),
    // 邀请码：可选，最长 16 字符（与后端 @MaxLength(16) 一致）
    inviteCode: z.string().max(16).optional(),
  })
  .superRefine((data, ctx) => {
    // 校验两次输入的密码是否一致
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'errors.confirmPasswordMismatch',
      });
    }
  });

/**
 * 找回密码表单 Schema
 * - email：邮箱（必填，格式校验）
 *
 * 与后端 ForgotPasswordDto 对应
 */
export const forgotPasswordSchema = z.object({
  email: emailField,
});

/* -------------------------------------------------------------------------- */
/*                            TypeScript 类型导出                               */
/* -------------------------------------------------------------------------- */

/** 登录表单数据类型 */
export type LoginFormData = z.infer<typeof loginSchema>;

/** 注册表单数据类型 */
export type RegisterFormData = z.infer<typeof registerSchema>;

/** 找回密码表单数据类型 */
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/* -------------------------------------------------------------------------- */
/*                              密码强度计算工具                                  */
/* -------------------------------------------------------------------------- */

/**
 * 密码强度等级
 * - weak：弱（不满足基本要求）
 * - medium：中（满足部分要求）
 * - strong：强（满足大部分要求）
 */
export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

/** 密码强度评估结果 */
export interface PasswordStrengthResult {
  /** 0-4 的分值，分值越高强度越大 */
  score: number;
  /** 强度等级 */
  level: PasswordStrengthLevel;
}

/**
 * 计算密码强度
 *
 * 评分维度（每满足一项 +1，满分 5）：
 *  1. 长度 >= 8
 *  2. 包含小写字母
 *  3. 包含大写字母
 *  4. 包含数字
 *  5. 包含特殊字符
 *
 * 等级映射：
 *  - score <= 2 → weak（弱）
 *  - score === 3 → medium（中）
 *  - score >= 4 → strong（强）
 *
 * @param password 密码字符串
 * @returns 密码强度评估结果
 */
export function getPasswordStrength(password: string): PasswordStrengthResult {
  let score = 0;

  // 维度 1：长度 >= 8
  if (password.length >= 8) score += 1;
  // 维度 2：包含小写字母
  if (/[a-z]/.test(password)) score += 1;
  // 维度 3：包含大写字母
  if (/[A-Z]/.test(password)) score += 1;
  // 维度 4：包含数字
  if (/\d/.test(password)) score += 1;
  // 维度 5：包含特殊字符
  if (/[^a-zA-Z\d]/.test(password)) score += 1;

  // 映射为强度等级
  let level: PasswordStrengthLevel = 'weak';
  if (score >= 4) level = 'strong';
  else if (score === 3) level = 'medium';

  return { score, level };
}
