package middleware

import (
	"github.com/gin-gonic/gin"
)

// ====================================================================================
// 中间件共享上下文键与工具函数（internal/middleware/context.go）
// ------------------------------------------------------------------------------------
// 定义鉴权中间件写入、其它中间件（限流/熔断/风控）读取的 context 键，
// 以及通用的客户端 IP 提取工具，供 ratelimit / circuit / signature 等中间件复用。
// ====================================================================================

// context 键定义（字符串常量，便于跨中间件读写）
const (
	ContextKeyUserID     = "auth_user_id"      // 用户 ID（鉴权中间件写入，限流/风控读取）
	ContextKeyAuthType   = "auth_type"         // 鉴权类型：user/apikey/device
	ContextKeyDeviceID   = "auth_device_id"    // 设备 ID（免登用户）
	ContextKeyRole       = "auth_role"          // 用户角色
	ContextKeyAuthResult = "auth_result"       // 完整鉴权结果（service.AuthResult，handler 可直接读取）
	ContextKeyAPIKey     = "auth_api_key"       // 原始 API Key（脱敏审计用）
)

// clientIP 提取客户端真实 IP
// 优先使用 gin 内置的 ClientIP()，它会依次解析 X-Forwarded-For / X-Real-IP
// 在无法获取时回退到 RemoteAddr
func clientIP(c *gin.Context) string {
	ip := c.ClientIP()
	if ip == "" {
		ip = c.RemoteIP()
	}
	return ip
}
