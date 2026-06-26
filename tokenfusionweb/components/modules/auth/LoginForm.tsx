'use client';

/**
 * 登录表单组件
 *
 * 职责：
 *  1. 收集邮箱、密码、记住我三项输入
 *  2. 使用 react-hook-form + zod 进行表单校验
 *  3. 调用 useAuth().login 发起登录请求
 *  4. 登录成功后通过 next-intl 的 useRouter 跳转至控制台
 *  5. 展示字段级校验错误与接口级业务错误
 *  6. 提供忘记密码、注册的底部导航链接
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
import { useRouter, Link } from '@/i18n/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginFormData } from '@/lib/utils/validation';

export function LoginForm() {
  // 获取 auth 命名空间的翻译函数（标题、标签、占位符、按钮文案、错误提示等）
  const t = useTranslations('auth');
  // next-intl 提供的 locale 感知路由，push 时会自动拼接当前语言前缀
  const router = useRouter();
  // 认证 Hook：提供 login 方法、loading 状态与 error 状态
  const { login, loading } = useAuth();

  // 接口级业务错误（如"账号或密码错误"），独立于字段校验错误展示
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * 初始化 react-hook-form
   * - resolver：将 zod schema 接入表单校验
   * - defaultValues：各字段初始值
   */
  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  /**
   * 将 zod 校验错误消息（i18n 相对 key，如 'errors.emailRequired'）
   * 翻译为当前语言的文案。
   * zod schema 中 message 使用相对 key 路径，此处通过 t() 解析。
   */
  const translateFieldError = (message: string | undefined): string => {
    if (!message) return '';
    // message 形如 'errors.emailRequired'，t() 会解析为 auth.errors.emailRequired
    return t(message as Parameters<typeof t>[0]);
  };

  /**
   * 表单提交处理
   * 1. 清空上一次的业务错误
   * 2. 调用 useAuth().login 发起登录
   * 3. 成功后跳转至 /dashboard（next-intl 路由自动添加 locale 前缀）
   * 4. 失败时将错误信息展示在表单顶部
   */
  const onSubmit = async (data: LoginFormData) => {
    setSubmitError(null);
    try {
      // 邮箱归一化：小写 + 去空格（与后端 @Transform 行为一致）
      await login({
        email: data.email.toLowerCase().trim(),
        password: data.password,
      });
      // 登录成功，跳转到控制台首页
      router.push('/dashboard');
    } catch (err) {
      // useAuth 内部已捕获并设置 error，此处同步展示到表单
      const message = err instanceof Error ? err.message : t('loginButton');
      setSubmitError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* ============== 接口级业务错误提示（登录失败时展示） ============== */}
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
        <Label htmlFor="login-email">{t('email')}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          aria-invalid={!!errors.email}
          // 将字段注册到 react-hook-form
          {...registerField('email')}
        />
        {/* 字段级校验错误 */}
        {errors.email && (
          <p className="text-xs text-red-400">
            {translateFieldError(errors.email.message)}
          </p>
        )}
      </div>

      {/* ============================ 密码字段 ============================ */}
      <div className="space-y-2">
        <Label htmlFor="login-password">{t('password')}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          aria-invalid={!!errors.password}
          {...registerField('password')}
        />
        {errors.password && (
          <p className="text-xs text-red-400">
            {translateFieldError(errors.password.message)}
          </p>
        )}
      </div>

      {/* ===================== 记住我 + 忘记密码（同一行） ===================== */}
      <div className="flex items-center justify-between">
        {/* 记住我复选框：使用原生 input + 品牌色 accent */}
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-600 bg-[#111827] accent-[#06B6D4]"
            {...registerField('rememberMe')}
          />
          {t('rememberMe')}
        </label>

        {/* 忘记密码链接：使用 next-intl 的 Link 自动处理 locale 前缀 */}
        <Link
          href="/auth/forgot-password"
          className="text-sm text-brand-primary transition-colors hover:text-brand-primary/80"
        >
          {t('forgotPassword')}
        </Link>
      </div>

      {/* ============================ 提交按钮 ============================ */}
      <Button
        type="submit"
        disabled={loading}
        // 品牌渐变背景：linear-gradient(135deg, #3B82F6, #06B6D4)
        className="h-11 w-full bg-brand-gradient text-base font-semibold text-white hover:opacity-90"
      >
        {loading ? (
          <>
            {/* 加载中旋转图标 */}
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loginButton')}
          </>
        ) : (
          t('loginButton')
        )}
      </Button>

      {/* ============================ 底部注册引导 ============================ */}
      <p className="pt-1 text-center text-sm text-text-secondary">
        {t('noAccount')}{' '}
        <Link
          href="/auth/register"
          className="font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
        >
          {t('signUpNow')}
        </Link>
      </p>
    </form>
  );
}
