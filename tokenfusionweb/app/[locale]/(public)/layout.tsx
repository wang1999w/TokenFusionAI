import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';

/**
 * PublicLayout 公共页面布局
 *
 * 职责：
 * - 为公开访问页面（法律条款 / FAQ / 定价 / API 文档 / 工具介绍等）
 *   提供统一的顶部导航栏与底部页脚
 *
 * 说明：
 * - 此为服务端组件，无需 'use client'；
 * - 合规类页面要求 prose 排版 + max-w-3xl 居中，由各页面自行控制容器宽度。
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-background">
      {/* 顶部公共导航栏 */}
      <Navbar />

      {/* 页面内容区（各页面自行控制最大宽度） */}
      <main className="flex-1">{children}</main>

      {/* 底部页脚 */}
      <Footer />
    </div>
  );
}
