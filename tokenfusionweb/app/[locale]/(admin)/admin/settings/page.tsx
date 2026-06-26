'use client';

import { useTranslations } from 'next-intl';
import { Settings, Globe, DollarSign, Bell, Shield } from 'lucide-react';

/**
 * AdminSettingsPage 系统配置页
 *
 * 功能：
 * 1. 基础配置（站点名称、默认语言、时区）
 * 2. 支付配置（支持的支付方式、货币）
 * 3. 通知配置（邮件通知开关）
 * 4. 安全配置（IP 白名单、2FA 要求）
 */
export default function AdminSettingsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const sections = [
    {
      icon: Globe,
      title: t('settings.general'),
      items: [
        { label: t('settings.siteName'), value: 'TokenFusion AI' },
        { label: t('settings.defaultLanguage'), value: 'English' },
        { label: t('settings.timezone'), value: 'UTC+08:00' },
      ],
    },
    {
      icon: DollarSign,
      title: t('settings.payment'),
      items: [
        { label: t('settings.supportedMethods'), value: 'Visa, Mastercard, PayPal, Alipay, WeChat' },
        { label: t('settings.defaultCurrency'), value: 'USD ($)' },
      ],
    },
    {
      icon: Bell,
      title: t('settings.notifications'),
      items: [
        { label: t('settings.emailNotification'), value: t('settings.enabled') },
        { label: t('settings.orderAlert'), value: t('settings.enabled') },
      ],
    },
    {
      icon: Shield,
      title: t('settings.security'),
      items: [
        { label: t('settings.ipWhitelist'), value: t('settings.notConfigured') },
        { label: t('settings.twoFactor'), value: t('settings.disabled') },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-bold text-white">
          {t('settings.title')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* 配置区域 */}
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <div
            key={section.title}
            className="rounded-xl border border-white/5 bg-brand-card p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10">
                <Icon className="h-4 w-4 text-brand-primary" />
              </span>
              <h3 className="text-sm font-semibold text-white">
                {section.title}
              </h3>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-sm text-text-secondary">
                    {item.label}
                  </span>
                  <span className="text-sm text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
