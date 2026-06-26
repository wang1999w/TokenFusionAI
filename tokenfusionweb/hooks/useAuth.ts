'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  refreshToken as refreshTokenApi,
  type LoginParams,
  type RegisterParams,
  type AuthResponse,
} from '@/lib/api/auth';
import { getProfile } from '@/lib/api/user';

/**
 * 认证 Hook
 * 封装登录、注册、登出、Token 刷新、状态恢复等逻辑
 */
export function useAuth() {
  const { user, accessToken, isAuthenticated, login, logout, restore } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 页面加载时从 localStorage 恢复登录状态
   */
  useEffect(() => {
    restore();
  }, [restore]);

  /**
   * 登录
   */
  const handleLogin = useCallback(
    async (params: LoginParams) => {
      setLoading(true);
      setError(null);
      try {
        const res: AuthResponse = await loginApi(params);
        login(res.user, res.accessToken);
        // 存储 refresh_token 到 localStorage（后续可迁移到 httpOnly cookie）
        if (typeof window !== 'undefined') {
          localStorage.setItem('refresh_token', res.refreshToken);
        }
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : '登录失败';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [login],
  );

  /**
   * 注册
   */
  const handleRegister = useCallback(
    async (params: RegisterParams) => {
      setLoading(true);
      setError(null);
      try {
        return await registerApi(params);
      } catch (err) {
        const message = err instanceof Error ? err.message : '注册失败';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * 登出
   */
  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutApi();
    } catch {
      // 即使后端调用失败，前端也清除状态
    } finally {
      logout();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refresh_token');
      }
      setLoading(false);
    }
  }, [logout]);

  /**
   * 自动刷新 Token
   * 当 access_token 即将过期时自动刷新
   */
  const handleRefreshToken = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return;

    try {
      const res = await refreshTokenApi(refreshToken);
      login(res.user, res.accessToken);
      localStorage.setItem('refresh_token', res.refreshToken);
      return res;
    } catch {
      // 刷新失败，清除登录状态
      logout();
      localStorage.removeItem('refresh_token');
    }
  }, [login, logout]);

  return {
    user,
    accessToken,
    isAuthenticated,
    loading,
    error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    refreshToken: handleRefreshToken,
    clearError: () => setError(null),
  };
}
