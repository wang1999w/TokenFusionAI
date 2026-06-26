/**
 * 根布局（Root Layout）
 *
 * 职责：
 * 1. 渲染唯一的 <html> 和 <body> 标签（Next.js App Router 要求根布局必须包含）
 * 2. 加载 Inter 字体并应用全局样式
 * 3. 设置默认 lang 和深色模式
 *
 * 注意：子布局 app/[locale]/layout.tsx 不再渲染 html/body，
 * 仅负责注入 next-intl 国际化上下文，避免双重 html/body 导致的水合警告。
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// 加载 Inter 字体（品牌标准字体）
const inter = Inter({ subsets: ['latin'] });

/**
 * 全局元数据配置 - SEO 基础信息
 */
export const metadata: Metadata = {
  title: 'TokenFusion AI',
  description: 'One Token, Unlimited AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/*
         * 在页面加载的最早时机:
         * 1. 禁用浏览器自动滚动恢复
         * 2. 检查 sessionStorage 标记(语言切换时设置),强制滚动到顶部
         *    用 setInterval 持续覆盖浏览器的 scroll restoration
         *    直到滚动位置稳定为 0 或超时(2.5 秒)
         */}
        <script dangerouslySetInnerHTML={{
          __html: `if('scrollRestoration'in window.history){window.history.scrollRestoration='manual';}if(sessionStorage.getItem('tf_scroll_top')==='1'){sessionStorage.removeItem('tf_scroll_top');var stf=function(){window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body&&(document.body.scrollTop=0);};stf();document.addEventListener('DOMContentLoaded',stf);window.addEventListener('load',stf);var cnt=0;var si=setInterval(function(){if(window.scrollY>0&&cnt<250){stf();cnt++;}else{clearInterval(si);}},10);setTimeout(function(){clearInterval(si);stf();},2500);}`
        }} />
      </head>
      <body className={`${inter.className} min-h-screen bg-[#0B1120] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
