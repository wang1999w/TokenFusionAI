export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_BASE_URL ?? '';

export const SUPPORTED_LOCALES = [
  'en',
  'zh-CN',
  'th',
  'vi',
  'id',
  'ms',
  'fil',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  fil: 'Filipino',
};

export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  en: 'US',
  'zh-CN': 'CN',
  th: 'TH',
  vi: 'VN',
  id: 'ID',
  ms: 'MY',
  fil: 'PH',
};

export const APP_NAME = 'TokenFusion AI';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER: 'user',
  DEVICE_ID: 'device_id',
} as const;
