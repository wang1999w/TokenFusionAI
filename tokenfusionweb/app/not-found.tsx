import Link from 'next/link';

/**
 * NotFoundPage 全局 404 页面
 *
 * 设计说明：
 * - 当用户访问不存在的路由时展示；
 * - 错误/404 页面使用静态文案而非 useTranslations，原因是：
 *   404 可能在 i18n Provider 上下文之外触发（如根层级路由不匹配），
 *   错误边界页面必须保证自身可用，不依赖可能失败的国际模块；
 * - 采用品牌深色主题，与整体视觉一致。
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-background px-4 text-center">
      {/* 404 大数字 */}
      <p className="bg-brand-gradient bg-clip-text text-8xl font-bold text-transparent sm:text-9xl">
        404
      </p>

      {/* 提示标题 */}
      <h1 className="mt-4 text-2xl font-bold text-white">
        Page Not Found
      </h1>

      {/* 提示描述 */}
      <p className="mt-2 max-w-md text-sm text-text-secondary">
        The page you are looking for doesn&apos;t exist or has been moved.
        Let&apos;s get you back on track.
      </p>

      {/* 返回首页按钮 */}
      <Link
        href="/"
        className="mt-8 rounded-lg bg-brand-gradient px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Back to Home
      </Link>
    </div>
  );
}
