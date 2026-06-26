'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  getApiKeys,
  createApiKey,
  updateApiKeyStatus,
  deleteApiKey,
  type ApiKey,
  type CreatedApiKey,
} from '@/lib/api/dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { ApiError } from '@/lib/api/request';
import {
  Plus,
  Loader2,
  Copy,
  Check,
  Power,
  Trash2,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';

/**
 * ApiKeysPage API 密钥管理页
 *
 * 功能：
 * 1. 密钥列表（仅显示前缀，保障安全）
 * 2. 创建密钥：弹窗输入名称，创建后明文仅展示一次（需提示用户保存）
 * 3. 禁用 / 启用密钥
 * 4. 删除密钥（二次确认）
 *
 * 安全说明：
 * - 列表中永远不返回完整密钥，仅展示 keyPrefix（前 8 位）；
 * - 创建时返回的明文 plainKey 仅在创建结果弹窗中展示一次，关闭后无法再获取；
 * - 提供"复制"按钮便于用户保存明文密钥。
 */

export default function ApiKeysPage() {
  const t = useTranslations('apikeys');
  const tCommon = useTranslations('common');

  // ============ 状态定义 ============
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 创建密钥弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);

  // 创建结果（明文展示）状态
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  // 删除确认弹窗状态
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 操作中状态
  const [actionId, setActionId] = useState<number | null>(null);

  // ============ 数据获取 ============
  /** 拉取密钥列表 */
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getApiKeys();
      setKeys(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 首次挂载拉取
  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ============ 事件处理 ============

  /** 打开创建弹窗 */
  const openCreateModal = () => {
    setNewKeyName('');
    setShowCreateModal(true);
    setError(null);
  };

  /** 提交创建密钥 */
  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      setError(t('errors.nameRequired'));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await createApiKey({ name: newKeyName.trim() });
      // 创建成功：关闭创建弹窗，打开明文展示弹窗
      setShowCreateModal(false);
      setCreatedKey(result);
      setCopied(false);
      // 刷新列表
      fetchKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  /** 复制明文密钥到剪贴板 */
  const handleCopyKey = async () => {
    if (!createdKey?.plainKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.plainKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板 API 不可用时静默失败
    }
  };

  /** 关闭明文展示弹窗（明文将无法再次获取） */
  const closeCreatedModal = () => {
    setCreatedKey(null);
    setError(null);
  };

  /** 切换密钥状态（启用 / 禁用） */
  const handleToggleStatus = async (key: ApiKey) => {
    setActionId(key.id);
    try {
      const nextStatus = key.status === 'active' ? 'disabled' : 'active';
      await updateApiKeyStatus(key.id, nextStatus);
      fetchKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.actionFailed'));
    } finally {
      setActionId(null);
    }
  };

  /** 确认删除密钥 */
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteApiKey(deleteTarget.id);
      setDeleteTarget(null);
      fetchKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.actionFailed'));
    } finally {
      setDeleting(false);
    }
  };

  /** 格式化日期 */
  const formatDate = (iso?: string): string => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* ============ 页面标题 + 创建按钮 ============ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-1 h-4 w-4" />
          {t('create')}
        </Button>
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

      {/* ============ 密钥列表 ============ */}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-brand-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {/* 表头 */}
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-xs uppercase text-text-secondary">
                <th className="px-4 py-3 font-medium">{t('colName')}</th>
                <th className="px-4 py-3 font-medium">{t('colKey')}</th>
                <th className="px-4 py-3 font-medium">{t('colStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('colCreatedAt')}</th>
                <th className="px-4 py-3 font-medium">{t('colLastUsed')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
              </tr>
            </thead>

            {/* 表体 */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-primary" />
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <KeyRound className="mx-auto mb-2 h-8 w-8 text-text-tertiary" />
                    <p className="text-sm text-text-secondary">{t('empty')}</p>
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr
                    key={key.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/5"
                  >
                    {/* 名称 */}
                    <td className="px-4 py-3 font-medium text-white">
                      {key.name}
                    </td>

                    {/* 密钥前缀（仅显示前缀，加省略号） */}
                    <td className="px-4 py-3">
                      <code className="rounded bg-white/5 px-2 py-1 font-mono text-xs text-brand-primary">
                        {key.keyPrefix}••••••••
                      </code>
                    </td>

                    {/* 状态 */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium',
                          key.status === 'active'
                            ? 'bg-brand-success/15 text-brand-success'
                            : 'bg-white/10 text-text-secondary',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            key.status === 'active'
                              ? 'bg-brand-success'
                              : 'bg-text-tertiary',
                          )}
                        />
                        {key.status === 'active'
                          ? t('statusActive')
                          : t('statusDisabled')}
                      </span>
                    </td>

                    {/* 创建时间 */}
                    <td className="px-4 py-3 text-text-tertiary">
                      {formatDate(key.createdAt)}
                    </td>

                    {/* 最后使用时间 */}
                    <td className="px-4 py-3 text-text-tertiary">
                      {formatDate(key.lastUsedAt)}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* 启用 / 禁用 */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(key)}
                          disabled={actionId === key.id}
                        >
                          {actionId === key.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1">
                            {key.status === 'active'
                              ? t('disable')
                              : t('enable')}
                          </span>
                        </Button>

                        {/* 删除 */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ 创建密钥弹窗 ============ */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-brand-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/15">
                <KeyRound className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('createTitle')}
                </h3>
                <p className="text-xs text-text-secondary">{t('createSubtitle')}</p>
              </div>
            </div>

            {/* 名称输入 */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs text-text-secondary">
                {t('nameLabel')}
              </label>
              <Input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t('namePlaceholder')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
            </div>

            {/* 操作按钮 */}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {tCommon('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 创建结果（明文展示）弹窗 ============ */}
      {createdKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeCreatedModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-white/10 bg-brand-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 警告提示 */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('createdTitle')}
                </h3>
                <p className="mt-1 text-sm text-yellow-300">
                  {t('createdWarning')}
                </p>
              </div>
            </div>

            {/* 明文密钥展示区 */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs text-text-secondary">
                {t('colKey')}
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-brand-background p-3">
                <code className="flex-1 break-all font-mono text-sm text-brand-primary">
                  {createdKey.plainKey}
                </code>
                <button
                  onClick={handleCopyKey}
                  className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-brand-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="mt-6 flex justify-end">
              <Button onClick={closeCreatedModal}>{t('done')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 删除确认弹窗 ============ */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-brand-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('deleteTitle')}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {t('deleteConfirm', { name: deleteTarget.name })}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {tCommon('delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
