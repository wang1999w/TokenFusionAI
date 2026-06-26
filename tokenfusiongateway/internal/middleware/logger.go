package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"tokenfusiongateway/pkg/logger"
)

// Logger 请求日志中间件
// 使用 zap 记录每个请求的方法、路径、状态码、耗时、IP 等信息
// 根据状态码分级：5xx Error，4xx Warn，其他 Info
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", raw),
			zap.String("ip", c.ClientIP()),
			zap.Int("status", status),
			zap.Int("body_size", c.Writer.Size()),
			zap.Duration("latency", latency),
			zap.String("user_agent", c.Request.UserAgent()),
		}

		if reqID, exists := c.Get(ContextKey); exists {
			if id, ok := reqID.(string); ok {
				fields = append(fields, zap.String("request_id", id))
			}
		}

		if len(c.Errors) > 0 {
			logger.Error(c.Errors.String(), fields...)
			return
		}

		switch {
		case status >= 500:
			logger.Error("request completed", fields...)
		case status >= 400:
			logger.Warn("request completed", fields...)
		default:
			logger.Info("request completed", fields...)
		}
	}
}
