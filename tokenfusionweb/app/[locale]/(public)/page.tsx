'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Globe,
  Coins,
  Check,
  ChevronDown,
  Code2,
  Key,
  BookOpen,
  Terminal,
  Gauge,
} from 'lucide-react';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { ExperienceTabs } from '@/components/common/ExperienceTabs';
import { cn } from '@/lib/utils/cn';

/**
 * 主聚合落地页
 *
 * 8 个区域布局：
 * 1. Navbar 顶部导航
 * 2. Hero 英雄区（标题 + 副标题 + CTA + 信任徽章）
 * 3. Experience 体验区（内嵌 ExperienceTabs）
 * 4. Pricing 定价区
 * 5. Developers 开发者区
 * 6. Advantages 优势区（id=features）
 * 7. FAQ 常见问题区
 * 8. Footer 页脚
 */
export default function HomePage() {
  const tExperience = useTranslations('experience');

  return (
    <div className="min-h-screen bg-brand-background">
      {/* 1. 顶部导航 */}
      <Navbar />

      {/* 2. Hero 英雄区 */}
      <HeroSection />

      {/* 3. 体验区 */}
      <section id="experience" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
            <span className="text-brand-gradient">{tExperience('title')}</span>
          </h2>
          <p className="mx-auto max-w-2xl text-text-secondary">
            {tExperience('subtitle')}
          </p>
        </div>
        <ExperienceTabs />
      </section>

      {/* 4. 定价区 */}
      <PricingSection />

      {/* 5. 开发者区 */}
      <DevelopersSection />

      {/* 6. 优势区 */}
      <AdvantagesSection />

      {/* 7. FAQ 区 */}
      <FaqSection />

      {/* 8. 页脚 */}
      <Footer />
    </div>
  );
}

/* ============================================================
 * Hero 英雄区
 * ============================================================ */

function HeroSection() {
  const t = useTranslations('hero');
  const tCommon = useTranslations('common');

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-28">
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-brand-primary/10 blur-[120px]" />
        <div className="absolute right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-[#3B82F6]/10 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        {/* 信任徽章 */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          {[t('badge1'), t('badge2'), t('badge3')].map((badge, i) => (
            <span
              key={i}
              className="rounded-full border border-brand-primary/20 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary"
            >
              {badge}
            </span>
          ))}
        </div>

        {/* 标题 */}
        <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
          {t('title')}
        </h1>

        {/* 副标题 */}
        <p className="mx-auto mb-10 max-w-2xl text-lg text-text-secondary md:text-xl">
          {t('subtitle')}
        </p>

        {/* CTA 按钮组 */}
        <div className="mb-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth/register"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-brand-primary/20 transition-transform hover:scale-[1.02] sm:w-auto"
          >
            <Sparkles className="h-5 w-5" />
            {t('cta')}
          </Link>
          <Link
            href="#pricing"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/5 sm:w-auto"
          >
            {tCommon('viewPricing')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 信任文案 */}
        <p className="text-sm text-text-tertiary">{t('trustText')}</p>
      </div>
    </section>
  );
}

/* ============================================================
 * Pricing 定价区
 * ============================================================ */

/** 定价方案配置（复用 pricing 翻译键） */
const PRICING_PLANS = [
  { id: 'free', price: '$0', popular: false, features: ['2000', '5', 'community'] },
  { id: 'starter', price: '$9', popular: false, features: ['50000', '50', 'email'] },
  { id: 'pro', price: '$29', popular: true, features: ['200000', '200', 'priority', 'api'] },
  { id: 'developer', price: '$99', popular: false, features: ['1000000', '1000', 'priority', 'api', 'sla'] },
];

