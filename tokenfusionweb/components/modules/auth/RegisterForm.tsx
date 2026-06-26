'use client';

/**
 * 注册表单组件
 *
 * 职责：
 *  1. 收集邮箱、密码、确认密码、昵称（可选）、邀请码（可选）五项输入
 *  2. 使用 react-hook-form + zod 进行表单校验（含两次密码一致性校验）
 *  3. 实时密码强度提示（弱 / 中 / 强）
 *  4. 临时邮箱检测提示（与后端 TempEmailUtil 同步域名列表）
 *  5. 调用 useAuth().register 发起注册请求
 *  6. 注册成功后展示成功提示，并引导用户前往登录页
 *
 * 样式规范：
 *  - 深色主题（卡片背景 #111827，圆角 rounded-xl）
 *  - 品牌渐变提交按钮（linear-gradient(135deg, #3B82F6, #06B6D4)）
 *  - 标签文字 #94A3B8，占位符 #475569
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Loader2, AlertCircle, CheckCircle2, MailWarning } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import {
  registerSchema,
  isTempEmail,
  getPasswordStrength,
  type RegisterFormData,
} from '@/lib/utils/validation';

export function RegisterForm() {
  // 获取 auth 命名空间的翻译函数
  const t = useTranslations('auth');
  // 认证 Hook：提供 register 方法与 loading 状态
  const { register, loading } = useAuth();

  // 接口级业务错误
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 注册成功标记：控制成功面板的展示
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * 初始化 react-hook-form
   * - resolver：接入 zod registerSchema（含密码一致性 superRefine 校验）
   * - watch：用于实时监听密码与邮箱，驱动强度提示与临时邮箱提示
   */
  const {
    register: registerField,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      nickname: '',
      inviteCode: '',
    },
  });

  // 实时监听密码与邮箱输入，用于动态提示
  const passwordValue = watch('password') ?? '';
  const emailValue = watch('email') ?? '';

  // 计算密码强度（仅在用户输入密码时展示）
  const strength = getPasswordStrength(passwordValue);
  // 检测当前邮箱是否为临时邮箱（用户输入有效邮箱后实时判断）
  const isTemp = emailValue.includes('@') && isTempEmail(emailValue);

  /**
   * 将 zod 校验错误消息（i18n 相对 key）翻译为当前语言文案
   */
  const translateFieldError = (message: string | undefined): string => {
    if (!message) return '';
    return t(message as Parameters<typeof t>[0]);
  };

  /**
   * 根据密码强度等级返回对应的进度条颜色
   * - weak（弱）：红色 #EF4444
   * - medium（中）：黄色 #F59E0B
   * - strong（强）：绿色 #10B981
   */
  const getStrengthBarColor = (level: typeof strength.level): string => {
    switch (level) {
      case 'strong':
        return 'bg-[#10B981]';
      case 'medium':
        return 'bg-[#F59E0B]';
      default:
        return 'bg-[#EF4444]';
    }
  };

  /**
   * 表单提交处理
   * 1. 清空业务错误
   * 2. 调用 useAuth().register 发起注册
   * 3. 成功后切换为成功面板（提示查收验证邮件）
   * 4. 失败时展示业务错误
   */
  const onSubmit = async (data: RegisterFormData) => {
    setSubmitError(null);
    try {
      // 调用注册接口；空字符串的可选字段转为 undefined 不传给后端
      await register({
        email: data.email.toLowerCase().trim(),
        password: data.password,
        nickname: data.nickname?.trim() || undefined,
        inviteCode: data.inviteCode?.trim() || undefined,
      });
      // 注册成功，展示成功面板
      setIsSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('registerButton');
      setSubmitError(message);
    }
  };

  /* ---------------------- 注册成功面板 ---------------------- */
  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        {/* 成功图标 */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981]/10">
          <CheckCircle2 className="h-8 w-8 text-[#10B981]" />
        </div>
        {/* 成功标题 */}
        <h3 className="text-xl font-semibold text-white">
          {t('registerSuccess')}
        </h3>
        {/* 验证邮箱引导提示 */}
        <p className="text-sm leading-relaxed text-text-secondary">
          {t('checkEmailHint')}
        </p>
        {/* 前往登录页 */}
        <Button asChild className="h-11 w-full bg-brand-gradient font-semibold text-white hover:opacity-90">
          <Link href="/auth/login">{t('signInNow')}</Link>
        </Button>
      </div>
    );
  }

  /* ---------------------- 注册表单主体 ---------------------- */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* ============== 接口级业务错误提示 ============== */}
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* ============================ 邮箱字段 ============================ */}
      <div className="space-y-2">
        <Label htmlFor="register-email">{t('email')}</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          aria-invalid={!!errors.email}
          {...registerField('email')}
        />
        {/* 临时邮箱实时检测提示 */}
        {isTemp && !errors.email && (
          <div className="flex items-start gap-2 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#F59E0B]">
            <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('tempEmailWarning')}</span>
          </div>
        )}
        {/* 字段级校验错误 */}
        {errors.email && (
          <p className="text-xs text-red-400">
            {translateFieldError(errors.email.message)}
          </p>
        )}
      </div>

      {/* ============================ 密码字段 ============================ */}
      <div className="space-y-2">
        <Label htmlFor="register-password">{t('password')}</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          aria-invalid={!!errors.password}
          {...registerField('password')}
        />
        {/* 密码强度提示：仅在用户输入密码时展示 */}
        {passwordValue && (
          <div className="space-y-1.5">
            {/* 强度进度条：三段式，根据分值阈值填充对应颜色 */}
            <div className="flex gap-1.5">
              {/* 第一段：score >= 1 时填充 */}
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  strength.score >= 1 ? getStrengthBarColor(strength.level) : 'bg-white/10'
                }`}
              />
              {/* 第二段：score >= 3 时填充（对应 medium 及以上） */}
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  strength.score >= 3 ? getStrengthBarColor(strength.level) : 'bg-white/10'
                }`}
              />
              {/* 第三段：score >= 4 时填充（对应 strong） */}
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  strength.score >= 4 ? getStrengthBarColor(strength.level) : 'bg-white/10'
                }`}
              />
            </div>
            {/* 强度文字标签 */}
            <p className="text-xs text-text-secondary">
              {t('passwordStrength')}：
              <span
                className={
                  strength.level === 'strong'
                    ? 'text-[#10B981]'
                    : strength.level === 'medium'
                      ? 'text-[#F59E0B]'
                      : 'text-[#EF4444]'
                }
              >
                {strength.level === 'strong'
                  ? t('passwordStrengthStrong')
                  : strength.level === 'medium'
                    ? t('passwordStrengthMedium')
                    : t('passwordStrengthWeak')}
              </span>
            </p>
          </div>
        )}
        {errors.password && (
          <p className="text-xs text-red-400">
            {translateFieldError(errors.password.message)}
          </p>
        )}
      </div>

      {/* ============================ 确认密码字段 ============================ */}
      <div className="space-y-2">
        <Label htmlFor="register-confirm-password">{t('confirmPassword')}</Label>
        <Input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder={t('confirmPasswordPlaceholder')}
          aria-invalid={!!errors.confirmPassword}
          {...registerField('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-400">
            {translateFieldError(errors.confirmPassword.message)}
          </p>
        )}
      </div>

      {/* ============================ 昵称字段（可选） ============================ */}
      <div className="space-y-2">
        <Label htmlFor="register-nickname">{t('nickname')}</Label>
        <Input
          id="register-nickname"
          type="text"
          autoComplete="nickname"
          placeholder={t('nicknamePlaceholder')}
          {...registerField('nickname')}
        />
      </div>

      {/* ============================ 邀请码字段（可选） ============================ */}
      <div className="space-y-2">
        <Label htmlFor="register-invite-code">{t('inviteCode')}</Label>
        <Input
          id="register-invite-code"
          type="text"
          placeholder={t('inviteCodePlaceholder')}
          {...registerField('inviteCode')}
        />
      </div>

      {/* ============================ 提交按钮 ============================ */}
      <Button
        type="submit"
        disabled={loading}
        className="h-11 w-full bg-brand-gradient text-base font-semibold text-white hover:opacity-90"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('registerButton')}
          </>
        ) : (
          t('registerButton')
        )}
      </Button>

      {/* ============================ 底部登录引导 ============================ */}
      <p className="pt-1 text-center text-sm text-text-secondary">
        {t('hasAccount')}{' '}
        <Link
          href="/auth/login"
          className="font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
        >
          {t('signInNow')}
        </Link>
      </p>
    </form>
  );
}
