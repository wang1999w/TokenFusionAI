'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { Check, Star } from 'lucide-react';

/**
 * PricingPage 定价独立页
 *
 * 功能：
 * 1. 4 档套餐卡片（Free / Starter / Pro / Developer）
 * 2. 一次性购买 / 按月订阅切换开关（影响价格与按钮文案）
 * 3. Pro 档标记 "Most Popular" 并高亮显示
 *
 * 样式：
 * - 套餐卡片网格响应式布局
 * - Pro 档使用品牌渐变边框 + 缩放强调
 */

/** 计费周期类型 */
type BillingCycle = 'oneTime' | 'subscription';

/** 套餐配置项 */
interface PlanConfig {
  /** 套餐标识，对应 pricing 命名空间 key */
  key: 'free' | 'starter' | 'pro' | 'developer';
  /** 一次性价格 */
  oneTimePrice: string;
  /** 订阅价格（/月） */
  subscriptionPrice: string;
  /** 是否为最受欢迎套餐 */
  popular?: boolean;
  /** 功能列表的 feature_ key 后缀 */
  features: string[];
  /** 按钮文案 key */
  ctaKey: string;
  /** 按钮跳转链接 */
  href: string;
}

/** 套餐配置数据 */
const PLANS: PlanConfig[] = [
  {
    key: 'free',
    oneTimePrice: '$0',
    subscriptionPrice: '$0',
    features: ['feature_2000', 'feature_5', 'feature_community'],
    ctaKey: 'signUpFree',
    href: '/auth/register',
  },
  {
    key: 'starter',
    oneTimePrice: '$4.99',
    subscriptionPrice: '$3.99',
    features: ['feature_50000', 'feature_50', 'feature_email'],
    ctaKey: 'buyNow',
    href: '/auth/register',
  },
  {
    key: 'pro',
    oneTimePrice: '$14.99',
    subscriptionPrice: '$11.99',
    popular: true,
    features: [
      'feature_200000',
      'feature_200',
      'feature_priority',
      'feature_api',
    ],
    ctaKey: 'subscribe',
    href: '/auth/register',
  },
  {
    key: 'developer',
    oneTimePrice: '$49.99',
    subscriptionPrice: '$39.99',
    features: [
      'feature_1000000',
      'feature_1000',
      'feature_sla',
      'feature_api',
    ],
    ctaKey: 'getApiKey',
    href: '/auth/register',
  },
];

export default function PricingPage() {
  const t = useTranslations('pricing');

  // 当前选中的计费周期
  const [cycle, setCycle] = useState<BillingCycle>('oneTime');

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* ============ 页面标题 ============ */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          {t('title')}
        </h1>

        {/* ============ 计费周期切换开关 ============ */}
        <div className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-brand-card p-1">
          {/* 一次性购买 */}
          <button
            onClick={() => setCycle('oneTime')}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium transition-colors',
              cycle === 'oneTime'
                ? 'bg-brand-gradient text-white'
                : 'text-text-secondary hover:text-white',
            )}
          >
            {t('oneTime')}
          </button>
          {/* 按月订阅 */}
          <button
            onClick={() => setCycle('subscription')}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium transition-colors',
              cycle === 'subscription'
                ? 'bg-brand-gradient text-white'
                : 'text-text-secondary hover:text-white',
            )}
          >
            {t('subscription')}
          </button>
        </div>
      </div>

      {/* ============ 套餐卡片网格 ============ */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          // 当前计费周期对应的价格
          const price =
            cycle === 'oneTime'
              ? plan.oneTimePrice
              : plan.subscriptionPrice;
          // 是否为最受欢迎套餐
          const isPopular = plan.popular;

          return (
            <div
              key={plan.key}
              className={cn(
                'relative flex flex-col rounded-2xl border p-6 transition-all',
                isPopular
                  ? 'border-brand-primary bg-gradient-to-b from-brand-primary/10 to-brand-card lg:scale-105'
                  : 'border-white/5 bg-brand-card hover:border-white/10',
              )}
            >
              {/* Most Popular 徽章 */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1 text-xs font-medium text-white shadow-lg">
                    <Star className="h-3 w-3 fill-current" />
                    {t('popular')}
                  </span>
                </div>
              )}

              {/* 套餐名称 */}
              <h3 className="text-lg font-bold text-white">
                {t(plan.key)}
              </h3>

              {/* 价格 */}
              <div className="mt-4">
                <span className="text-3xl font-bold text-white">
                  {price}
                </span>
                {/* 订阅周期显示 /月 */}
                {cycle === 'subscription' && plan.key !== 'free' && (
                  <span className="text-sm text-text-secondary">/mo</span>
                )}
              </div>

              {/* 功能列表 */}
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <Check
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        isPopular ? 'text-brand-primary' : 'text-brand-success',
                      )}
                    />
                    <span>{t(feature)}</span>
                  </li>
                ))}
              </ul>

              {/* 行动按钮 */}
              <Link
                href={plan.href}
                className={cn(
                  'mt-6 block rounded-lg py-2.5 text-center text-sm font-medium transition-all',
                  isPopular
                    ? 'bg-brand-gradient text-white hover:opacity-90'
                    : 'border border-white/10 text-white hover:bg-white/5',
                )}
              >
                {t(plan.ctaKey)}
              </Link>
            </div>
          );
        })}
      </div>

      {/* ============ 底部说明 ============ */}
      <p className="mt-10 text-center text-sm text-text-tertiary">
        {t('note')}
      </p>
    </div>
  );
}
