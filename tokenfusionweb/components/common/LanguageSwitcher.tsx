'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { LOCALE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * 禁用浏览器自动滚动恢复
   * 作为额外保险,防止任何情况下页面恢复到之前的滚动位置
   */
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
      return () => {
        window.history.scrollRestoration = prev;
      };
    }
  }, []);

  /**
   * 切换语言:使用完整页面导航(window.location.href)
   *
   * 为什么不用 router.replace()?
   * - Next.js App Router 的 router.replace() 是客户端导航,会保留滚动位置
   * - 这导致切换语言后页面仍停留在定价区等位置
   * - 改用完整页面导航,浏览器会自然回到页面顶部,彻底解决滚动问题
   */
  function onLocaleChange(newLocale: string) {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }

    setIsNavigating(true);
    setIsOpen(false);

    const currentPath = window.location.pathname;
    // 匹配 locale 前缀: /en, /zh-CN, /th, /vi, /id, /ms, /fil
    const localePattern = /^\/[a-z]{2}(?:-[A-Z]{2})?/;
    let newPath: string;

    if (localePattern.test(currentPath)) {
      newPath = currentPath.replace(localePattern, `/${newLocale}`);
    } else {
      newPath = `/${newLocale}${currentPath}`;
    }

    // 设置标记:新页面加载时强制滚动到顶部
    try {
      sessionStorage.setItem('tf_scroll_top', '1');
    } catch {
      // sessionStorage 不可用时忽略
    }

    // 完整页面导航
    window.location.href = newPath + window.location.search;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        disabled={isNavigating}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white',
          isNavigating && 'opacity-60'
        )}
      >
        <Globe className="h-4 w-4" />
        <span>{LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS]}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-brand-card shadow-xl">
          {routing.locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLocaleChange(l)}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-white/5',
                locale === l
                  ? 'text-brand-primary'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              {LOCALE_LABELS[l]}
              {locale === l && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
