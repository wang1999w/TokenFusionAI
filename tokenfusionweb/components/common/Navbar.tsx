'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Menu, X, Sparkles } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { cn } from '@/lib/utils/cn';

/**
 * Navbar 顶部导航栏
 *
 * 职责：
 * - Logo（点击回首页）
 * - 导航链接（锚点跳转至落地页各区域）
 * - 语言切换（复用 LanguageSwitcher）
 * - 登录 / 注册按钮
 * - 移动端汉堡菜单
 * - 滚动时背景模糊增强
 */
export function Navbar() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /**
   * 监听滚动，切换导航栏背景
   */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /** 导航锚点配置 */
  const navLinks = [
    { href: '#features', label: t('features') },
    { href: '#pricing', label: t('pricing') },
    { href: '#developers', label: t('api') },
    { href: '#faq', label: t('faq') },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-white/5 bg-brand-background/80 backdrop-blur-lg'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 左侧：Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold text-white">TokenFusion</span>
        </Link>

        {/* 中间：桌面端导航链接 */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-text-secondary transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* 右侧：操作区 */}
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <Link
            href="/auth/login"
            className="text-sm text-text-secondary transition-colors hover:text-white"
          >
            {tCommon('signIn')}
          </Link>
          <Link
            href="/auth/register"
            className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {tCommon('signUp')}
          </Link>
        </div>

        {/* 移动端：汉堡菜单按钮 */}
        <button
          type="button"
          className="text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* 移动端展开菜单 */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-brand-background/95 backdrop-blur-lg md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <div className="flex items-center gap-3 pt-2">
              <LanguageSwitcher />
              <Link
                href="/auth/login"
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-center text-sm text-white"
              >
                {tCommon('signIn')}
              </Link>
              <Link
                href="/auth/register"
                className="flex-1 rounded-lg bg-brand-gradient px-4 py-2 text-center text-sm font-medium text-white"
              >
                {tCommon('signUp')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
