'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  History,
  Key,
  CreditCard,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useRouter, usePathname } from '@/i18n/navigation';

/**
 * 用户中心布局
 * 包含侧边栏导航和路由守卫
 * 未登录用户自动跳转到登录页，并记录来源页面
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('nav');
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  /**
   * 路由守卫：检查登录状态
   * 未登录则跳转登录页，并记录来源路径
   */
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        // 记录来源路径，登录后跳回
        const redirect = encodeURIComponent(pathname);
        router.replace(`/auth/login?redirect=${redirect}`);
      }
      setChecking(false);
    }
  }, [isAuthenticated, loading, router, pathname]);

  // 登录状态检查中，显示加载动画
  if (checking || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent" />
      </div>
    );
  }

  // 未登录不渲染内容
  if (!isAuthenticated) {
    return null;
  }

  // 侧边栏导航项配置
  const navItems = [
    { label: t('dashboard'), href: '/dashboard' as const, icon: LayoutDashboard },
    { label: t('history'), href: '/history' as const, icon: History },
    { label: t('apiKeys'), href: '/api-keys' as const, icon: Key },
    { label: t('billing'), href: '/billing' as const, icon: CreditCard },
    { label: t('settings'), href: '/settings' as const, icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-brand-background">
      {/* 侧边栏导航 */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-brand-card">
        <nav className="flex h-full flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      {/* 主内容区 */}
      <main className="flex-1 pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
