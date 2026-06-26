'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Code2, Sparkles, Loader2, FileCode } from 'lucide-react';
import { useCodeGeneration } from '@/hooks/useGeneration';
import { CodeBlock } from './CodeBlock';
import { cn } from '@/lib/utils/cn';

/**
 * 可选代码模型
 */
const CODE_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'deepseek-coder', label: 'DeepSeek Coder' },
  { id: 'codestral', label: 'Codestral' },
];

/**
 * 可选编程语言
 */
const LANGUAGES = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'cpp', label: 'C++' },
  { id: 'php', label: 'PHP' },
];

/**
 * CodePanel 代码生成面板
 *
 * 布局：上下结构
 * - 上部：需求输入 + 语言选择 + 模型选择
 * - 下部：代码输出区（CodeBlock 渲染，含高亮与复制）
 *
 * 状态：
 * - 生成中：loading 动画
 * - 成功：代码块 + 说明文本
 * - 空状态：占位提示
 */
export function CodePanel({ onQuotaExhausted }: { onQuotaExhausted?: () => void }) {
  const t = useTranslations('tools');
  const tCode = useTranslations('code');

  const { result, isLoading, quotaExhausted, generate } = useCodeGeneration();

  // 表单状态
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(CODE_MODELS[0].id);
  const [language, setLanguage] = useState(LANGUAGES[0].id);

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
    void generate({ prompt: text, model, language });
  };

  /** Ctrl/Cmd + Enter 提交 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="space-y-4">
      {/* 上部：需求输入区 */}
      <div className="rounded-xl border border-white/5 bg-brand-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
          <Code2 className="h-4 w-4 text-brand-primary" />
          {tCode('title')}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          {/* 需求输入 */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tCode('placeholder')}
            rows={3}
            className={cn(
              'w-full resize-none rounded-lg border border-gray-700 bg-[#0b1120] px-3 py-2 text-sm text-white placeholder:text-text-tertiary',
              'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30',
            )}
          />

          {/* 语言选择 */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-auto rounded-lg border border-gray-700 bg-[#0b1120] px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id} className="bg-brand-card">
                {l.label}
              </option>
            ))}
          </select>

          {/* 模型选择 */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-auto rounded-lg border border-gray-700 bg-[#0b1120] px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
          >
            {CODE_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-brand-card">
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* 生成按钮 */}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading}
            className="flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('generating')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {tCode('generate')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 下部：代码输出区 */}
      <div className="rounded-xl border border-white/5 bg-brand-card p-4">
        <div className="mb-3 text-sm font-medium text-white">{tCode('output')}</div>

        {isLoading ? (
          // 生成中骨架屏
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="h-32 w-full animate-pulse rounded bg-white/5" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        ) : result.data ? (
          // 成功：渲染代码 + 说明
          <div className="space-y-3">
            {/* 说明文本（可选） */}
            {result.data.explanation && (
              <p className="text-sm text-text-secondary">{result.data.explanation}</p>
            )}
            {/* 代码块 */}
            {result.data.code ? (
              <CodeBlock
                code={result.data.code}
                language={result.data.language || language}
              />
            ) : (
              <p className="text-sm text-text-tertiary">{tCode('empty')}</p>
            )}
          </div>
        ) : result.error ? (
          // 错误
          <div className="flex items-center gap-2 text-sm text-red-400">
            <FileCode className="h-4 w-4" />
            {result.error}
          </div>
        ) : (
          // 空状态
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
              <Code2 className="h-6 w-6 text-text-tertiary" />
            </div>
            <p className="text-sm text-text-secondary">{tCode('empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
