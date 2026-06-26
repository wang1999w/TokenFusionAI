'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';

/**
 * 用户中心首页
 * 展示用户基本信息和欢迎内容
 */
export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
      <div className="rounded-xl bg-brand-card p-6">
        <p className="text-text-secondary">
          {t('title')}, {user?.email}
        </p>
      </div>
    </div>
  );
}
