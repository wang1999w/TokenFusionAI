'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Sparkles } from 'lucide-react';

/**
 * Footer 页脚组件
 *
 * 职责：
 * - 4 列布局：Product / Resources / Legal / Company
 * - 支付图标（Visa / Mastercard / PayPal / 支付宝等，使用 SVG 文字占位）
 * - 版权信息
 * - 社交媒体链接
 */

const PAYMENTS = ['Visa', 'Mastercard', 'PayPal', 'Alipay', 'WeChat'];

const SOCIALS = [
  { label: 'X', href: 'https://x.com' },
  { label: 'in', href: 'https://linkedin.com' },
  { label: 'GH', href: 'https://github.com' },
  { label: 'DC', href: 'https://discord.com' },
];

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  const columns: Array<{
    title: string;
    links: Array<{ label: string; href: string; external?: boolean }>;
  }> = [
    {
      title: t('product'),
      links: [
        { label: tNav('features'), href: '/#features' },
        { label: tNav('pricing'), href: '/pricing' },
        { label: tNav('api'), href: '/apidocs' },
        { label: tNav('dashboard'), href: '/dashboard' },
      ],
    },
    {
      title: t('resources'),
      links: [
        { label: tNav('docs'), href: '/apidocs' },
        { label: tNav('apiKeys'), href: '/apikeys' },
        { label: tNav('history'), href: '/history' },
        { label: 'Blog', href: '/', external: false },
      ],
    },
    {
      title: t('legal'),
      links: [
        { label: t('privacyPolicy'), href: '/legal/privacy' },
        { label: t('termsOfService'), href: '/legal/terms' },
        { label: t('refundPolicy'), href: '/legal/refund' },
      ],
    },
    {
      title: t('company'),
      links: [
        { label: 'About', href: '/', external: false },
        { label: 'Contact', href: '/', external: false },
        { label: 'Careers', href: '/', external: false },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/5 bg-brand-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* 品牌 + 社交 */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient">
                <Sparkles className="h-5 w-5 text-white" />
              </span>
              <span className="text-lg font-bold text-white">TokenFusion</span>
            </div>
            <p className="mt-3 text-sm text-text-tertiary">
              One Token, Unlimited AI
            </p>
            <div className="mt-4 flex gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-xs text-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* 4 列链接 */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white">{col.title}</h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-tertiary transition-colors hover:text-text-secondary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 支付图标 + 版权 */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-text-tertiary">{t('copyright')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {PAYMENTS.map((p) => (
              <span
                key={p}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-text-tertiary"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
