package middleware

import (
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"tokenfusiongateway/pkg/logger"
)

// Recover Panic 恢复中间件
// 捕获 goroutine 中的 panic，记录错误和堆栈信息，返回 500 响应
// 防止单个请求的 panic 导致整个服务崩溃
func Recover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				// 记录 panic 错误和堆栈信息
				logger.Error("panic 已恢复",
					zap.Any("error", r),
					zap.ByteString("stack", debug.Stack()),
					zap.String("method", c.Request.Method),
					zap.String("path", c.Request.URL.Path),
				)
				// 返回 500 错误响应
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"code":    http.StatusInternalServerError,
					"message": "Internal Server Error",
				})
			}
		}()
		c.Next()
	}
}
