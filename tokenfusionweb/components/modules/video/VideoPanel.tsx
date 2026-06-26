'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Video, Sparkles, Loader2, Film, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useVideoGeneration } from '@/hooks/useGeneration';
import type { VideoTaskStatus } from '@/lib/api/generation';
import { cn } from '@/lib/utils/cn';

/**
 * 可选视频模型
 */
const VIDEO_MODELS = [
  { id: 'sora', label: 'Sora' },
  { id: 'gen-3', label: 'Gen-3 Alpha' },
  { id: 'kling', label: 'Kling' },
  { id: 'runway-gen2', label: 'Runway Gen-2' },
];

/** 可选时长（秒） */
const DURATIONS = [5, 10, 15];

/**
 * VideoPanel 视频生成面板
 *
 * 布局：左右分栏
 * - 左侧：prompt 输入 + 参数（model / duration）
 * - 右侧：预览区（进度条 / 异步轮询状态 / 视频播放器）
 *
 * 状态：
 * - 提交中：提交动画
 * - 轮询中：进度条 + 状态文案
 * - 成功：视频播放器
 * - 失败：错误提示
 */
export function VideoPanel({ onQuotaExhausted }: { onQuotaExhausted?: () => void }) {
  const t = useTranslations('tools');
  const tVideo = useTranslations('video');

  const { task, isSubmitting, isPolling, progress, quotaExhausted, generate, cancelPolling } =
    useVideoGeneration();

  // 表单状态
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(VIDEO_MODELS[0].id);
  const [duration, setDuration] = useState(DURATIONS[0]);

  /**
   * 额度耗尽时通知父组件（触发弹窗）
   */
  useEffect(() => {
    if (quotaExhausted) onQuotaExhausted?.();
  }, [quotaExhausted, onQuotaExhausted]);

  /**
   * 提交生成
   */
  const handleGenerate = () => {
    const text = prompt.trim();
    if (!text || isSubmitting) return;
    void generate({ prompt: text, model, duration });
  };

  /** Ctrl/Cmd + Enter 提交 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  /**
   * 渲染状态图标
   */
  const renderStatusIcon = (status?: VideoTaskStatus) => {
    if (isSubmitting) return <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />;
    if (status === 'succeeded') return <CheckCircle2 className="h-4 w-4 text-brand-success" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-red-400" />;
    if (isPolling) return <Clock className="h-4 w-4 text-brand-warning" />;
    return null;
  };

  /**
   * 获取状态文案
   */
  const statusLabel = (status?: VideoTaskStatus): string => {
    if (isSubmitting) return t('generating');
    switch (status) {
      case 'pending':
        return tVideo('statusPending');
      case 'processing':
        return tVideo('statusProcessing');
      case 'succeeded':
        return tVideo('statusSucceeded');
      case 'failed':
        return tVideo('statusFailed');
      default:
        return tVideo('empty');
    }
  };

  // 是否生成中（提交或轮询）
  const isActive = isSubmitting || isPolling;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* 左侧：输入区 */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/5 bg-brand-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Video className="h-4 w-4 text-brand-primary" />
          {tVideo('title')}
        </div>

        {/* Prompt 输入 */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">{t('prompt')}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tVideo('placeholder')}
            rows={5}
            className={cn(
              'w-full resize-none rounded-lg border border-gray-700 bg-[#0b1120] px-3 py-2 text-sm text-white placeholder:text-text-tertiary',
              'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30',
            )}
          />
        </div>

        {/* 模型选择 */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">{t('model')}</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-[#0b1120] px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
          >
            {VIDEO_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-brand-card">
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 时长选择 */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">{t('duration')}</label>
          <div className="grid grid-cols-3 gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-xs transition-colors',
                  duration === d
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-white/10 text-text-secondary hover:bg-white/5',
                )}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        {/* 生成 / 取消按钮 */}
        {isActive ? (
          <button
            type="button"
            onClick={cancelPolling}
            className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
          >
            {t('stop')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {tVideo('generate')}
          </button>
        )}
      </div>

      {/* 右侧：预览区 */}
      <div className="flex min-h-[400px] flex-col rounded-xl border border-white/5 bg-brand-card p-4">
        {/* 状态栏 */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          {renderStatusIcon(task?.status)}
          <span className="text-text-secondary">{statusLabel(task?.status)}</span>
        </div>

        {/* 内容区 */}
        {!task ? (
          // 空状态
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
              <Film className="h-6 w-6 text-text-tertiary" />
            </div>
            <p className="text-sm text-text-secondary">{tVideo('empty')}</p>
          </div>
        ) : task.status === 'succeeded' && task.videoUrl ? (
          // 成功：视频播放器
          <div className="flex flex-1 items-center justify-center">
            <video
              src={task.videoUrl}
              controls
              autoPlay
              loop
              className="max-h-[440px] w-full rounded-lg"
              poster={task.coverUrl}
            />
          </div>
        ) : task.status === 'failed' ? (
          // 失败
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-400">{task.error || tVideo('statusFailed')}</p>
          </div>
        ) : (
          // 生成中：进度条 + 动画
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            </div>
            {/* 进度条 */}
            <div className="w-full max-w-md">
              <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
                <span>{tVideo('progress')}</span>
                <span className="font-medium text-brand-primary">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-brand-gradient transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-text-tertiary">{tVideo('processingHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
