import { create } from 'zustand';

/**
 * 用户信息接口
 */
interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

/**
 * 认证状态接口
 * 管理用户登录状态、用户信息、access_token
 */
interface AuthState {
  user: User | null;       // 当前登录用户信息
  accessToken: string | null;  // JWT access token
  isAuthenticated: boolean;    // 是否已登录
  login: (user: User, accessToken: string) => void;  // 登录方法
  logout: () => void;          // 登出方法
  restore: () => void;         // 从 localStorage 恢复登录状态
}

/**
 * 从 localStorage 加载已存储的认证信息
 * 用于页面刷新后恢复登录状态
 *
 * 注意：localStorage 中可能存在无效值（如字面字符串 "undefined"、被截断的 JSON），
 * 直接 JSON.parse 会抛出 SyntaxError 导致整个 DashboardLayout 崩溃，
 * 因此必须用 try-catch 包裹并清理脏数据。
 */
function loadStoredAuth(): { user: User | null; accessToken: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, accessToken: null };
  }
  const storedToken = localStorage.getItem('access_token');
  const rawUser = localStorage.getItem('user');

  // 若 token 与用户信息都不存在，视为未登录
  if (!storedToken || !rawUser) {
    return { user: null, accessToken: storedToken };
  }

  // 安全解析用户信息，兼容脏数据（"undefined" / "null" / 损坏 JSON）
  let user: User | null = null;
  try {
    // 排除字面 "undefined" / "null" 字符串，避免 JSON.parse 抛错
    if (rawUser !== 'undefined' && rawUser !== 'null') {
      user = JSON.parse(rawUser) as User;
    }
  } catch {
    // 解析失败时清理脏数据，避免后续重复报错
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
  }
  return { user, accessToken: storedToken };
}

/**
 * 认证全局状态 Store（Zustand）
 * 职责：
 * 1. 存储用户信息和 access_token
 * 2. login: 登录时持久化到 localStorage
 * 3. logout: 登出时清除 localStorage
 * 4. restore: 页面刷新时从 localStorage 恢复
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  // 登录：存储用户信息和 token 到状态和 localStorage
  login: (user, accessToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, accessToken, isAuthenticated: true });
  },

  // 登出：清除状态和 localStorage
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  // 恢复：从 localStorage 恢复登录状态（页面刷新时调用）
  restore: () => {
    const { user, accessToken } = loadStoredAuth();
    if (accessToken && user) {
      set({ user, accessToken, isAuthenticated: true });
    }
  },
}));
