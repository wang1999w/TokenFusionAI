'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  getAdminOrders,
  refundOrder,
  type AdminOrder,
  type PageQuery,
  type OrderStatus,
} from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { ApiError } from '@/lib/api/request';
import {
  Search,
  Loader2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * AdminOrdersPage 订单管理页
 *
 * 功能：
 * 1. 订单列表表格（订单号 / 用户邮箱 / 套餐 / 金额 / 状态 / 时间）
 * 2. 搜索框（按订单号或用户邮箱搜索）
 * 3. 退款按钮（仅已支付订单可退款，弹窗确认）
 *
 * 样式：
 * - 表格卡片 #111827 背景
 * - 订单状态使用彩色徽章区分
 */

/** 默认每页条数 */
const PAGE_SIZE = 10;

/** 订单状态徽章样式映射 */
const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  paid: 'bg-brand-success/15 text-brand-success',
  refunded: 'bg-blue-500/15 text-blue-400',
  failed: 'bg-red-500/15 text-red-400',
};

export default function AdminOrdersPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  // ============ 状态定义 ============
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 退款确认弹窗状态
  const [refundTarget, setRefundTarget] = useState<AdminOrder | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  // 操作中状态
  const [actionOrderNo, setActionOrderNo] = useState<string | null>(null);

  // ============ 数据获取 ============
  /**
   * 拉取订单列表
   */
  const fetchOrders = useCallback(async (query: PageQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminOrders(query);
      setOrders(res.list);
      setTotal(res.total);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t('errors.fetchFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 页码或关键字变化时重新拉取
  useEffect(() => {
    fetchOrders({ page, pageSize: PAGE_SIZE, keyword: keyword || undefined });
  }, [page, keyword, fetchOrders]);

  // ============ 事件处理 ============

  /** 搜索输入防抖 */
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /** 打开退款确认弹窗 */
  const openRefundModal = (order: AdminOrder) => {
    setRefundTarget(order);
    setRefundReason('');
  };

  /** 确认退款 */
  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    setActionOrderNo(refundTarget.orderNo);
    try {
      await refundOrder(refundTarget.orderNo, {
        reason: refundReason || undefined,
      });
      // 退款成功，关闭弹窗并刷新
      setRefundTarget(null);
      fetchOrders({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.actionFailed'));
    } finally {
      setRefunding(false);
      setActionOrderNo(null);
    }
  };

  /** 关闭退款弹窗 */
  const closeRefundModal = () => {
    setRefundTarget(null);
    setError(null);
  };

  /** 计算总页数 */
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** 格式化金额 */
  const formatAmount = (amount: number, currency: string): string => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  /** 格式化日期 */
  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  /** 获取订单状态的本地化文案 */
  const getStatusLabel = (status: OrderStatus): string => {
    const map: Record<OrderStatus, string> = {
      pending: t('orders.statusPending'),
      paid: t('orders.statusPaid'),
      refunded: t('orders.statusRefunded'),
      failed: t('orders.statusFailed'),
    };
    return map[status];
  };

  return (
    <div className="space-y-6">
      {/* ============ 页面标题 + 搜索框 ============ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {t('orders.title')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('orders.subtitle')}
          </p>
        </div>

        {/* 搜索框 */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </div>

      {/* ============ 错误提示 ============ */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 underline"
          >
            {tCommon('retry')}
          </button>
        </div>
      )}

      {/* ============ 订单列表表格 ============ */}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-brand-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-xs uppercase text-text-secondary">
                <th className="px-4 py-3 font-medium">{t('orders.colOrderNo')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.colUser')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.colPlan')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.colAmount')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.colStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.colCreatedAt')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('orders.colActions')}</th>
              </tr>
            </thead>

            {/* 表体 */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-primary" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                    {t('orders.empty')}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.orderNo}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/5"
                  >
                    {/* 订单号 */}
                    <td className="px-4 py-3 font-mono text-xs text-white">
                      {order.orderNo}
                    </td>

                    {/* 用户邮箱 */}
                    <td className="px-4 py-3 text-text-secondary">
                      {order.userEmail}
                    </td>

                    {/* 套餐名称 */}
                    <td className="px-4 py-3 text-text-secondary">
                      {order.planName}
                    </td>

                    {/* 金额 */}
                    <td className="px-4 py-3 font-medium text-white">
                      {formatAmount(order.amount, order.currency)}
                    </td>

                    {/* 状态 */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          STATUS_STYLES[order.status],
                        )}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </td>

                    {/* 下单时间 */}
                    <td className="px-4 py-3 text-text-tertiary">
                      {formatDate(order.createdAt)}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {/* 仅已支付订单可退款 */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRefundModal(order)}
                          disabled={
                            order.status !== 'paid' ||
                            actionOrderNo === order.orderNo
                          }
                          title={
                            order.status !== 'paid'
                              ? t('orders.refundDisabled')
                              : undefined
                          }
                        >
                          {actionOrderNo === order.orderNo ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          )}
                          {t('orders.refund')}
                        </Button>
                      </div>
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
            {t('orders.totalCount', { total })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-text-secondary">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ============ 退款确认弹窗 ============ */}
      {refundTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeRefundModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-brand-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                <RotateCcw className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('orders.refundTitle')}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {t('orders.refundConfirm')}
                </p>
              </div>
            </div>

            {/* 订单信息 */}
            <div className="mt-4 space-y-1.5 rounded-lg bg-white/5 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-tertiary">{t('orders.colOrderNo')}</span>
                <span className="font-mono text-white">{refundTarget.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">{t('orders.colUser')}</span>
                <span className="text-white">{refundTarget.userEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">{t('orders.colAmount')}</span>
                <span className="font-medium text-white">
                  {formatAmount(refundTarget.amount, refundTarget.currency)}
                </span>
              </div>
            </div>

            {/* 退款原因输入 */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs text-text-secondary">
                {t('orders.refundReason')}
              </label>
              <Input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t('orders.refundReasonPlaceholder')}
                autoFocus
              />
            </div>

            {/* 弹窗操作按钮 */}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={closeRefundModal}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmRefund}
                disabled={refunding}
              >
                {refunding && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t('orders.confirmRefund')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
