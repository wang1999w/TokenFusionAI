'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { cn } from '@/lib/utils/cn';
import { Navbar } from '@/components/common/Navbar';
import { Loader2 } from 'lucide-react';

/**
 * DashboardLayout 用户控制台布局
 *
 * 职责：
 * 1. 登录态校验：未登录用户跳转至登录页（控制台需登录访问）
 * 2. 渲染顶部公共导航栏（复用 Navbar 组件）
 * 3. 渲染控制台二级导航（控制台 / 历史记录 / API 密钥 / 账单）
 * 4. 提供内容区容器
 *
 * 说明：
 * - 与管理后台 (admin) 不同，控制台面向所有已登录用户；
 * - 二级导航采用水平 Tab 风格，与顶部导航栏区分层级。
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();

  // 从全局 store 获取登录态
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const restore = useAuthStore((s) => s.restore);

  // 客户端挂载标志
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    restore();
    setMounted(true);
  }, [restore]);

  /**
   * 登录态校验：
   * - 挂载完成前展示 loading
   * - 未登录跳转登录页
   */
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [mounted, isAuthenticated, router]);

  // 挂载完成前 / 未登录，展示 loading
  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-background">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          <span className="text-sm">{tCommon('loading')}</span>
        </div>
      </div>
    );
  }

  /** 控制台二级导航项 */
  const navItems = [
    { href: '/dashboard', label: t('dashboard') },
    { href: '/history', label: t('history') },
    { href: '/apikeys', label: t('apiKeys') },
    { href: '/billing', label: t('billing') },
  ] as const;

  /** 判断当前导航项是否激活 */
  const isActive = (href: string): boolean =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href;

  return (
    <div className="min-h-screen bg-brand-background">
      {/* 顶部公共导航栏 */}
      <Navbar />

      {/* 控制台二级导航 */}
      <div className="border-b border-white/5 bg-brand-card/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors',
                  isActive(item.href)
                    ? 'border-brand-primary text-white'
                    : 'border-transparent text-text-secondary hover:text-white',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* 页面内容容器 */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
