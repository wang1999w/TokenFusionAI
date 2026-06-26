'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, Copy } from 'lucide-react';
import type { UIMessage } from '@/hooks/useGeneration';
import { CodeBlock } from '@/components/modules/code/CodeBlock';
import { cn } from '@/lib/utils/cn';

/**
 * MessageBubble 消息气泡组件
 *
 * 职责：
 * - 用户消息右对齐，使用品牌渐变背景
 * - AI 消息左对齐，使用卡片背景
 * - AI 消息内容支持简易 Markdown 渲染（自实现，无第三方依赖）
 * - 代码块使用 CodeBlock 组件渲染（含高亮与复制）
 * - 流式生成时显示闪烁光标
 * - 出错时显示错误提示
 */

interface MessageBubbleProps {
  /** 消息对象 */
  message: UIMessage;
}

/* ============================================================
 * 简易 Markdown 渲染器（自实现，不引入新依赖）
 * 支持：标题、加粗、斜体、行内代码、代码块、无序列表、段落、换行
 * ============================================================ */

/** 代码块类型 */
interface CodeBlockToken {
  type: 'code';
  lang: string;
  content: string;
}
/** 普通文本段类型 */
interface TextToken {
  type: 'text';
  content: string;
}
/** 渲染分片 */
type Segment = CodeBlockToken | TextToken;

/**
 * 将 Markdown 文本拆分为"代码块"与"普通文本"分片
 * 代码块以 ``` 包裹，支持指定语言
 *
 * @param text Markdown 原文
 * @returns 分片数组（按出现顺序）
 */
function splitCodeBlocks(text: string): Segment[] {
  const segments: Segment[] = [];
  // 匹配 ```lang\n...```
  const codeFenceRegex = /```([\w-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFenceRegex.exec(text)) !== null) {
    // 代码块之前的普通文本
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before.trim()) segments.push({ type: 'text', content: before });
    }
    // 代码块本身
    const lang = match[1] || 'text';
    const content = match[2].replace(/\n$/, '');
    segments.push({ type: 'code', lang, content });
    lastIndex = codeFenceRegex.lastIndex;
  }
  // 末尾剩余普通文本
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    if (rest.trim()) segments.push({ type: 'text', content: rest });
  }
  return segments;
}

/**
 * 渲染行内 Markdown（加粗、斜体、行内代码）
 * 将文本按格式拆分为 React 节点
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // 行内格式正则：**bold** / *italic* / `code`
  const inlineRegex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    // 匹配前的普通文本
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    // 加粗
    if (match[1]) {
      nodes.push(
        <strong key={`${keyPrefix}-${key++}`} className="font-semibold text-white">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // 斜体
      nodes.push(
        <em key={`${keyPrefix}-${key++}`} className="italic">
          {match[4]}
        </em>,
      );
    } else if (match[5]) {
      // 行内代码
      nodes.push(
        <code
          key={`${keyPrefix}-${key++}`}
          className="rounded bg-black/40 px-1.5 py-0.5 text-[0.85em] text-brand-primary"
        >
          {match[6]}
        </code>,
      );
    }
    lastIndex = inlineRegex.lastIndex;
  }
  // 末尾剩余文本
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/**
 * 渲染普通文本段（含标题、列表、段落）
 */
function renderTextSegment(text: string, keyPrefix: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  /**
   * 将累积的列表项 flush 为 <ul>
   */
  const flushList = () => {
    if (listItems.length === 0) return;
    const items = [...listItems];
    listItems = [];
    nodes.push(
      <ul key={`${keyPrefix}-ul-${key++}`} className="my-2 space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i} className="list-disc text-text-secondary">
            {renderInline(item, `${keyPrefix}-li-${i}`)}
          </li>
        ))}
      </ul>,
    );
  };

  for (const line of lines) {
    const trimmed = line.trim();
    // 空行：flush 列表
    if (!trimmed) {
      flushList();
      continue;
    }
    // 标题
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const sizeClass =
        level === 1
          ? 'text-xl font-bold'
          : level === 2
            ? 'text-lg font-bold'
            : 'text-base font-semibold';
      nodes.push(
        <p key={`${keyPrefix}-h-${key++}`} className={`mt-3 mb-1 text-white ${sizeClass}`}>
          {renderInline(content, `${keyPrefix}-h-${key}`)}
        </p>,
      );
      continue;
    }
    // 无序列表项
    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }
    // 普通段落
    flushList();
    nodes.push(
      <p key={`${keyPrefix}-p-${key++}`} className="my-1 leading-relaxed text-text-secondary">
        {renderInline(trimmed, `${keyPrefix}-p-${key}`)}
      </p>,
    );
  }
  flushList();
  return nodes;
}

/**
 * Markdown 渲染组件
 */
function Markdown({ content }: { content: string }) {
  // 拆分代码块与文本段
  const segments = useMemo(() => splitCodeBlocks(content), [content]);
  return (
    <div className="space-y-1">
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          return (
            <CodeBlock
              key={`seg-${i}`}
              code={seg.content}
              language={seg.lang}
            />
          );
        }
        return <div key={`seg-${i}`}>{renderTextSegment(seg.content, `seg-${i}`)}</div>;
      })}
    </div>
  );
}

/* ============================================================
 * 消息气泡主组件
 * ============================================================ */

export function MessageBubble({ message }: MessageBubbleProps) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  /**
   * 复制 AI 消息内容
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时忽略
    }
  };

  // 用户消息：右对齐 + 品牌渐变
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl bg-brand-gradient px-4 py-2.5 text-sm text-white shadow-lg">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // AI 消息：左对齐 + 卡片背景
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div
          className={cn(
            'group relative rounded-xl border border-white/5 bg-brand-card px-4 py-3 text-sm shadow-lg',
            message.error && 'border-red-500/30',
          )}
        >
          {/* AI 头像标识 */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-gradient text-[10px] font-bold text-white">
              AI
            </span>
          </div>

          {/* 错误态 */}
          {message.error ? (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{message.error}</span>
            </div>
          ) : (
            <div className="text-text-secondary">
              {message.content ? (
                <Markdown content={message.content} />
              ) : (
                // 空内容时显示思考中
                <span className="text-text-tertiary">{t('loading')}</span>
              )}
              {/* 流式生成光标 */}
              {message.streaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand-primary align-middle" />
              )}
            </div>
          )}

          {/* 操作按钮：非流式且无错误时显示复制 */}
          {!message.streaming && !message.error && message.content && (
            <button
              type="button"
              onClick={handleCopy}
              className="mt-2 flex items-center gap-1 text-xs text-text-tertiary opacity-0 transition-opacity hover:text-text-secondary group-hover:opacity-100"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  {t('copy')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
