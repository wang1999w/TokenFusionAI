package middleware

import "github.com/gin-gonic/gin"

// CORS 跨域中间件
// 开发阶段允许所有来源、方法和必要请求头
// 对 OPTIONS 预检请求直接返回 204 No Content
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 设置跨域响应头
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-Id")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400") // 预检缓存 24 小时

		// 处理 OPTIONS 预检请求，直接返回 204
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
