'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Square, Trash2, Sliders, User, Bot } from 'lucide-react';
import { useChat } from '@/hooks/useGeneration';
import { MessageBubble } from './MessageBubble';
import { cn } from '@/lib/utils/cn';

/**
 * 可选模型列表（与网关约定的模型标识）
 */
const MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'deepseek-chat', label: 'DeepSeek Chat' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

/**
 * ChatPanel 对话面板
 *
 * 布局：左右分栏
 * - 左侧：对话流（消息气泡列表）+ 输入框
 * - 右侧：参数设置（模型选择、温度滑块、清空对话）
 *
 * 特性：
 * - SSE 流式打字效果（由 useChat + MessageBubble 实现）
 * - 多轮上下文（历史消息自动携带）
 * - 自动滚动至最新消息
 * - Enter 发送 / Shift+Enter 换行
 */
export function ChatPanel({ onQuotaExhausted }: { onQuotaExhausted?: () => void }) {
  const t = useTranslations('tools');
  const tChat = useTranslations('chat');

  const {
    messages,
    isStreaming,
    model,
    temperature,
    quotaExhausted,
    setModel,
    setTemperature,
    sendMessage,
    stopGeneration,
    clearChat,
  } = useChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 自动滚动到底部（消息变化或流式更新时）
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * 额度耗尽时通知父组件（触发弹窗）
   */
  useEffect(() => {
    if (quotaExhausted) onQuotaExhausted?.();
  }, [quotaExhausted, onQuotaExhausted]);

  /**
   * textarea 自适应高度
   */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  /**
   * 提交发送
   */
  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    void sendMessage(text);
  };

  /**
   * 键盘事件：Enter 发送，Shift+Enter 换行
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="grid h-[600px] grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
      {/* 左侧：对话流 + 输入框 */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-brand-card">
        {/* 消息列表 */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            // 空状态
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm text-text-secondary">{tChat('empty')}</p>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tChat('placeholder')}
              rows={1}
              className={cn(
                'max-h-40 flex-1 resize-none rounded-lg border border-gray-700 bg-[#0b1120] px-3 py-2 text-sm text-white placeholder:text-text-tertiary',
                'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30',
              )}
            />
            {isStreaming ? (
              // 生成中：显示停止按钮
              <button
                type="button"
                onClick={stopGeneration}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
                title={t('stop')}
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              // 发送按钮（品牌渐变）
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                title={t('send')}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：参数设置 */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/5 bg-brand-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Sliders className="h-4 w-4 text-brand-primary" />
          {t('parameters')}
        </div>

        {/* 模型选择 */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary">{t('model')}</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-gray-700 bg-[#0b1120] px-3 py-2 text-sm text-white',
              'focus:border-brand-primary focus:outline-none',
            )}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-brand-card">
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 温度滑块 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary">{t('temperature')}</label>
            <span className="text-xs font-medium text-brand-primary">
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-[#06B6D4]"
          />
          <div className="flex justify-between text-[10px] text-text-tertiary">
            <span>0</span>
            <span>1</span>
            <span>2</span>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="my-1 h-px bg-white/5" />

        {/* 清空对话 */}
        <button
          type="button"
          onClick={clearChat}
          disabled={messages.length === 0}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {tChat('clear')}
        </button>

        {/* 使用提示 */}
        <div className="mt-auto rounded-lg bg-white/5 p-3 text-xs text-text-tertiary">
          <div className="mb-1 flex items-center gap-1.5 text-text-secondary">
            <User className="h-3 w-3" />
            {tChat('tipTitle')}
          </div>
          <p>{tChat('tipContent')}</p>
        </div>
      </div>
    </div>
  );
}
