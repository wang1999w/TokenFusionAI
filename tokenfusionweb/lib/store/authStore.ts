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
 */
function loadStoredAuth(): { user: User | null; accessToken: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, accessToken: null };
  }
  const storedToken = localStorage.getItem('access_token');
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? (JSON.parse(storedUser) as User) : null;
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
