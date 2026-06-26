'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, ImageIcon, Video, Code2 } from 'lucide-react';
import { ChatPanel } from '@/components/modules/chat/ChatPanel';
import { ImagePanel } from '@/components/modules/image/ImagePanel';
import { VideoPanel } from '@/components/modules/video/VideoPanel';
import { CodePanel } from '@/components/modules/code/CodePanel';
import { QuotaExhaustedModal } from '@/components/common/QuotaExhaustedModal';
import { cn } from '@/lib/utils/cn';

/**
 * Tab 类型
 */
type TabId = 'chat' | 'image' | 'video' | 'code';

/** localStorage 存储键 */
const ACTIVE_TAB_KEY = 'tf_active_tab';

/**
 * ExperienceTabs 体验区 Tab 切换组件
 *
 * 职责：
 * - 4 个 Tab：Chat / Image / Video / Code
 * - 无刷新切换（仅客户端状态切换，不触发路由跳转）
 * - 通过 localStorage 记忆上次选择的 Tab
 * - 使用 useTranslations('tools') 获取翻译
 */
export function ExperienceTabs() {
  const t = useTranslations('tools');

  const [activeTab, setActiveTab] = useState<TabId>('chat');
  // 额度耗尽弹窗状态（由各面板上报触发）
  const [quotaOpen, setQuotaOpen] = useState(false);

  /** 各面板额度耗尽时统一触发弹窗 */
  const handleQuotaExhausted = useCallback(() => setQuotaOpen(true), []);

  /**
   * 初始化：从 localStorage 读取上次选择的 Tab
   */
  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY) as TabId | null;
    if (saved && ['chat', 'image', 'video', 'code'].includes(saved)) {
      setActiveTab(saved);
    }
  }, []);

  /**
   * 切换 Tab 并持久化
   */
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  };

  /** Tab 配置 */
  const tabs: Array<{
    id: TabId;
    labelKey: 'chat' | 'image' | 'video' | 'code';
    descKey: 'chatDesc' | 'imageDesc' | 'videoDesc' | 'codeDesc';
    icon: typeof MessageSquare;
  }> = [
    { id: 'chat', labelKey: 'chat', descKey: 'chatDesc', icon: MessageSquare },
    { id: 'image', labelKey: 'image', descKey: 'imageDesc', icon: ImageIcon },
    { id: 'video', labelKey: 'video', descKey: 'videoDesc', icon: Video },
    { id: 'code', labelKey: 'code', descKey: 'codeDesc', icon: Code2 },
  ];

  return (
    <div className="space-y-5">
      {/* Tab 头部 */}
      <div className="flex flex-wrap justify-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'group flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'border-transparent bg-brand-gradient text-white shadow-lg shadow-brand-primary/20'
                  : 'border-white/10 bg-brand-card text-text-secondary hover:border-white/20 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Tab 内容（无刷新切换） */}
      <div className="rounded-2xl bg-[#0b1120]/50 p-1">
        {activeTab === 'chat' && <ChatPanel onQuotaExhausted={handleQuotaExhausted} />}
        {activeTab === 'image' && <ImagePanel onQuotaExhausted={handleQuotaExhausted} />}
        {activeTab === 'video' && <VideoPanel onQuotaExhausted={handleQuotaExhausted} />}
        {activeTab === 'code' && <CodePanel onQuotaExhausted={handleQuotaExhausted} />}
      </div>

      {/* 额度耗尽弹窗 */}
      <QuotaExhaustedModal open={quotaOpen} onClose={() => setQuotaOpen(false)} />
    </div>
  );
}
