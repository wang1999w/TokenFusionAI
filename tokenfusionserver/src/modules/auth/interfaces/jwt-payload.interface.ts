import { UserRole, UserStatus } from '../../user/user.entity';

/**
 * JWT Payload 结构
 * 编码在 access_token 中，包含用户身份信息
 */
export interface JwtPayload {
  sub: number;       // 用户 ID
  uuid: string;      // 用户 UUID
  email: string;      // 邮箱
  role: UserRole;     // 角色
  status: UserStatus; // 状态
  iat?: number;       // 签发时间（由 jwt 库自动填充）
  exp?: number;       // 过期时间（由 jwt 库自动填充）
}

/**
 * 登录响应体
 */
export interface AuthResponse {
  accessToken: string;   // 短期访问令牌
  refreshToken: string;   // 长期刷新令牌
  expiresIn: number;      // access_token 过期时间（秒）
  user: {
    id: number;
    uuid: string;
    email: string;
    nickname: string | null;
    avatarUrl: string | null;
    role: UserRole;
    emailVerified: boolean;
  };
}
