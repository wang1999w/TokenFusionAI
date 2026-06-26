import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';
import { routing } from './routing';

/**
 * next-intl 请求配置
 *
 * getRequestConfig 在每个服务端请求时被调用，用于确定当前 locale 并加载对应翻译消息。
 *
 * requestLocale 由 next-intl 中间件通过请求头注入；
 * 如果中间件未设置（如 API 路由），则回退到默认语言。
 *
 * 注意：app/[locale]/layout.tsx 中必须调用 unstable_setRequestLocale(locale)，
 * 否则此处的 requestLocale 会是 undefined，导致翻译始终回退到默认语言。
 *
 * 兜底策略：如果 requestLocale 为 undefined，尝试从请求头 x-next-intl-locale 读取。
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // 如果 requestLocale 为空，尝试从请求头读取（中间件设置）
  if (!locale) {
    const headerList = headers();
    const headerLocale = headerList.get('x-next-intl-locale');
    if (headerLocale) {
      locale = headerLocale;
    }
  }

  if (
    !locale ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
