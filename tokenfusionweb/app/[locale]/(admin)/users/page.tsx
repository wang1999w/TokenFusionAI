'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  getAdminUsers,
  banUser,
  unbanUser,
  adjustUserTokens,
  type AdminUser,
  type PageQuery,
} from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { ApiError } from '@/lib/api/request';
import {
  Search,
  Loader2,
  Ban,
  CheckCircle,
  Coins,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * AdminUsersPage 用户管理页
 *
 * 功能：
 * 1. 用户列表表格（id / email / role / status / token余额 / 注册时间）
 * 2. 搜索框（按邮箱搜索，支持防抖触发）
 * 3. 封禁 / 解封按钮
 * 4. 调整 Token 额度按钮（弹窗输入数量）
 *
 * 样式：
 * - 表格使用浅色卡片（#111827 背景）以与后台深色主题区分
 * - 状态、角色使用彩色徽章
 */

/** 默认每页条数 */
const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  // ============ 状态定义 ============
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 调整 Token 弹窗状态
  const [adjustTarget, setAdjustTarget] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // 操作中状态（按钮 loading）
  const [actionId, setActionId] = useState<number | null>(null);

  // ============ 数据获取 ============
  /**
   * 拉取用户列表
   * 根据当前页码与搜索关键字请求后端
   */
  const fetchUsers = useCallback(async (query: PageQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUsers(query);
      setUsers(res.list);
      setTotal(res.total);
    } catch (err) {
      // 错误处理：区分网络错误与其他错误
      const msg =
        err instanceof ApiError ? err.message : t('errors.fetchFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 页码或关键字变化时重新拉取
  useEffect(() => {
    fetchUsers({ page, pageSize: PAGE_SIZE, keyword: keyword || undefined });
  }, [page, keyword, fetchUsers]);

  // ============ 事件处理 ============

  /** 搜索输入防抖：500ms 无输入后触发搜索 */
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchInput);
      setPage(1); // 搜索时重置到第一页
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /** 封禁 / 解封用户 */
  const handleToggleBan = async (user: AdminUser) => {
    setActionId(user.id);
    try {
      if (user.status === 'banned') {
        await unbanUser(user.id);
      } else {
        await banUser(user.id);
      }
      // 操作成功后刷新列表
      fetchUsers({ page, pageSize: PAGE_SIZE, keyword: keyword || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.actionFailed'));
    } finally {
      setActionId(null);
    }
  };

  /** 打开调整 Token 弹窗 */
  const openAdjustModal = (user: AdminUser) => {
    setAdjustTarget(user);
    setAdjustAmount('');
    setAdjustReason('');
  };

  /** 提交调整 Token */
  const handleAdjustTokens = async () => {
    if (!adjustTarget) return;
    const amount = Number(adjustAmount);
    if (!adjustAmount || Number.isNaN(amount) || amount === 0) {
      setError(t('errors.invalidAmount'));
      return;
    }
    setAdjusting(true);
    try {
      await adjustUserTokens(adjustTarget.id, {
        amount,
        reason: adjustReason || undefined,
      });
      // 调整成功，关闭弹窗并刷新
      setAdjustTarget(null);
      fetchUsers({ page, pageSize: PAGE_SIZE, keyword: keyword || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.actionFailed'));
    } finally {
      setAdjusting(false);
    }
  };

  /** 关闭调整弹窗 */
  const closeAdjustModal = () => {
    setAdjustTarget(null);
    setError(null);
  };

  /** 计算总页数 */
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** 格式化日期 */
  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* ============ 页面标题 + 搜索框 ============ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {t('users.title')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('users.subtitle')}
          </p>
        </div>

        {/* 搜索框 */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('users.searchPlaceholder')}
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

      {/* ============ 用户列表表格 ============ */}
      {/* 卡片容器：#111827 浅色（相对后台深色主题而言的卡片背景） */}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-brand-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-xs uppercase text-text-secondary">
                <th className="px-4 py-3 font-medium">{t('users.colId')}</th>
                <th className="px-4 py-3 font-medium">{t('users.colEmail')}</th>
                <th className="px-4 py-3 font-medium">{t('users.colRole')}</th>
                <th className="px-4 py-3 font-medium">{t('users.colStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('users.colTokens')}</th>
                <th className="px-4 py-3 font-medium">{t('users.colCreatedAt')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('users.colActions')}</th>
              </tr>
            </thead>

            {/* 表体 */}
            <tbody>
              {loading ? (
                // 加载中占位
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-primary" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                // 空状态
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                    {t('users.empty')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/5"
                  >
                    {/* ID */}
                    <td className="px-4 py-3 text-text-secondary">{user.id}</td>

                    {/* 邮箱 */}
                    <td className="px-4 py-3 font-medium text-white">
                      {user.email}
                    </td>

                    {/* 角色 */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          user.role === 'admin'
                            ? 'bg-brand-primary/15 text-brand-primary'
                            : 'bg-white/10 text-text-secondary',
                        )}
                      >
                        {user.role === 'admin'
                          ? t('users.roleAdmin')
                          : t('users.roleUser')}
                      </span>
                    </td>

                    {/* 状态 */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-medium',
                          user.status === 'active'
                            ? 'text-brand-success'
                            : 'text-red-400',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            user.status === 'active'
                              ? 'bg-brand-success'
                              : 'bg-red-400',
                          )}
                        />
                        {user.status === 'active'
                          ? t('users.statusActive')
                          : t('users.statusBanned')}
                      </span>
                    </td>

                    {/* Token 余额 */}
                    <td className="px-4 py-3 text-text-secondary">
                      {user.tokenBalance.toLocaleString()}
                    </td>

                    {/* 注册时间 */}
                    <td className="px-4 py-3 text-text-tertiary">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* 操作按钮 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* 调整 Token 额度 */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustModal(user)}
                          disabled={actionId === user.id}
                        >
                          <Coins className="mr-1 h-3.5 w-3.5" />
                          {t('users.adjustTokens')}
                        </Button>

                        {/* 封禁 / 解封 */}
                        <Button
                          size="sm"
                          variant={user.status === 'banned' ? 'default' : 'destructive'}
                          onClick={() => handleToggleBan(user)}
                          disabled={actionId === user.id || user.role === 'admin'}
                        >
                          {actionId === user.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : user.status === 'banned' ? (
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          ) : (
                            <Ban className="mr-1 h-3.5 w-3.5" />
                          )}
                          {user.status === 'banned'
                            ? t('users.unban')
                            : t('users.ban')}
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
            {t('users.totalCount', { total })}
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

      {/* ============ 调整 Token 弹窗 ============ */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeAdjustModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-brand-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <h3 className="text-lg font-semibold text-white">
              {t('users.adjustTitle')}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {t('users.adjustTarget')}:{' '}
              <span className="text-white">{adjustTarget.email}</span>
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {t('users.currentBalance')}:{' '}
              {adjustTarget.tokenBalance.toLocaleString()}
            </p>

            {/* 调整数量输入 */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs text-text-secondary">
                  {t('users.amountLabel')}
                </label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder={t('users.amountPlaceholder')}
                  autoFocus
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  {t('users.amountHint')}
                </p>
              </div>

              {/* 调整原因输入 */}
              <div>
                <label className="mb-1.5 block text-xs text-text-secondary">
                  {t('users.reasonLabel')}
                </label>
                <Input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={t('users.reasonPlaceholder')}
                />
              </div>
            </div>

            {/* 弹窗操作按钮 */}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={closeAdjustModal}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleAdjustTokens} disabled={adjusting}>
                {adjusting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {tCommon('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
