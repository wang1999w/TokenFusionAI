import { api } from './request';

/**
 * 用户 API 封装
 * 对接后端 /api/v1/user/* 接口
 */

/** 用户资料 */
export interface UserProfile {
  id: number;
  uuid: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  inviteCode: string;
  createdAt: string;
}

/**
 * 获取当前用户资料
 */
export async function getProfile(): Promise<UserProfile> {
  return api.get('/user/profile');
}

/**
 * 更新用户资料
 */
export async function updateProfile(data: {
  nickname?: string;
  avatarUrl?: string;
}): Promise<{ message: string }> {
  return api.put('/user/profile', data);
}
