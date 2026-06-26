import { api } from './request';

/**
 * 认证 API 封装
 * 对接后端 /api/v1/auth/* 接口
 */

/** 登录请求参数 */
export interface LoginParams {
  email: string;
  password: string;
  deviceId?: string;
}

/** 注册请求参数 */
export interface RegisterParams {
  email: string;
  password: string;
  nickname?: string;
  inviteCode?: string;
}

/** 登录响应数据 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: number;
    uuid: string;
    email: string;
    nickname: string | null;
    avatarUrl: string | null;
    role: string;
    emailVerified: boolean;
  };
}

/**
 * 用户注册
 */
export async function register(params: RegisterParams): Promise<{ message: string; userId: number }> {
  return api.post('/auth/register', params);
}

/**
 * 用户登录
 */
export async function login(params: LoginParams): Promise<AuthResponse> {
  return api.post('/auth/login', params);
}

/**
 * 刷新 Token
 */
export async function refreshToken(token: string, deviceId?: string): Promise<AuthResponse> {
  return api.post('/auth/refresh', { refreshToken: token, deviceId });
}

/**
 * 登出
 */
export async function logout(deviceId?: string): Promise<{ message: string }> {
  return api.post('/auth/logout', { deviceId });
}

/**
 * 发送邮箱验证码
 */
export async function sendVerification(email: string): Promise<{ message: string }> {
  return api.post('/auth/send-verification', { email });
}

/**
 * 验证邮箱
 */
export async function verifyEmail(email: string, code: string): Promise<{ message: string }> {
  return api.post('/auth/verify-email', { email, code });
}

/**
 * 找回密码（发送重置邮件）
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return api.post('/auth/forgot-password', { email });
}

/**
 * 重置密码
 */
export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return api.post('/auth/reset-password', { token, password });
}
