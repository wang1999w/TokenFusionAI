import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import './globals.css';

// 加载 Inter 字体（品牌标准字体）
const inter = Inter({ subsets: ['latin'] });

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

/**
 * generateStaticParams - 为所有支持的语言生成静态路由参数
 * 这样 Next.js 会在构建时预生成每种语言的页面
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * 全局元数据配置 - SEO 基础信息
 */
export const metadata: Metadata = {
  title: 'TokenFusion AI',
  description: 'One Token, Unlimited AI',
};

/**
 * LocaleLayout - 全局布局组件
 * 职责：
 * 1. 验证 URL 中的语言参数是否受支持
 * 2. 加载对应语言的翻译消息
 * 3. 设置 html lang 属性和深色模式（className="dark"）
 * 4. 通过 NextIntlClientProvider 将翻译注入客户端组件
 */
export default async function LocaleLayout({
  children,
  params: { locale },
}: Props) {
  // 校验语言参数是否在支持列表中，不支持则返回 404
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // 获取当前语言的翻译消息
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className={inter.className}>
        {/* NextIntlClientProvider 将翻译消息注入所有客户端组件 */}
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
