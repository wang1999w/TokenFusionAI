'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  getDashboardOverview,
  type DashboardOverview,
  type DashboardStats,
} from '@/lib/api/admin';
import { cn } from '@/lib/utils/cn';
import { ApiError } from '@/lib/api/request';
import {
  Loader2,
  Users,
  UserPlus,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

/**
 * AdminDashboardPage 数据看板页
 *
 * 功能：
 * 1. 4 个统计卡片：DAU / 注册量 / 充值额 / API 调用量
 * 2. 消耗趋势图（Recharts LineChart，近 14 天 Token 消耗趋势）
 * 3. 各功能占比饼图（Recharts PieChart，chat/image/video/code 调用占比）
 *
 * 样式：
 * - 统计卡片使用 #111827 背景卡片
 * - 图表区域深色主题适配（轴线/文字使用浅色）
 */

/** 饼图配色方案（4 种功能对应 4 种颜色） */
const PIE_COLORS = ['#06B6D4', '#3B82F6', '#8B5CF6', '#10B981'];

/** 统计卡片配置项 */
interface StatCardConfig {
  key: keyof DashboardStats;
  /** dashboard 命名空间下的文案 key（不含前缀） */
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 数值格式化前缀 */
  prefix?: string;
  /** 数值格式化后缀 */
  suffix?: string;
  /** 图标背景色 class */
  iconBg: string;
  /** 图标颜色 class */
  iconColor: string;
}

/** 功能名称本地化映射（dashboard 命名空间下的 key） */
const FEATURE_NAME_KEYS: Record<string, string> = {
  chat: 'featureChat',
  image: 'featureImage',
  video: 'featureVideo',
  code: 'featureCode',
};

export default function AdminDashboardPage() {
  const t = useTranslations('admin');
  const tDashboard = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  // ============ 状态定义 ============
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============ 数据获取 ============
  /**
   * 拉取看板聚合数据
   */
  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardOverview();
      setOverview(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('errors.fetchFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  // 首次挂载拉取数据
  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 统计卡片配置 */
  const statCards: StatCardConfig[] = [
    {
      key: 'dau',
      labelKey: 'statDau',
      icon: Users,
      iconBg: 'bg-cyan-500/15',
      iconColor: 'text-cyan-400',
    },
    {
      key: 'newRegistrations',
      labelKey: 'statRegistrations',
      icon: UserPlus,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
    },
    {
      key: 'rechargeAmount',
      labelKey: 'statRecharge',
      icon: DollarSign,
      prefix: '¥',
      iconBg: 'bg-green-500/15',
      iconColor: 'text-green-400',
    },
    {
      key: 'apiCalls',
      labelKey: 'statApiCalls',
      icon: Activity,
      iconBg: 'bg-purple-500/15',
      iconColor: 'text-purple-400',
    },
  ];

  /** 格式化数值（千分位 + 前后缀） */
  const formatStatValue = (
    value: number,
    prefix?: string,
    suffix?: string,
  ): string => {
    return `${prefix ?? ''}${value.toLocaleString()}${suffix ?? ''}`;
  };

  /** 格式化日期（仅月-日，用于趋势图 X 轴） */
  const formatTrendDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return iso;
    }
  };

  // ============ 加载状态 ============
  if (loading && !overview) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  // ============ 错误状态 ============
  if (error && !overview) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-300">{error}</p>
        <button
          onClick={fetchOverview}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
        >
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  // 兜底：无数据
  if (!overview) return null;

  return (
    <div className="space-y-6">
      {/* ============ 页面标题 + 刷新按钮 ============ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {t('dashboard.title')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          {t('dashboard.refresh')}
        </button>
      </div>

      {/* ============ 统计卡片区域（4 列） ============ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = overview.stats[card.key];
          return (
            <div
              key={card.key}
              className="rounded-xl border border-white/5 bg-brand-card p-5"
            >
              {/* 图标 + 标签 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  {tDashboard(card.labelKey)}
                </span>
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    card.iconBg,
                  )}
                >
                  <Icon className={cn('h-4 w-4', card.iconColor)} />
                </span>
              </div>
              {/* 数值 */}
              <p className="mt-3 text-2xl font-bold text-white">
                {formatStatValue(value, card.prefix, card.suffix)}
              </p>
            </div>
          );
        })}
      </div>

      {/* ============ 消耗趋势图（折线图） ============ */}
      <div className="rounded-xl border border-white/5 bg-brand-card p-6">
        <h3 className="text-sm font-semibold text-white">
          {t('dashboard.consumptionTrend')}
        </h3>
        <p className="mt-1 text-xs text-text-tertiary">
          {t('dashboard.trendHint')}
        </p>

        {/* Recharts 折线图容器 */}
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={overview.trend}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              {/* 网格线（浅色） */}
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              {/* X 轴：日期 */}
              <XAxis
                dataKey="date"
                tickFormatter={formatTrendDate}
                stroke="#475569"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              {/* Y 轴：Token 数 */}
              <YAxis
                stroke="#475569"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              {/* 悬浮提示框（深色主题适配） */}
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8' }}
                labelFormatter={formatTrendDate}
              />
              {/* Token 消耗折线 */}
              <Line
                type="monotone"
                dataKey="tokens"
                name={t('dashboard.tokensAxis')}
                stroke="#06B6D4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ============ 各功能占比饼图 ============ */}
      <div className="rounded-xl border border-white/5 bg-brand-card p-6">
        <h3 className="text-sm font-semibold text-white">
          {t('dashboard.featureUsage')}
        </h3>
        <p className="mt-1 text-xs text-text-tertiary">
          {t('dashboard.featureUsageHint')}
        </p>

        {/* Recharts 饼图容器 */}
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* 饼图本体 */}
              <Pie
                data={overview.featureUsage}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
              >
                {/* 为每个扇区分配颜色 */}
                {overview.featureUsage.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
              {/* 悬浮提示框 */}
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [value, t('dashboard.calls')]}
              />
              {/* 图例（功能名称本地化） */}
              <Legend
                formatter={(value: string) =>
                  FEATURE_NAME_KEYS[value]
                    ? tDashboard(FEATURE_NAME_KEYS[value])
                    : value
                }
                wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
