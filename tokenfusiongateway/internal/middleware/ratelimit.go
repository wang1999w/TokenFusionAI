package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/pkg/logger"
	gwredis "tokenfusiongateway/pkg/redis"
)

// ====================================================================================
// 三级限流中间件（internal/middleware/ratelimit.go）
// ------------------------------------------------------------------------------------
// 实现三个维度的频率限制，保护网关与后端不被流量冲垮：
//   1. 用户级：每用户每分钟 N 次        Redis key: rate:user:{userId}
//   2. IP  级：每 IP  每分钟 N 次        Redis key: rate:ip:{ip}
//   3. 全局级：全站每秒 N 次            Redis key: rate:global
//
// 计数器使用 Redis INCR 实现；为避免“首次设置过期时间”与“并发递增”之间的竞态，
// 采用 Lua 脚本将 INCR 与 PEXPIRE 合并为一次原子操作（单命令原子，无需引入新依赖）。
//
// 超限时返回 HTTP 429，响应体为 {code:1002, message:"Rate limited"}（网关格式）；
// 对 OpenAI 兼容路由（/v1/*）则返回 OpenAI 格式 {error:{message,type,code}}。
// ====================================================================================

// RateLimitConfig 三级限流配置参数
type RateLimitConfig struct {
	UserPerMinute   int // 每用户每分钟请求上限，<=0 表示不限制
	IPPerMinute     int // 每 IP 每分钟请求上限，<=0 表示不限制
	GlobalPerSecond int // 全站每秒请求上限，<=0 表示不限制
}

// 默认限流参数（未显式配置时使用）
const (
	defaultUserPerMinute   = 120 // 默认每用户每分钟 120 次
	defaultIPPerMinute     = 300 // 默认每 IP 每分钟 300 次
	defaultGlobalPerSecond = 200 // 默认全站每秒 200 次
)

// 限流 Redis 键（与需求文档保持一致）
const (
	rateUserKeyFmt = "rate:user:%s" // 用户级计数键，rate:user:{userId}
	rateIPKeyFmt   = "rate:ip:%s"   // IP 级计数键，rate:ip:{ip}
	rateGlobalKey  = "rate:global"  // 全局级计数键
)

// 时间窗口
const (
	userWindow   = time.Minute // 用户/IP 级统计窗口：1 分钟
	globalWindow = time.Second // 全局级统计窗口：1 秒
)

// 限流错误码与文案（对齐需求：429 {code:1002, message:"Rate limited"}）
const (
	rateLimitCode    = model.CodeRateLimitedMiddleware // 限流业务码 1002
	rateLimitMessage = "Rate limited"                 // 限流提示文案
)

