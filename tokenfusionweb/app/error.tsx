'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * ErrorPage 全局 500 错误页面（错误边界）
 *
 * 设计说明：
 * - Next.js 要求 error.tsx 必须为客户端组件（'use client'）；
 * - 作为错误边界，捕获子组件树的运行时错误；
 * - 不使用 useTranslations：错误可能源于 i18n 模块自身，
 *   错误边界必须保持独立性以确保始终可用；
 * - 提供"重试"（reset）与"返回首页"两个操作入口。
 *
 * Props:
 * - error: 捕获到的错误对象
 * - reset: 重置错误边界，重新渲染子组件树
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /**
   * 将错误信息输出到控制台，便于开发调试
   * 生产环境可在此对接错误上报服务（如 Sentry）
   */
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-background px-4 text-center">
      {/* 错误图标（圆形警示） */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-8 w-8 text-red-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>

      {/* 错误码 */}
      <p className="mt-6 bg-brand-gradient bg-clip-text text-6xl font-bold text-transparent sm:text-7xl">
        500
      </p>

      {/* 提示标题 */}
      <h1 className="mt-4 text-2xl font-bold text-white">
        Something went wrong
      </h1>

      {/* 提示描述 */}
      <p className="mt-2 max-w-md text-sm text-text-secondary">
        An unexpected error occurred. Don&apos;t worry, our team has been
        notified. You can try again or return to the home page.
      </p>

      {/* 操作按钮组 */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {/* 重试：重置错误边界 */}
        <button
          onClick={reset}
          className="rounded-lg bg-brand-gradient px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Try Again
        </button>

        {/* 返回首页 */}
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
