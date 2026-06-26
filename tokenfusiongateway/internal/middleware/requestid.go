package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestIDHeader 请求 ID 的 HTTP 头名称
const RequestIDHeader = "X-Request-Id"

// ContextKey 在 gin context 中存储请求 ID 的键名
const ContextKey = "request_id"

// RequestID 请求 ID 中间件
// 为每个请求分配唯一 ID：
// - 如果上游请求已携带 X-Request-Id，则复用
// - 否则生成新的 UUID
// ID 存入 gin context 并写入响应头，便于全链路追踪
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 优先复用上游传入的请求 ID
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			// 无上游 ID 时生成新 UUID
			id = uuid.New().String()
		}

		// 存入 context 供后续中间件和 handler 使用
		c.Set(ContextKey, id)
		// 写入响应头，客户端可据此追踪请求
		c.Writer.Header().Set(RequestIDHeader, id)

		c.Next()
	}
}
