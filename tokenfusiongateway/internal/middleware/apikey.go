package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/internal/service"
	"tokenfusiongateway/pkg/logger"
)

// ====================================================================================
// API Key 鉴权中间件（internal/middleware/apikey.go）
// ------------------------------------------------------------------------------------
// 专用于 OpenAI 兼容路由（/v1/*），采用 OpenAI 标准鉴权方式：
//   Authorization: Bearer sk-tf-xxx
//
// 校验流程：
//   1. 从 Authorization 头提取 Bearer token（格式：Bearer <token>）
//   2. 调用 AuthService.AuthenticateAPIKey 校验 sk-tf-xxx 并获取用户信息
//   3. 将鉴权结果（AuthResult）写入 gin context，供后续限流/风控/handler 读取
//
// 注意：OpenAI 兼容路由不走 device/token 鉴权，统一使用 API Key。
// ====================================================================================

// APIKeyAuth API Key 鉴权中间件
type APIKeyAuth struct {
	auth *service.AuthService
}

// NewAPIKeyAuth 创建 API Key 鉴权中间件
func NewAPIKeyAuth(auth *service.AuthService) *APIKeyAuth {
	return &APIKeyAuth{auth: auth}
}

// Middleware 返回 gin 中间件
func (m *APIKeyAuth) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 从 Authorization 头提取 Bearer token
		token := extractBearer(c.GetHeader("Authorization"))
		if token == "" {
			m.reject(c, http.StatusUnauthorized,
				"You didn't provide an API key. Provide your API key via the Authorization header (e.g., 'Authorization: Bearer sk-tf-...').",
				model.OpenAIErrCodeMissingAPIKey,
			)
			return
		}

		// 2. 校验 API Key（sk-tf-xxx）
		authResult, err := m.auth.AuthenticateAPIKey(c.Request.Context(), token)
		if err != nil {
			logger.Warn("OpenAI 兼容层 API Key 校验失败",
				zap.String("ip", clientIP(c)),
				zap.Error(err),
			)
			m.reject(c, http.StatusUnauthorized,
				"Incorrect API key provided.",
				model.OpenAIErrCodeInvalidAPIKey,
			)
			return
		}

		// 3. 将鉴权结果写入 context，供限流/风控/handler 复用
		c.Set(ContextKeyUserID, authResult.UserID)
		c.Set(ContextKeyAuthType, authResult.Type)
		c.Set(ContextKeyRole, authResult.Role)
		c.Set(ContextKeyDeviceID, authResult.DeviceID)
		c.Set(ContextKeyAuthResult, authResult)
		c.Set(ContextKeyAPIKey, token)

		c.Next()
	}
}

// extractBearer 从 Authorization 头提取 Bearer token
// 格式：Bearer <token>，大小写不敏感
func extractBearer(auth string) string {
	const prefix = "Bearer "
	if len(auth) > len(prefix) && strings.EqualFold(auth[:len(prefix)], prefix) {
		return strings.TrimSpace(auth[len(prefix):])
	}
	return ""
}

// reject 拦截请求并返回 OpenAI 兼容错误格式
func (m *APIKeyAuth) reject(c *gin.Context, status int, message, code string) {
	c.AbortWithStatusJSON(status, model.NewOpenAIError(
		message,
		model.OpenAIErrTypeAuthentication,
		code,
	))
}
