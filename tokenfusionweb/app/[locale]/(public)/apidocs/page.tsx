'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { Copy, Check, Zap, Code2, Terminal } from 'lucide-react';

/**
 * ApiDocsPage API 文档页
 *
 * 功能：
 * 1. Quick Start 快速开始
 * 2. 认证方式说明（Bearer Token）
 * 3. Chat / Image 接口说明
 * 4. Python / cURL 代码示例（深色背景代码块 + 复制按钮）
 * 5. "Drop-in replacement"（OpenAI 兼容替换）标注
 *
 * 样式：
 * - 代码块使用深色背景（#0b1120）+ 等宽字体
 * - 左侧目录锚点导航
 */

/** 代码示例片段（cURL 与 Python） */
const CODE_SNIPPETS = {
  curl: `# cURL - Chat Completion (OpenAI 兼容格式)
curl https://api.tokenfusion.ai/gateway/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKENFUSION_API_KEY" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, who are you?"}
    ],
    "stream": true
  }'`,
  python: `# Python - 使用 openai SDK（Drop-in replacement）
from openai import OpenAI

# 只需修改 base_url 与 api_key 即可无缝切换
client = OpenAI(
    base_url="https://api.tokenfusion.ai/gateway/v1",
    api_key="your-tokenfusion-api-key",
)

# Chat 对话
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello, who are you?"}],
)

print(response.choices[0].message.content)`,
  image: `# cURL - Image Generation 图片生成
curl https://api.tokenfusion.ai/gateway/v1/images/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKENFUSION_API_KEY" \\
  -d '{
    "model": "dall-e-3",
    "prompt": "A futuristic city at sunset, digital art",
    "n": 1,
    "size": "1024x1024"
  }'`,
};

/** 文档目录锚点 */
const SECTIONS = [
  { id: 'quickstart', labelKey: 'quickstart' },
  { id: 'auth', labelKey: 'auth' },
  { id: 'chat', labelKey: 'chat' },
  { id: 'image', labelKey: 'image' },
  { id: 'models', labelKey: 'models' },
];

export default function ApiDocsPage() {
  const t = useTranslations('apidocs');

  // 当前选中的代码示例语言
  const [activeLang, setActiveLang] = useState<'curl' | 'python'>('curl');
  // 复制成功状态
  const [copied, setCopied] = useState<string | null>(null);

  /** 复制代码到剪贴板 */
  const handleCopy = async (key: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // 剪贴板 API 不可用时静默失败
    }
  };

  /** 渲染代码块（深色背景 + 复制按钮） */
  const renderCodeBlock = (key: string, code: string) => (
    <div className="group relative overflow-hidden rounded-lg border border-white/5 bg-[#0b1120]">
      {/* 代码块顶部栏（语言标识 + 复制按钮） */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <Terminal className="h-3 w-3" />
          {key === 'python' ? 'python' : 'bash'}
        </span>
        <button
          onClick={() => handleCopy(key, code)}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
        >
          {copied === key ? (
            <Check className="h-3 w-3 text-brand-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      {/* 代码内容（等宽字体，保留换行） */}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-text-secondary">{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      {/* ============ 页面标题 ============ */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
        <p className="mt-2 text-text-secondary">{t('subtitle')}</p>

        {/* Drop-in replacement 标注 */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-4 py-2">
          <Zap className="h-4 w-4 text-brand-primary" />
          <span className="text-sm font-medium text-brand-primary">
            {t('dropInReplacement')}
          </span>
          <span className="text-xs text-text-tertiary">
            {t('dropInHint')}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* ============ 左侧目录导航 ============ */}
        <aside className="lg:w-48 lg:shrink-0">
          <nav className="sticky top-24 space-y-1">
            <p className="mb-2 text-xs font-semibold uppercase text-text-tertiary">
              {t('contents')}
            </p>
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
              >
                {t(section.labelKey)}
              </a>
            ))}
          </nav>
        </aside>

        {/* ============ 右侧文档内容 ============ */}
        <div className="min-w-0 flex-1 space-y-12">
          {/* Quick Start */}
          <section id="quickstart">
            <h2 className="text-xl font-bold text-white">
              {t('quickstart')}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t('quickstartDesc')}
            </p>
            {/* 语言切换 Tab */}
            <div className="mt-4 inline-flex rounded-lg border border-white/10 bg-brand-card p-1">
              <button
                onClick={() => setActiveLang('curl')}
                className={cn(
                  'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
                  activeLang === 'curl'
                    ? 'bg-brand-primary text-white'
                    : 'text-text-secondary hover:text-white',
                )}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveLang('python')}
                className={cn(
                  'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
                  activeLang === 'python'
                    ? 'bg-brand-primary text-white'
                    : 'text-text-secondary hover:text-white',
                )}
              >
                Python
              </button>
            </div>
            <div className="mt-3">
              {activeLang === 'curl'
                ? renderCodeBlock('curl', CODE_SNIPPETS.curl)
                : renderCodeBlock('python', CODE_SNIPPETS.python)}
            </div>
          </section>

          {/* 认证方式 */}
          <section id="auth">
            <h2 className="text-xl font-bold text-white">{t('auth')}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t('authDesc')}
            </p>
            <div className="mt-4">
              {renderCodeBlock(
                'auth',
                `# 所有请求需在 Header 中携带 Bearer Token
Authorization: Bearer tf-xxxxxxxxxxxxxxxxxxxxxxxx`,
              )}
            </div>
            <p className="mt-3 text-xs text-text-tertiary">
              {t('authNote')}
            </p>
          </section>

          {/* Chat 接口 */}
          <section id="chat">
            <h2 className="text-xl font-bold text-white">{t('chat')}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t('chatDesc')}
            </p>
            {/* 接口信息卡片 */}
            <div className="mt-4 rounded-lg border border-white/5 bg-brand-card p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-brand-success/15 px-2 py-0.5 text-xs font-bold text-brand-success">
                  POST
                </span>
                <code className="font-mono text-sm text-white">
                  /gateway/v1/chat
                </code>
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                {t('chatParams')}
              </p>
            </div>
          </section>

          {/* Image 接口 */}
          <section id="image">
            <h2 className="text-xl font-bold text-white">{t('image')}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t('imageDesc')}
            </p>
            <div className="mt-4 rounded-lg border border-white/5 bg-brand-card p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-brand-success/15 px-2 py-0.5 text-xs font-bold text-brand-success">
                  POST
                </span>
                <code className="font-mono text-sm text-white">
                  /gateway/v1/images/generations
                </code>
              </div>
            </div>
            <div className="mt-3">
              {renderCodeBlock('image', CODE_SNIPPETS.image)}
            </div>
          </section>

          {/* 模型列表 */}
          <section id="models">
            <h2 className="text-xl font-bold text-white">{t('models')}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t('modelsDesc')}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {['GPT-4o', 'Claude 3.5', 'Gemini', 'DeepSeek', 'DALL·E 3', 'FLUX', 'Stable Diffusion', 'SDXL'].map(
                (model) => (
                  <div
                    key={model}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-brand-card px-3 py-2"
                  >
                    <Code2 className="h-4 w-4 text-brand-primary" />
                    <span className="text-sm text-white">{model}</span>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* 底部行动入口 */}
          <div className="rounded-xl border border-brand-primary/20 bg-gradient-to-b from-brand-primary/10 to-brand-card p-6 text-center">
            <h3 className="text-lg font-semibold text-white">
              {t('readyTitle')}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {t('readyDesc')}
            </p>
            <Link
              href="/dashboard/apikeys"
              className="mt-4 inline-block rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('getApiKey')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
