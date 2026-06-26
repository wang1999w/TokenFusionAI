'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { useImageGeneration } from '@/hooks/useGeneration';
import { ResultCard } from './ResultCard';
import { cn } from '@/lib/utils/cn';

/**
 * 可选图片模型
 */
const IMAGE_MODELS = [
  { id: 'dall-e-3', label: 'DALL·E 3' },
  { id: 'dall-e-2', label: 'DALL·E 2' },
  { id: 'stable-diffusion-xl', label: 'Stable Diffusion XL' },
  { id: 'flux-pro', label: 'FLUX Pro' },
];

/** 可选尺寸 */
const IMAGE_SIZES = ['1024x1024', '1024x1792', '1792x1024'];

/** 可选生成数量 */
const IMAGE_COUNTS = [1, 2, 4];

/**
 * ImagePanel 图片生成面板
 *
 * 布局：左右分栏
 * - 左侧：prompt 输入 + 参数（model / size / n）
 * - 右侧：结果网格（grid-cols-2），每张图片 hover 显示下载/分享
 *
 * 状态：
 * - 生成中显示 loading 骨架屏
 * - 空状态显示占位提示
 */
export function ImagePanel({ onQuotaExhausted }: { onQuotaExhausted?: () => void }) {
  const t = useTranslations('tools');
  const tImage = useTranslations('image');

  const { results, isLoading, quotaExhausted, generate } = useImageGeneration();

  // 表单状态
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(IMAGE_MODELS[0].id);
  const [size, setSize] = useState(IMAGE_SIZES[0]);
  const [count, setCount] = useState(1);

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
    if (!text || isLoading) return;
    void generate({ prompt: text, model, n: count, size });
  };

  /**
   * 键盘事件：Ctrl/Cmd + Enter 提交
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* 左侧：输入区 */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/5 bg-brand-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <ImageIcon className="h-4 w-4 text-brand-primary" />
          {tImage('title')}
        </div>

        {/* Prompt 输入 */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">{t('prompt')}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tImage('placeholder')}
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
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-brand-card">
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 尺寸选择 */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">{t('size')}</label>
          <div className="grid grid-cols-3 gap-1.5">
            {IMAGE_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-xs transition-colors',
                  size === s
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-white/10 text-text-secondary hover:bg-white/5',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 数量选择 */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">{t('count')}</label>
          <div className="grid grid-cols-3 gap-1.5">
            {IMAGE_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-xs transition-colors',
                  count === n
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-white/10 text-text-secondary hover:bg-white/5',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 生成按钮 */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!prompt.trim() || isLoading}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('generating')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {tImage('generate')}
            </>
          )}
        </button>
      </div>

      {/* 右侧：结果网格 */}
      <div className="rounded-xl border border-white/5 bg-brand-card p-4">
        {results.length === 0 && !isLoading ? (
          // 空状态
          <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
              <ImageIcon className="h-6 w-6 text-text-tertiary" />
            </div>
            <p className="text-sm text-text-secondary">{tImage('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* 生成中骨架屏 */}
            {isLoading &&
              Array.from({ length: count }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="aspect-square animate-pulse rounded-xl bg-white/5"
                />
              ))}

            {/* 结果图片 */}
            {results.map((item) => (
              <ResultCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
