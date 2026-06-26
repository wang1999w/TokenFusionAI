'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * CodeBlock 代码块组件
 *
 * 职责：
 * - 以 <pre><code> 形式展示代码（深色主题适配）
 * - 简单语法着色：对关键字、字符串、注释、数字做基础高亮
 *   （不引入第三方高亮库，使用正则实现轻量着色）
 * - 显示语言标签
 * - 一键复制按钮
 */

interface CodeBlockProps {
  /** 代码内容 */
  code: string;
  /** 语言标识（如 javascript / tsx / python） */
  language?: string;
  /** 是否带外层卡片（嵌入消息流时可为 true） */
  className?: string;
}

/** 关键字集合（覆盖主流语言常用关键字） */
const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|class|extends|new|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|void|delete|yield|static|public|private|protected|interface|type|enum|namespace|def|elif|lambda|pass|None|True|False|print|self|fn|pub|struct|impl|match|move|mut|ref|use|crate|mod|let|func|var|val|package|func|go|return|select|defer|chan|map|range)\b/g;

/** 字符串（单引号、双引号、反引号） */
const STRINGS = /(`[^`]*`|"[^"]*"|'[^']*')/g;

/** 注释（单行 // 与多行 /* *\/） */
const COMMENTS = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g;

/** 数字字面量 */
const NUMBERS = /\b(\d+(\.\d+)?)\b/g;

/**
 * 简单语法高亮：将代码字符串转为带 className 的 React 节点
 * 实现思路：用占位符先把字符串/注释提取出来，避免被关键字/数字正则误伤，
 * 再分别着色，最后还原占位符。
 */
function highlight(code: string): React.ReactNode[] {
  const placeholders: string[] = [];
  let working = code;

  // 1. 先提取注释
  working = working.replace(COMMENTS, (m) => {
    placeholders.push(m);
    return `\u0000${placeholders.length - 1}\u0000`;
  });
  // 2. 再提取字符串
  working = working.replace(STRINGS, (m) => {
    placeholders.push(m);
    return `\u0000${placeholders.length - 1}\u0000`;
  });
  // 3. 高亮关键字与数字
  working = working
    .replace(KEYWORDS, '\u0001$1\u0001')
    .replace(NUMBERS, '\u0002$1\u0002');

  // 4. 拆分并还原占位符，生成节点
  const nodes: React.ReactNode[] = [];
  // 使用 \u0001 / \u0002 作为分隔标记
  const parts = working.split(/(\u0001[^\u0001]*\u0001|\u0002[^\u0002]*\u0002|\u0000\d+\u0000)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    // 占位符还原（字符串/注释）
    const placeholderMatch = part.match(/^\u0000(\d+)\u0000$/);
    if (placeholderMatch) {
      const idx = parseInt(placeholderMatch[1], 10);
      const text = placeholders[idx] ?? '';
      // 注释 vs 字符串着色
      const isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('#');
      nodes.push(
        <span
          key={i}
          className={isComment ? 'text-[#6B7280] italic' : 'text-[#A5D6A7]'}
        >
          {text}
        </span>,
      );
      return;
    }
    // 关键字
    const kwMatch = part.match(/^\u0001([^\u0001]*)\u0001$/);
    if (kwMatch) {
      nodes.push(
        <span key={i} className="text-[#C792EA] font-medium">
          {kwMatch[1]}
        </span>,
      );
      return;
    }
    // 数字
    const numMatch = part.match(/^\u0002([^\u0002]*)\u0002$/);
    if (numMatch) {
      nodes.push(
        <span key={i} className="text-[#F78C6C]">
          {numMatch[1]}
        </span>,
      );
      return;
    }
    // 普通文本
    nodes.push(part);
  });
  return nodes;
}

export function CodeBlock({ code, language = 'text', className }: CodeBlockProps) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);

  /** 复制代码 */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 忽略
    }
  };

  return (
    <div className={cn('group/code relative my-2 overflow-hidden rounded-lg border border-white/5 bg-[#0d1117]', className)}>
      {/* 顶栏：语言标签 + 复制按钮 */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-text-tertiary transition-colors hover:text-text-secondary"
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
      </div>
      {/* 代码内容：横向滚动，保留换行 */}
      <pre className="overflow-x-auto p-3 text-sm leading-relaxed">
        <code className="font-mono text-[#E6EDF3]">{highlight(code)}</code>
      </pre>
    </div>
  );
}
