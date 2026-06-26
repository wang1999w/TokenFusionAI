'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  getGenerationHistory,
  deleteGenerationHistory,
  type GenerationHistoryItem,
  type GenerationType,
} from '@/lib/api/dashboard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { ApiError } from '@/lib/api/request';
import {
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ImageIcon,
  Video,
  Code2,
  Clock,
  Coins,
} from 'lucide-react';

/**
 * HistoryPage 生成历史页
 *
 * 功能：
 * 1. 历史列表（卡片式展示，含类型 / 模型 / 提示词 / Token 消耗 / 时间）
 * 2. 按类型筛选（全部 / 对话 / 图像 / 视频 / 代码）
 * 3. 删除按钮（二次确认）
 *
 * 样式：
 * - 卡片网格布局（响应式）
 * - 类型图标与颜色区分
 */

/** 默认每页条数 */
const PAGE_SIZE = 12;

/** 类型筛选选项 */
const FILTER_OPTIONS: Array<{ value: GenerationType | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'chat', labelKey: 'filterChat' },
  { value: 'image', labelKey: 'filterImage' },
  { value: 'video', labelKey: 'filterVideo' },
  { value: 'code', labelKey: 'filterCode' },
];

/** 类型图标映射 */
const TYPE_ICONS: Record<GenerationType, React.ComponentType<{ className?: string }>> = {
  chat: MessageSquare,
  image: ImageIcon,
  video: Video,
  code: Code2,
};

/** 类型颜色映射 */
const TYPE_COLORS: Record<GenerationType, string> = {
  chat: 'bg-cyan-500/15 text-cyan-400',
  image: 'bg-blue-500/15 text-blue-400',
  video: 'bg-purple-500/15 text-purple-400',
  code: 'bg-green-500/15 text-green-400',
};

export default function HistoryPage() {
  const t = useTranslations('history');
  const tTools = useTranslations('tools');
  const tCommon = useTranslations('common');

  // ============ 状态定义 ============
  const [items, setItems] = useState<GenerationHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<GenerationType | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 删除确认弹窗状态
  const [deleteTarget, setDeleteTarget] = useState<GenerationHistoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ============ 数据获取 ============
  /**
   * 拉取生成历史列表
   * @param p 页码
   * @param type 类型筛选
   */
  const fetchHistory = useCallback(
    async (p: number, type: GenerationType | 'all') => {
      setLoading(true);
      setError(null);
      try {
        const res = await getGenerationHistory({
          page: p,
          pageSize: PAGE_SIZE,
          type: type === 'all' ? undefined : type,
        });
        setItems(res.list);
        setTotal(res.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('errors.fetchFailed'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // 页码或筛选变化时重新拉取
  useEffect(() => {
    fetchHistory(page, filter);
  }, [page, filter, fetchHistory]);

  // ============ 事件处理 ============

  /** 切换类型筛选 */
  const handleFilterChange = (value: GenerationType | 'all') => {
    setFilter(value);
    setPage(1); // 切换筛选时重置到第一页
  };

  /** 打开删除确认弹窗 */
  const openDeleteModal = (item: GenerationHistoryItem) => {
    setDeleteTarget(item);
  };

  /** 确认删除 */
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteGenerationHistory(deleteTarget.id);
      setDeleteTarget(null);
      // 删除后刷新当前页
      fetchHistory(page, filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  /** 关闭删除弹窗 */
  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setError(null);
  };

  /** 计算总页数 */
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** 格式化时间（相对时间 + 绝对时间） */
  const formatTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  /** 获取类型本地化文案 */
  const getTypeLabel = (type: GenerationType): string => {
    const map: Record<GenerationType, string> = {
      chat: tTools('chat'),
      image: tTools('image'),
      video: tTools('video'),
      code: tTools('code'),
    };
    return map[type];
  };

  return (
    <div className="space-y-6">
      {/* ============ 页面标题 ============ */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
      </div>

      {/* ============ 类型筛选 Tab ============ */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value)}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm transition-colors',
              filter === option.value
                ? 'border-brand-primary bg-brand-primary/15 text-brand-primary'
                : 'border-white/10 text-text-secondary hover:bg-white/5 hover:text-white',
            )}
          >
            {t(option.labelKey)}
          </button>
        ))}
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

      {/* ============ 历史列表（卡片网格） ============ */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      ) : items.length === 0 ? (
        // 空状态
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-white/5 bg-brand-card text-center">
          <Clock className="mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-sm text-text-secondary">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <div
                key={item.id}
                className="group flex flex-col rounded-xl border border-white/5 bg-brand-card p-4 transition-colors hover:border-white/10"
              >
                {/* 卡片头部：类型图标 + 状态 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        TYPE_COLORS[item.type],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-white">
                      {getTypeLabel(item.type)}
                    </span>
                  </div>
                  {/* 状态徽章 */}
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      item.status === 'success'
                        ? 'bg-brand-success/15 text-brand-success'
                        : 'bg-red-500/15 text-red-400',
                    )}
                  >
                    {item.status === 'success'
                      ? t('statusSuccess')
                      : t('statusFailed')}
                  </span>
                </div>

                {/* 提示词（截断展示） */}
                <p className="mt-3 line-clamp-2 flex-1 text-xs text-text-secondary">
                  {item.prompt}
                </p>

                {/* 结果预览（图片类型展示缩略图） */}
                {item.type === 'image' && item.resultPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.resultPreview}
                    alt={item.prompt}
                    className="mt-3 h-32 w-full rounded-lg object-cover"
                  />
                )}

                {/* 卡片底部：模型 + Token 消耗 + 时间 */}
                <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs text-text-tertiary">
                  <div className="flex items-center justify-between">
                    <span>{tTools('model')}</span>
                    <span className="text-text-secondary">{item.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {t('tokensUsed')}
                    </span>
                    <span className="text-text-secondary">
                      {item.tokensUsed.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t('createdAt')}
                    </span>
                    <span className="text-text-secondary">
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* 删除按钮（悬浮显示） */}
                <button
                  onClick={() => openDeleteModal(item)}
                  className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-white/10 py-1.5 text-xs text-text-secondary opacity-0 transition-opacity hover:border-red-500/30 hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {tCommon('delete')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ 分页器 ============ */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            {t('totalCount', { total })}
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
      )}

      {/* ============ 删除确认弹窗 ============ */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeDeleteModal}
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
                  {t('deleteConfirm')}
                </p>
              </div>
            </div>

            {/* 删除目标预览 */}
            <div className="mt-4 rounded-lg bg-white/5 p-3 text-xs text-text-tertiary">
              <span className="line-clamp-2">{deleteTarget.prompt}</span>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={closeDeleteModal}>
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
