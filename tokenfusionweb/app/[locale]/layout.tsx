import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

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
 * LocaleLayout - 国际化布局组件
 *
 * 职责：
 * 1. 验证 URL 中的语言参数是否受支持
 * 2. 调用 unstable_setRequestLocale 设置当前请求的 locale（关键！）
 *    没有此调用，getMessages() 等服务端函数无法获取正确的 locale
 * 3. 加载对应语言的翻译消息
 * 4. 通过 NextIntlClientProvider 将翻译注入客户端组件
 *
 * 注意：不再渲染 <html>/<body>，这些由根布局 app/layout.tsx 统一提供，
 * 避免双重 html/body 标签导致的水合（hydration）警告。
 */
export default async function LocaleLayout({
  children,
  params: { locale },
}: Props) {
  // 校验语言参数是否在支持列表中，不支持则返回 404
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // 关键：设置当前请求的 locale，使 getMessages() 等服务端函数能正确读取
  unstable_setRequestLocale(locale);

  // 获取当前语言的翻译消息
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
