package service

import "errors"

// 鉴权与风控相关错误
// 这些错误用于在 service 层与 handler 层之间传递失败原因，
// handler 层据此映射为统一的业务状态码返回给客户端
var (
	// ErrUnauthorized 未授权（鉴权凭证缺失或无效）
	ErrUnauthorized = errors.New("unauthorized: invalid or missing credentials")

	// ErrForbidden 禁止访问（用户被封禁等）
	ErrForbidden = errors.New("forbidden: access denied")

	// ErrQuotaExceeded 额度不足（预扣 Token 失败）
	ErrQuotaExceeded = errors.New("quota exceeded: insufficient token quota")

	// ErrRateLimited 触发频率限制
	ErrRateLimited = errors.New("rate limited: too many requests")

	// ErrNoProvider 无可用 AI 厂商
	ErrNoProvider = errors.New("no available provider")

	// ErrProviderUnavailable 厂商不可用
	ErrProviderUnavailable = errors.New("provider unavailable")
)
