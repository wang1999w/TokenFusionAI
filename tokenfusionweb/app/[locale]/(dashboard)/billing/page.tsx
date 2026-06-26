'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  getBillingOverview,
  getBillingTransactions,
  type BillingOverview,
  type BillingTransaction,
  type TransactionType,
} from '@/lib/api/dashboard';
import { cn } from '@/lib/utils/cn';
import { ApiError } from '@/lib/api/request';
import { Loader2, Wallet, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * BillingPage 账单页
 *
 * 功能：
 * 1. Token 余额展示（大数字卡片 + 总消耗 / 总充值统计）
 * 2. 消耗趋势图（Recharts AreaChart，近 14 天）
 * 3. 流水列表（充值 / 消耗 / 退款 / 调整，含金额与时间）
 *
 * 样式：
 * - 余额卡片 #111827 背景，突出主余额
 * - 流水列表使用浅色卡片表格
 * - 充值绿色、消耗红色，便于区分
 */

/** 默认每页条数 */
const PAGE_SIZE = 10;

/** 流水类型对应颜色（正负号） */
const TRANSACTION_COLORS: Record<TransactionType, string> = {
  recharge: 'text-brand-success',
  consumption: 'text-red-400',
  refund: 'text-brand-success',
  adjustment: 'text-blue-400',
};

export default function BillingPage() {
  const t = useTranslations('billing');
  const tCommon = useTranslations('common');

  // ============ 状态定义 ============
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ 数据获取 ============
  /** 拉取账单概览（余额 + 统计 + 趋势） */
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  /** 拉取流水列表 */
  const fetchTransactions = useCallback(
    async (p: number) => {
      setTxnLoading(true);
      try {
        const res = await getBillingTransactions({
          page: p,
          pageSize: PAGE_SIZE,
        });
        setTransactions(res.list);
        setTotal(res.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('errors.fetchFailed'));
      } finally {
        setTxnLoading(false);
      }
    },
    [t],
  );

  // 首次挂载拉取两部分数据
  useEffect(() => {
    fetchOverview();
    fetchTransactions(1);
  }, [fetchOverview, fetchTransactions]);

  // 页码变化时拉取流水
  useEffect(() => {
    if (page > 1) fetchTransactions(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /** 计算总页数 */
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** 格式化日期（仅月-日，用于趋势图 X 轴） */
  const formatTrendDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return iso;
    }
  };

  /** 格式化流水时间 */
  const formatDateTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  /** 流水金额格式化（带正负号） */
  const formatTxnAmount = (txn: BillingTransaction): string => {
    const sign = txn.amount >= 0 ? '+' : '';
    return `${sign}${txn.amount.toLocaleString()}`;
  };

  /** 流水类型本地化文案 */
  const getTxnTypeLabel = (type: TransactionType): string => {
    const map: Record<TransactionType, string> = {
      recharge: t('typeRecharge'),
      consumption: t('typeConsumption'),
      refund: t('typeRefund'),
      adjustment: t('typeAdjustment'),
    };
    return map[type];
  };

  // ============ 加载状态 ============
  if (loading && !overview) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============ 页面标题 ============ */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
      </div>

      {/* ============ 错误提示 ============ */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          <button
            onClick={() => {
              setError(null);
              fetchOverview();
              fetchTransactions(page);
            }}
            className="ml-2 text-red-400 underline"
          >
            {tCommon('retry')}
          </button>
        </div>
      )}

      {/* ============ 余额展示区（3 列卡片） ============ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 主余额卡片 */}
        <div className="rounded-xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary/10 to-transparent p-6 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {t('tokenBalance')}
            </span>
            <Wallet className="h-5 w-5 text-brand-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold text-white">
            {overview?.tokenBalance.toLocaleString() ?? '0'}
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-block text-xs text-brand-primary hover:underline"
          >
            {t('rechargeNow')} →
          </Link>
        </div>

        {/* 总消耗卡片 */}
        <div className="rounded-xl border border-white/5 bg-brand-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {t('totalConsumed')}
            </span>
            <TrendingDown className="h-5 w-5 text-red-400" />
          </div>
          <p className="mt-3 text-2xl font-bold text-white">
            {overview?.totalConsumed.toLocaleString() ?? '0'}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">{t('tokens')}</p>
        </div>

        {/* 总充值卡片 */}
        <div className="rounded-xl border border-white/5 bg-brand-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {t('totalRecharged')}
            </span>
            <TrendingUp className="h-5 w-5 text-brand-success" />
          </div>
          <p className="mt-3 text-2xl font-bold text-white">
            {overview?.totalRecharged.toLocaleString() ?? '0'}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">{t('tokens')}</p>
        </div>
      </div>

      {/* ============ 消耗趋势图（面积图） ============ */}
      <div className="rounded-xl border border-white/5 bg-brand-card p-6">
        <h3 className="text-sm font-semibold text-white">
          {t('consumptionTrend')}
        </h3>
        <p className="mt-1 text-xs text-text-tertiary">{t('trendHint')}</p>

        {/* Recharts 面积图容器 */}
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={overview?.trend ?? []}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              {/* 渐变定义 */}
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatTrendDate}
                stroke="#475569"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#475569"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
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
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#06B6D4"
                strokeWidth={2}
                fill="url(#tokenGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ============ 流水列表表格 ============ */}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-brand-card">
        {/* 列表标题 */}
        <div className="border-b border-white/5 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            {t('transactionsTitle')}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-xs uppercase text-text-secondary">
                <th className="px-4 py-3 font-medium">{t('colType')}</th>
                <th className="px-4 py-3 font-medium">{t('colAmount')}</th>
                <th className="px-4 py-3 font-medium">{t('colBalance')}</th>
                <th className="px-4 py-3 font-medium">{t('colRemark')}</th>
                <th className="px-4 py-3 font-medium">{t('colDate')}</th>
              </tr>
            </thead>

            {/* 表体 */}
            <tbody>
              {txnLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-primary" />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-secondary">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/5"
                  >
                    {/* 类型 */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          txn.type === 'consumption'
                            ? 'bg-red-500/10 text-red-400'
                            : txn.type === 'recharge' || txn.type === 'refund'
                              ? 'bg-brand-success/10 text-brand-success'
                              : 'bg-blue-500/10 text-blue-400',
                        )}
                      >
                        {getTxnTypeLabel(txn.type)}
                      </span>
                    </td>

                    {/* 变动金额 */}
                    <td
                      className={cn(
                        'px-4 py-3 font-mono font-medium',
                        TRANSACTION_COLORS[txn.type],
                      )}
                    >
                      {formatTxnAmount(txn)}
                    </td>

                    {/* 变动后余额 */}
                    <td className="px-4 py-3 text-text-secondary">
                      {txn.balanceAfter.toLocaleString()}
                    </td>

                    {/* 备注 */}
                    <td className="px-4 py-3 text-text-tertiary">
                      {txn.remark ?? '-'}
                    </td>

                    {/* 时间 */}
                    <td className="px-4 py-3 text-text-tertiary">
                      {formatDateTime(txn.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ============ 分页器 ============ */}
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
          <span className="text-xs text-text-tertiary">
            {t('totalCount', { total })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || txnLoading}
              className="rounded-md border border-white/10 px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              {tCommon('back')}
            </button>
            <span className="text-xs text-text-secondary">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || txnLoading}
              className="rounded-md border border-white/10 px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              {tCommon('next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