// incrExpireScript Lua 脚本：原子地 INCR 并在首次创建时设置过期时间
// 返回递增后的计数值，避免“INCR 成功但 EXPIRE 丢失”导致计数器永不过期的竞态
const incrExpireScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`

// 错误响应格式类型
type rateLimitErrorFormat int

const (
	errorFormatGateway rateLimitErrorFormat = iota // 网关格式 {code,message}
	errorFormatOpenAI                             // OpenAI 格式 {error:{...}}
)

// RateLimiter 三级限流器
type RateLimiter struct {
	redis  *gwredis.Client
	config RateLimitConfig
	format rateLimitErrorFormat
}

// NewRateLimiter 创建网关格式的限流器（用于 /gateway/v1 等内部路由）
func NewRateLimiter(redis *gwredis.Client, config RateLimitConfig) *RateLimiter {
	applyRateDefaults(&config)
	return &RateLimiter{redis: redis, config: config, format: errorFormatGateway}
}

// NewOpenAIRateLimiter 创建 OpenAI 格式的限流器（用于 /v1/* 兼容路由）
func NewOpenAIRateLimiter(redis *gwredis.Client, config RateLimitConfig) *RateLimiter {
	applyRateDefaults(&config)
	return &RateLimiter{redis: redis, config: config, format: errorFormatOpenAI}
}

// applyRateDefaults 填充未设置的限流参数为默认值
func applyRateDefaults(c *RateLimitConfig) {
	if c.UserPerMinute == 0 {
		c.UserPerMinute = defaultUserPerMinute
	}
	if c.IPPerMinute == 0 {
		c.IPPerMinute = defaultIPPerMinute
	}
	if c.GlobalPerSecond == 0 {
		c.GlobalPerSecond = defaultGlobalPerSecond
	}
}

// Middleware 返回 gin 中间件
// 执行顺序：全局级 -> IP 级 -> 用户级（任一超限即拦截）
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// 1. 全局级限流（全站每秒 N 次）
		if rl.config.GlobalPerSecond > 0 {
			count, err := rl.incr(ctx, rateGlobalKey, globalWindow)
			if err != nil {
				// Redis 异常时容错放行，避免 Redis 故障导致全站不可用
				logger.Warn("全局限流计数失败，容错放行", zap.Error(err))
			} else if count > int64(rl.config.GlobalPerSecond) {
				rl.reject(c)
				return
			}
		}

		// 2. IP 级限流（每 IP 每分钟 N 次）
		ip := clientIP(c)
		if rl.config.IPPerMinute > 0 && ip != "" {
			key := fmt.Sprintf(rateIPKeyFmt, ip)
			count, err := rl.incr(ctx, key, userWindow)
			if err != nil {
				logger.Warn("IP 限流计数失败，容错放行", zap.String("ip", ip), zap.Error(err))
			} else if count > int64(rl.config.IPPerMinute) {
				rl.reject(c)
				return
			}
		}

		// 3. 用户级限流（每用户每分钟 N 次）
		// 用户 ID 由前置鉴权中间件（APIKeyAuth）写入 context；未登录请求跳过用户级
		if rl.config.UserPerMinute > 0 {
			if userID, ok := c.Get(ContextKeyUserID); ok {
				if uid, ok := userID.(string); ok && uid != "" {
					key := fmt.Sprintf(rateUserKeyFmt, uid)
					count, err := rl.incr(ctx, key, userWindow)
					if err != nil {
						logger.Warn("用户限流计数失败，容错放行", zap.String("user_id", uid), zap.Error(err))
					} else if count > int64(rl.config.UserPerMinute) {
						rl.reject(c)
						return
					}
				}
			}
		}

		c.Next()
	}
}

// incr 原子递增计数器
// 使用 Lua 脚本保证 INCR 与首次 PEXPIRE 的原子性，返回当前窗口内的累计计数
func (rl *RateLimiter) incr(ctx context.Context, key string, window time.Duration) (int64, error) {
	client := rl.redis.GetClient()
	// 窗口换算为毫秒，传给 Lua 脚本的 ARGV[1]
	windowMs := int64(window / time.Millisecond)
	if windowMs <= 0 {
		windowMs = int64(rateLimitWindowMS)
	}
	// EVAL 执行原子递增脚本；KEYS[1]=key，ARGV[1]=窗口毫秒
	result, err := client.Eval(ctx, incrExpireScript, []string{key}, windowMs).Result()
	if err != nil {
		return 0, err
	}
	// EVAL 返回值为 int64
	count, ok := result.(int64)
	if !ok {
		// 兼容部分 Redis 版本返回字符串的情况
		if f, ok := result.(float64); ok {
			return int64(f), nil
		}
		return 0, fmt.Errorf("unexpected incr result type: %T", result)
	}
	return count, nil
}

// 毫秒级窗口默认值（兜底，避免 window<=0）
const rateLimitWindowMS = 60 * 1000

// reject 拦截请求并写入 429 响应
// 根据限流器配置的格式选择网关格式或 OpenAI 格式
func (rl *RateLimiter) reject(c *gin.Context) {
	c.AbortWithStatusJSON(429, rl.errorBody())
}

// errorBody 根据格式构造错误响应体
func (rl *RateLimiter) errorBody() interface{} {
	switch rl.format {
	case errorFormatOpenAI:
		// OpenAI 兼容格式：{error:{message,type,code}}
		return model.NewOpenAIError(
			rateLimitMessage,
			model.OpenAIErrTypeRateLimit,
			model.OpenAIErrCodeRateLimitExceeded,
		)
	default:
		// 网关格式：{code:1002, message:"Rate limited", data:null}
		return &model.GatewayResponse{
			Code:    rateLimitCode,
			Message: rateLimitMessage,
			Data:    nil,
		}
	}
}
