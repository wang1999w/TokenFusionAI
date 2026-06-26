'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Coins, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * QuotaExhaustedModal 额度耗尽弹窗
 *
 * 职责：
 * - 当免登用户额度用尽时弹出引导
 * - 文案："Create a free account to get 2000 more tokens"
 * - 提供 注册 / 登录 两个按钮
 * - 点击按钮跳转至对应认证页
 * - 支持点击遮罩或关闭按钮关闭
 */

interface QuotaExhaustedModalProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

export function QuotaExhaustedModal({ open, onClose }: QuotaExhaustedModalProps) {
  const t = useTranslations('quota');
  const router = useRouter();

  /**
   * ESC 键关闭弹窗
   */
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    // 弹窗打开时禁止背景滚动
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  /**
   * 跳转到注册页
   */
  const goRegister = () => {
    onClose();
    router.push('/auth/register');
  };

  /**
   * 跳转到登录页
   */
  const goLogin = () => {
    onClose();
    router.push('/auth/login');
  };

  return (
    // 遮罩层
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* 弹窗主体 */}
      <div
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-brand-card shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-text-tertiary transition-colors hover:text-white"
          aria-label="close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 内容区 */}
        <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
          {/* 图标 */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
            <Coins className="h-8 w-8 text-brand-primary" />
          </div>

          {/* 标题 */}
          <h3 className="text-xl font-bold text-white">{t('title')}</h3>

          {/* 说明 + 2000 tokens 高亮 */}
          <p className="text-sm leading-relaxed text-text-secondary">
            {t('messagePrefix')}{' '}
            <span className="font-semibold text-brand-primary">2000</span>{' '}
            {t('messageSuffix')}
          </p>

          {/* 按钮组 */}
          <div className="flex w-full flex-col gap-2.5">
            {/* 注册按钮（品牌渐变，主操作） */}
            <button
              type="button"
              onClick={goRegister}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              {t('register')}
            </button>
            {/* 登录按钮（次操作） */}
            <button
              type="button"
              onClick={goLogin}
              className="rounded-lg border border-white/10 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
            >
              {t('signIn')}
            </button>
          </div>

          {/* 底部提示 */}
          <p className="text-xs text-text-tertiary">{t('hint')}</p>
        </div>
      </div>
    </div>
  );
}
