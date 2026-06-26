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
import { ExperienceTabs } from '@/components/common/ExperienceTabs';
import { cn } from '@/lib/utils/cn';

/**
 * 主聚合落地页
 *
 * 6 个区域布局（Navbar 和 Footer 由 (public)/layout.tsx 统一提供）：
 * 1. Hero 英雄区（标题 + 副标题 + CTA + 信任徽章）
 * 2. Experience 体验区（内嵌 ExperienceTabs）
 * 3. Pricing 定价区
 * 4. Developers 开发者区
 * 5. Advantages 优势区（id=features）
 * 6. FAQ 常见问题区
 */
export default function HomePage() {
  const tExperience = useTranslations('experience');

  return (
    <div className="relative min-h-screen">
      {/* 全页科技网格底纹 */}
      <div className="tech-grid-bg pointer-events-none fixed inset-0 z-0" />

      {/* 1. Hero 英雄区 */}
      <HeroSection />

      {/* 2. 体验区（动态背景 + 玻璃态面板） */}
      <section id="experience" className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        {/* 体验区动态背景 */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: 'url(/images/demo-showcase.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-background via-brand-background/80 to-brand-background" />
          <div className="absolute left-1/2 top-0 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-brand-primary/8 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
              <span className="animate-gradient-shine bg-gradient-to-r from-brand-primary via-[#3B82F6] to-brand-primary bg-clip-text text-transparent">
                {tExperience('title')}
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-text-secondary">
              {tExperience('subtitle')}
            </p>
          </div>
          <ExperienceTabs />
        </div>
      </section>

      {/* 3. 定价区 */}
      <PricingSection />

      {/* 4. 开发者区 */}
      <DevelopersSection />

      {/* 5. 优势区 */}
      <AdvantagesSection />

      {/* 6. FAQ 区 */}
      <FaqSection />
    </div>
  );
}

/* ============================================================
 * Hero 英雄区（全屏动态背景 + 粒子动画）
 * ============================================================ */

/** 漂浮粒子配置 */
const HERO_PARTICLES = [
  { left: '10%', top: '20%', size: 4, delay: '0s', duration: '8s' },
  { left: '85%', top: '15%', size: 6, delay: '1s', duration: '10s' },
  { left: '70%', top: '60%', size: 3, delay: '2s', duration: '7s' },
  { left: '25%', top: '70%', size: 5, delay: '3s', duration: '9s' },
  { left: '50%', top: '30%', size: 3, delay: '0.5s', duration: '8s' },
  { left: '90%', top: '50%', size: 4, delay: '2.5s', duration: '10s' },
  { left: '15%', top: '50%', size: 5, delay: '1.5s', duration: '9s' },
  { left: '60%', top: '80%', size: 3, delay: '3.5s', duration: '7s' },
];

function HeroSection() {
  const t = useTranslations('hero');
  const tCommon = useTranslations('common');

  return (
    <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      {/* 层 1: AI 生成的全屏背景图（缓慢缩放流动，模拟视频循环） */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="animate-hero-bg absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/hero-bg.jpg)' }}
        />
        {/* 底色叠加，确保文字可读性 */}
        <div className="absolute inset-0 bg-brand-background/60" />
        {/* 底部渐变过渡到页面背景 */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-brand-background" />
      </div>

      {/* 层 2: 科技网格 */}
      <div className="tech-grid-bg animate-grid-pulse pointer-events-none absolute inset-0" />

      {/* 层 3: 光晕脉动 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-glow-pulse absolute left-1/2 top-1/4 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-brand-primary/10 blur-[140px]" />
        <div className="animate-glow-pulse delay-2 absolute right-1/4 top-1/2 h-[350px] w-[350px] rounded-full bg-[#3B82F6]/12 blur-[110px]" />
        <div className="animate-glow-pulse delay-4 absolute left-1/4 bottom-1/4 h-[300px] w-[400px] rounded-full bg-[#06B6D4]/8 blur-[100px]" />
      </div>

      {/* 层 4: 漂浮粒子 */}
      <div className="pointer-events-none absolute inset-0">
        {HERO_PARTICLES.map((p, i) => (
          <div
            key={i}
            className="animate-particle absolute rounded-full bg-brand-primary/40"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
              boxShadow: '0 0 8px rgba(6, 182, 212, 0.6)',
            }}
          />
        ))}
      </div>

      {/* 层 5: 扫描光线（极淡） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-scan-line gradient-beam absolute inset-x-0 h-px" />
      </div>

      {/* 内容区 */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* 信任徽章 */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          {[t('badge1'), t('badge2'), t('badge3')].map((badge, i) => (
            <span
              key={i}
              className="animate-float rounded-full border border-brand-primary/30 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary backdrop-blur-sm"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              {badge}
            </span>
          ))}
        </div>

        {/* 标题（渐变闪烁） */}
        <h1 className="animate-gradient-shine mb-6 bg-gradient-to-r from-white via-brand-primary to-white bg-clip-text text-4xl font-bold leading-tight text-transparent md:text-6xl">
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
            className="glow-border flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-8 py-3.5 text-base font-medium text-white transition-transform hover:scale-[1.02] sm:w-auto"
          >
            <Sparkles className="h-5 w-5" />
            {t('cta')}
          </Link>
          <Link
            href="#pricing"
            className="glass-card flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/5 sm:w-auto"
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
    <section id="pricing" className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      {/* 定价区背景光效 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-1/2 h-[400px] w-[400px] rounded-full bg-[#3B82F6]/6 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[300px] w-[300px] rounded-full bg-brand-primary/6 blur-[100px]" />
      </div>

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
                'glass-card relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1',
                plan.popular
                  ? 'glow-border border-brand-primary/40'
                  : 'hover:border-white/20',
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
    <section id="developers" className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      {/* 开发者区背景光效 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-1/4 top-0 h-[350px] w-[500px] rounded-full bg-[#3B82F6]/5 blur-[120px]" />
        <div className="absolute left-1/4 bottom-0 h-[250px] w-[350px] rounded-full bg-brand-primary/5 blur-[100px]" />
      </div>

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
                className="glass-card group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
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
    <section id="features" className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      {/* 优势区背景光效 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-brand-primary/6 blur-[130px]" />
        <div className="absolute left-1/4 bottom-1/4 h-[250px] w-[350px] rounded-full bg-[#3B82F6]/5 blur-[100px]" />
      </div>

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
                className="glass-card group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
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
    <section id="faq" className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      {/* FAQ 区背景光效 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand-primary/5 blur-[120px]" />
      </div>

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
                className={cn(
                  'glass-card overflow-hidden rounded-xl transition-all duration-300',
                  isOpen && 'glow-border border-brand-primary/30',
                )}
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
