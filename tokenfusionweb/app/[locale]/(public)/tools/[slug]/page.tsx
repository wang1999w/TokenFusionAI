import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { MessageSquare, ImageIcon, Video, Code2, Sparkles } from 'lucide-react';

/**
 * ToolDetailPage 独立功能页（SEO 优化）
 *
 * 职责：
 * 1. 根据动态路由参数 slug（chat/image/video/code）展示对应功能介绍
 * 2. generateMetadata 配置 TDK（Title/Description/Keywords），利于 SEO 收录
 * 3. generateStaticParams 预生成所有功能页静态路由
 *
 * SEO 策略：
 * - 每个功能页独立 URL（/tools/chat、/tools/image 等），便于搜索引擎收录
 * - TDK 针对每个功能定制，包含核心关键词
 * - 结构化内容：H1 标题 + 功能特性列表 + 行动号召
 */

/** 支持的功能 slug 列表 */
const VALID_SLUGS = ['chat', 'image', 'video', 'code'] as const;
type ToolSlug = (typeof VALID_SLUGS)[number];

/**
 * generateStaticParams - 为每个功能 + 每种语言预生成静态路由
 * 这样 Next.js 会在构建时预生成所有功能页，提升首屏性能与 SEO
 */
export function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ slug }));
}

/** 功能图标映射 */
const TOOL_ICONS: Record<
  ToolSlug,
  React.ComponentType<{ className?: string }>
> = {
  chat: MessageSquare,
  image: ImageIcon,
  video: Video,
  code: Code2,
};

/** 功能对应的主题色 class */
const TOOL_COLORS: Record<ToolSlug, string> = {
  chat: 'from-cyan-500/20 to-transparent',
  image: 'from-blue-500/20 to-transparent',
  video: 'from-purple-500/20 to-transparent',
  code: 'from-green-500/20 to-transparent',
};

/**
 * Props 类型（Next.js 14 中 params 需通过 Promise 获取时使用 await）
 */
type Props = {
  params: { slug: string };
};

/**
 * generateMetadata - 根据动态 slug 生成 SEO 元数据（TDK）
 * 每个功能页定制 Title / Description / Keywords
 */
export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const slug = params.slug as ToolSlug;

  // 非法 slug 返回基础元数据
  if (!VALID_SLUGS.includes(slug)) {
    return { title: 'Not Found' };
  }

  const t = await getTranslations('toolsPage');

  /** 各功能 SEO 配置 key */
  const metaKey: Record<ToolSlug, string> = {
    chat: 'chat',
    image: 'image',
    video: 'video',
    code: 'code',
  };
  const key = metaKey[slug];

  return {
    title: t(`${key}.title`),
    description: t(`${key}.description`),
    keywords: t(`${key}.keywords`),
    openGraph: {
      title: t(`${key}.title`),
      description: t(`${key}.description`),
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
}

export default async function ToolDetailPage({ params }: Props) {
  const slug = params.slug as ToolSlug;

  // 非法 slug 返回 404
  if (!VALID_SLUGS.includes(slug)) {
    notFound();
  }

  const t = await getTranslations('toolsPage');
  const tTools = await getTranslations('tools');

  const Icon = TOOL_ICONS[slug];
  const colorClass = TOOL_COLORS[slug];

  /** 功能特性列表 key 数组 */
  const featuresKey: Record<ToolSlug, string[]> = {
    chat: ['chat.feature1', 'chat.feature2', 'chat.feature3', 'chat.feature4'],
    image: ['image.feature1', 'image.feature2', 'image.feature3', 'image.feature4'],
    video: ['video.feature1', 'video.feature2', 'video.feature3', 'video.feature4'],
    code: ['code.feature1', 'code.feature2', 'code.feature3', 'code.feature4'],
  };

  /** 使用场景列表 key 数组 */
  const useCasesKey: Record<ToolSlug, string[]> = {
    chat: ['chat.useCase1', 'chat.useCase2', 'chat.useCase3'],
    image: ['image.useCase1', 'image.useCase2', 'image.useCase3'],
    video: ['video.useCase1', 'video.useCase2', 'video.useCase3'],
    code: ['code.useCase1', 'code.useCase2', 'code.useCase3'],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {/* ============ Hero 区：功能标题 + 描述 ============ */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b ${colorClass} p-8 sm:p-12`}
      >
        {/* 功能图标 */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient">
          <Icon className="h-7 w-7 text-white" />
        </div>

        {/* H1 标题（SEO 核心） */}
        <h1 className="mt-6 text-3xl font-bold text-white sm:text-4xl">
          {t(`${slug}.title`)}
        </h1>
        {/* 功能描述 */}
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          {t(`${slug}.description`)}
        </p>

        {/* 行动按钮 */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/#experience`}
            className="rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t('tryNow')}
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
          >
            {t('viewPricing')}
          </Link>
        </div>
      </div>

      {/* ============ 功能特性列表 ============ */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">{t('featuresTitle')}</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {featuresKey[slug].map((key) => (
            <div
              key={key}
              className="flex items-start gap-3 rounded-xl border border-white/5 bg-brand-card p-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/15">
                <Sparkles className="h-4 w-4 text-brand-primary" />
              </span>
              <p className="text-sm text-text-secondary">{t(key)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 使用场景 ============ */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">{t('useCasesTitle')}</h2>
        <div className="mt-6 space-y-3">
          {useCasesKey[slug].map((key, index) => (
            <div
              key={key}
              className="flex items-center gap-4 rounded-xl border border-white/5 bg-brand-card p-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                {index + 1}
              </span>
              <p className="text-sm text-text-secondary">{t(key)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 其他功能导航 ============ */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">{t('otherTools')}</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {VALID_SLUGS.filter((s) => s !== slug).map((otherSlug) => {
            const OtherIcon = TOOL_ICONS[otherSlug];
            return (
              <Link
                key={otherSlug}
                href={`/tools/${otherSlug}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-brand-card p-5 transition-colors hover:border-white/10"
              >
                <OtherIcon className="h-6 w-6 text-brand-primary" />
                <span className="text-sm text-white">
                  {tTools(otherSlug)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
