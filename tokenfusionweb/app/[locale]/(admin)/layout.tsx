'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { cn } from '@/lib/utils/cn';
import {
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

/**
 * AdminLayout 管理后台布局
 *
 * 职责：
 * 1. RBAC 强校验：仅 admin 角色可访问，非 admin 自动跳转至首页
 * 2. 渲染左侧导航栏（用户管理 / 订单管理 / 数据看板 / 系统配置）
 * 3. 提供内容区容器，子页面渲染于右侧主区域
 *
 * 说明：
 * - 由于登录态存储于 localStorage（Zustand 持久化），首屏需等待客户端
 *   挂载后从 store 读取用户角色，挂载完成前展示 loading 占位；
 * - 角色字段 role 来自后端登录响应（AuthResponse.user.role），此处通过
 *   类型断言读取，未声明在 authStore 的 User 接口中以避免影响前台展示。
 */

/** 登录态用户信息（扩展 role 字段，用于 RBAC 判断） */
interface AuthUserWithRole {
  id: string | number;
  email: string;
  role?: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();

  // 从全局 store 获取用户信息与登录态
  const user = useAuthStore((s) => s.user) as AuthUserWithRole | null;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const restore = useAuthStore((s) => s.restore);

  // 客户端挂载完成标志，用于避免 SSR/CSR 不一致导致的闪烁
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 页面挂载时从 localStorage 恢复登录态
    restore();
    setMounted(true);
  }, [restore]);

  /**
   * RBAC 校验逻辑：
   * - 挂载未完成：展示 loading
   * - 未登录：跳转首页（管理后台不允许未登录访问）
   * - 已登录但角色非 admin：跳转首页（RBAC 强校验）
   * - 已登录且为 admin：渲染后台布局
   */
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }
    if (user?.role !== 'admin') {
      router.replace('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  // 挂载完成前 / 权限校验中，展示全屏 loading
  if (!mounted || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-background">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          <span className="text-sm">{tCommon('loading')}</span>
        </div>
      </div>
    );
  }

  /** 侧边栏导航项配置 */
  const navItems = [
    {
      href: '/admin/users',
      label: t('nav.users'),
      icon: Users,
    },
    {
      href: '/admin/orders',
      label: t('nav.orders'),
      icon: ShoppingCart,
    },
    {
      href: '/admin/dashboard',
      label: t('nav.dashboard'),
      icon: BarChart3,
    },
    {
      href: '/admin/settings',
      label: t('nav.settings'),
      icon: Settings,
    },
  ] as const;

  /**
   * 判断当前导航项是否激活
   * 通过 pathname 前缀匹配实现高亮
   */
  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen bg-brand-background">
      {/* ============ 左侧导航栏 ============ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-brand-card lg:flex">
        {/* 品牌标识区 */}
        <div className="flex h-16 items-center gap-2 border-b border-white/5 px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient">
            <ShieldCheck className="h-5 w-5 text-white" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white">
              {tCommon('appName')}
            </span>
            <span className="text-[10px] text-text-tertiary">
              {t('badge')}
            </span>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive(item.href)
                    ? 'bg-brand-primary/15 text-brand-primary'
                    : 'text-text-secondary hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 底部：返回主站 */}
        <div className="border-t border-white/5 p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-tertiary transition-colors hover:bg-white/5 hover:text-white"
          >
            <span>{t('backToSite')}</span>
          </Link>
        </div>
      </aside>

      {/* ============ 右侧主内容区 ============ */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* 顶部信息条 */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 bg-brand-card/80 px-6 backdrop-blur-lg">
          <h1 className="text-base font-semibold text-white">
            {t('title')}
          </h1>
          {/* 当前管理员邮箱 */}
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="hidden sm:inline">{user?.email}</span>
            <span className="rounded bg-brand-primary/15 px-2 py-0.5 text-xs text-brand-primary">
              {t('roleAdmin')}
            </span>
          </div>
        </header>

        {/* 页面内容容器 */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
