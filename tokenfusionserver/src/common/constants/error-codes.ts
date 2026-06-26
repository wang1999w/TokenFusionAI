/**
 * 统一错误码定义
 */
export const ErrorCodes = {
  SUCCESS: 200,
  PARAM_MISSING: 4001,
  PARAM_INVALID: 4002,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOKEN_INSUFFICIENT: 1001,
  RATE_LIMITED: 1002,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