function PricingSection() {
  const t = useTranslations('pricing');

  return (
    <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* 标题 */}
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">{t('title')}</h2>
        </div>

        {/* 方案卡片 */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-brand-card p-6 transition-all',
                plan.popular
                  ? 'border-brand-primary shadow-lg shadow-brand-primary/10'
                  : 'border-white/5 hover:border-white/10',
              )}
            >
              {/* 最受欢迎标签 */}
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-1 text-xs font-medium text-white">
                  {t('popular')}
                </span>
              )}

              {/* 方案名 */}
              <h3 className="text-lg font-semibold text-white">
                {t(plan.id as 'free')}
              </h3>
              {/* 价格 */}
              <div className="mt-2 flex items-end gap-1">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="mb-1 text-sm text-text-tertiary">/ {t('oneTime')}</span>
              </div>

              {/* 功能列表 */}
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-success" />
                    <span>{t(`feature_${f}` as 'feature_2000')}</span>
                  </li>
                ))}
              </ul>

              {/* CTA 按钮 */}
              <Link
                href="/auth/register"
                className={cn(
                  'mt-6 flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                  plan.popular
                    ? 'bg-brand-gradient text-white hover:opacity-90'
                    : 'border border-white/10 text-white hover:bg-white/5',
                )}
              >
                {plan.id === 'developer' ? t('getApiKey') : t('signUpFree')}
              </Link>
            </div>
          ))}
        </div>

        {/* 说明 */}
        <p className="mt-8 text-center text-sm text-text-tertiary">{t('note')}</p>
      </div>
    </section>
  );
}

/* ============================================================
 * Developers 开发者区
 * ============================================================ */

function DevelopersSection() {
  const t = useTranslations('developers');

  const features = [
    { icon: Code2, titleKey: 'apiTitle', descKey: 'apiDesc' },
    { icon: BookOpen, titleKey: 'docsTitle', descKey: 'docsDesc' },
    { icon: Key, titleKey: 'sdksTitle', descKey: 'sdksDesc' },
    { icon: Terminal, titleKey: 'playgroundTitle', descKey: 'playgroundDesc' },
  ] as const;

  return (
    <section id="developers" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* 标题 */}
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">{t('title')}</h2>
          <p className="mx-auto max-w-2xl text-text-secondary">{t('subtitle')}</p>
        </div>

        {/* 功能网格 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.titleKey}
                className="rounded-2xl border border-white/5 bg-brand-card p-6 transition-colors hover:border-white/10"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10">
                  <Icon className="h-5 w-5 text-brand-primary" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">
                  {t(feat.titleKey)}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t(feat.descKey)}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="#"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
          >
            <Code2 className="h-4 w-4" />
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Advantages 优势区（id=features）
 * ============================================================ */

function AdvantagesSection() {
  const t = useTranslations('advantages');

  const items = [
    { icon: Coins, titleKey: 'item1Title', descKey: 'item1Desc' },
    { icon: Shield, titleKey: 'item2Title', descKey: 'item2Desc' },
    { icon: Gauge, titleKey: 'item3Title', descKey: 'item3Desc' },
    { icon: Globe, titleKey: 'item4Title', descKey: 'item4Desc' },
  ] as const;

  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* 标题 */}
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">{t('title')}</h2>
          <p className="mx-auto max-w-2xl text-text-secondary">{t('subtitle')}</p>
        </div>

        {/* 优势网格 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.titleKey}
                className="group rounded-2xl border border-white/5 bg-brand-card p-6 transition-all hover:-translate-y-1 hover:border-white/10"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">
                  {t(item.titleKey)}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {t(item.descKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * FAQ 常见问题区
 * ============================================================ */

function FaqSection() {
  const t = useTranslations('faq');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  /** 4 个常见问题 */
  const faqs = [
    { qKey: 'q1', aKey: 'a1' },
    { qKey: 'q2', aKey: 'a2' },
    { qKey: 'q3', aKey: 'a3' },
    { qKey: 'q4', aKey: 'a4' },
  ] as const;

  return (
    <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* 标题 */}
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">{t('title')}</h2>
        </div>

        {/* 折叠列表 */}
        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={faq.qKey}
                className="overflow-hidden rounded-xl border border-white/5 bg-brand-card"
              >
                {/* 问题（可点击展开） */}
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-white">{t(faq.qKey)}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-text-tertiary transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {/* 答案 */}
                {isOpen && (
                  <div className="px-5 pb-4 text-sm leading-relaxed text-text-secondary">
                    {t(faq.aKey)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
