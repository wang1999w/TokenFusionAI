'use client';

/**
 * 找回密码表单组件
 *
 * 职责：
 *  1. 收集邮箱输入
 *  2. 使用 react-hook-form + zod 进行邮箱格式校验
 *  3. 调用 forgotPassword API 发送密码重置邮件
 *  4. 提交后展示"如果邮箱已注册，将收到重置邮件"的安全提示
 *     （出于安全考虑，无论邮箱是否注册均返回相同提示，防止邮箱枚举攻击）
 *  5. 提供返回登录的链接
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
import { Loader2, AlertCircle, MailCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/lib/api/auth';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/utils/validation';

export function ForgotPasswordForm() {
  // 获取 auth 命名空间的翻译函数
  const t = useTranslations('auth');

  // 接口级业务错误
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 提交成功标记：控制成功提示面板的展示
  const [isSent, setIsSent] = useState(false);
  // 加载状态（独立于 useAuth，此处直接调用 API 层）
  const [loading, setLoading] = useState(false);

  /**
   * 初始化 react-hook-form
   * - resolver：接入 zod forgotPasswordSchema
   */
  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  /**
   * 将 zod 校验错误消息（i18n 相对 key）翻译为当前语言文案
   */
  const translateFieldError = (message: string | undefined): string => {
    if (!message) return '';
    return t(message as Parameters<typeof t>[0]);
  };

  /**
   * 表单提交处理
   * 1. 清空业务错误
   * 2. 调用 forgotPassword API 发送重置邮件
   * 3. 无论接口返回成功或失败（非网络错误），均展示统一的"已发送"提示
   *    防止攻击者通过接口响应差异枚举已注册邮箱
   */
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setSubmitError(null);
    setLoading(true);
    try {
      // 邮箱归一化后调用找回密码接口
      await forgotPassword(data.email.toLowerCase().trim());
      // 成功：展示安全提示（不区分邮箱是否注册）
      setIsSent(true);
    } catch (err) {
      // 网络错误等异常才展示错误信息
      const message = err instanceof Error ? err.message : t('sendResetLink');
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------- 提交成功提示面板 ---------------------- */
  if (isSent) {
    return (
      <div className="space-y-6 text-center">
        {/* 邮件已发送图标 */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#06B6D4]/10">
          <MailCheck className="h-8 w-8 text-[#06B6D4]" />
        </div>
        {/* 安全提示文案：不泄露邮箱是否注册 */}
        <p className="text-sm leading-relaxed text-text-secondary">
          {t('forgotPasswordSuccess')}
        </p>
        {/* 返回登录链接 */}
        <Button
          asChild
          className="h-11 w-full bg-brand-gradient font-semibold text-white hover:opacity-90"
        >
          <Link href="/auth/login">{t('backToLogin')}</Link>
        </Button>
      </div>
    );
  }

  /* ---------------------- 找回密码表单主体 ---------------------- */
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
        <Label htmlFor="forgot-email">{t('email')}</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          aria-invalid={!!errors.email}
          {...registerField('email')}
        />
        {errors.email && (
          <p className="text-xs text-red-400">
            {translateFieldError(errors.email.message)}
          </p>
        )}
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
            {t('sendResetLink')}
          </>
        ) : (
          t('sendResetLink')
        )}
      </Button>

      {/* ============================ 返回登录 ============================ */}
      <p className="pt-1 text-center text-sm text-text-secondary">
        <Link
          href="/auth/login"
          className="font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
        >
          {t('backToLogin')}
        </Link>
      </p>
    </form>
  );
}
