'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { ChevronDown, HelpCircle } from 'lucide-react';

/**
 * FAQPage 常见问题页
 *
 * 功能：
 * - 手风琴折叠列表（点击展开 / 收起，同时只能展开一项）
 * - 使用 i18n faq 命名空间的问答文案
 * - 底部提供"未找到答案"的联系入口
 *
 * 样式：
 * - 卡片式问答项，#111827 背景
 * - 展开时图标旋转动画
 */

/** FAQ 问答项数量（与 i18n faq 命名空间的 q1~q8 / a1~a8 对应） */
const FAQ_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export default function FaqPage() {
  const t = useTranslations('faq');
  const tCommon = useTranslations('common');

  // 当前展开的项索引（null 表示全部收起）
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  /**
   * 切换展开状态：
   * - 点击已展开项 → 收起
   * - 点击未展开项 → 展开该项（手风琴：同时只展开一项）
   */
  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {/* ============ 页面头部 ============ */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient">
          <HelpCircle className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
        <p className="mt-2 text-sm text-text-secondary">
          {t('subtitle')}
        </p>
      </div>

      {/* ============ 手风琴折叠列表 ============ */}
      <div className="mt-10 space-y-3">
        {FAQ_ITEMS.map((num, index) => {
          // 兜底：若该编号的文案缺失则跳过（next-intl 会在缺失时报错，这里用 try-catch 思路省略）
          const isOpen = openIndex === index;
          return (
            <div
              key={num}
              className="overflow-hidden rounded-xl border border-white/5 bg-brand-card"
            >
              {/* 问题（可点击展开） */}
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/5"
              >
                <span className="text-sm font-medium text-white">
                  {t(`q${num}`)}
                </span>
                {/* 展开 / 收起图标（旋转动画） */}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-text-secondary transition-transform duration-200',
                    isOpen && 'rotate-180 text-brand-primary',
                  )}
                />
              </button>

              {/* 答案（展开时显示，使用 max-height 过渡动画） */}
              <div
                className={cn(
                  'grid transition-all duration-200 ease-in-out',
                  isOpen
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-4 text-sm leading-relaxed text-text-secondary">
                    {t(`a${num}`)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ 底部联系入口 ============ */}
      <div className="mt-10 rounded-xl border border-white/5 bg-brand-card p-6 text-center">
        <h2 className="text-base font-semibold text-white">
          {t('stillQuestions')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {t('contactHint')}
        </p>
        <Link
          href="/auth/register"
          className="mt-4 inline-block rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {tCommon('getStarted')}
        </Link>
      </div>
    </div>
  );
}
