import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'zh-CN', 'th', 'vi', 'id', 'ms', 'fil'],
  defaultLocale: 'en',
  localePrefix: 'always',
});
