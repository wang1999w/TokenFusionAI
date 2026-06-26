'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Share2, Check } from 'lucide-react';
import type { UIImageItem } from '@/hooks/useGeneration';
import { cn } from '@/lib/utils/cn';

/**
 * ResultCard 图片结果卡片
 *
 * 职责：
 * - 展示生成的单张图片
 * - hover 时显示下载 / 分享操作按钮
 * - 下载：将图片转 blob 下载（兼容 data URL 与远程 URL）
 * - 分享：调用 Web Share API（不支持时降级为复制链接）
 */

interface ResultCardProps {
  /** 图片结果项 */
  item: UIImageItem;
}

export function ResultCard({ item }: ResultCardProps) {
  const t = useTranslations('common');
  const [shared, setShared] = useState(false);

  /**
   * 下载图片
   * 兼容远程 URL 与 base64 data URL
   */
  const handleDownload = async () => {
    try {
      // data URL 直接下载
      if (item.url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = `tokenfusion-${item.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      // 远程图片转 blob 下载（避免跨域直接 a 下载）
      const res = await fetch(item.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `tokenfusion-${item.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // 降级：直接打开图片
      window.open(item.url, '_blank');
    }
  };

  /**
   * 分享图片
   */
  const handleShare = async () => {
    try {
      // 优先 Web Share API
      if (navigator.share) {
        await navigator.share({
          title: 'TokenFusion AI',
          text: item.prompt,
          url: item.url,
        });
        return;
      }
      // 降级：复制链接到剪贴板
      await navigator.clipboard.writeText(item.url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      // 用户取消或失败时忽略
    }
  };

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-white/5 bg-brand-card">
      {/* 图片 */}
      <img
        src={item.url}
        alt={item.prompt}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />

      {/* hover 遮罩 + 操作按钮 */}
      <div className="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/70 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleDownload}
          title={t('download')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm',
            'transition-colors hover:bg-white/30',
          )}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleShare}
          title={t('share')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm',
            'transition-colors hover:bg-white/30',
          )}
        >
          {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        </button>
      </div>

      {/* 提示词预览（底部，hover 时显示） */}
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-black/60 px-3 py-2 text-xs text-white opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="line-clamp-2">{item.prompt}</p>
      </div>
    </div>
  );
}
