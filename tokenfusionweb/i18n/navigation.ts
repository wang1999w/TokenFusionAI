/**
 * next-intl 导航组件配置
 *
 * next-intl v3 中，locale 感知的 Link、useRouter、usePathname、redirect
 * 需要通过 createSharedPathnamesNavigation 创建，不能直接从 'next-intl' 导入。
 *
 * 此文件基于 i18n/routing.ts 中的 routing 配置创建导航工具，
 * 供所有客户端组件统一导入使用，自动处理 locale 前缀。
 */

import { createSharedPathnamesNavigation } from 'next-intl/navigation';

import { routing } from './routing';

// 导出 locale 感知的导航组件与 Hooks
export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation(routing);
