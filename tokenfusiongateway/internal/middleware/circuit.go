package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/pkg/logger"
	gwredis "tokenfusiongateway/pkg/redis"
)

// ====================================================================================
// 熔断中间件（internal/middleware/circuit.go）
// ------------------------------------------------------------------------------------
// 针对免登（device）流量进行消耗封顶与突增熔断，防止恶意刷量拖垮系统：
//   1. 全站免登日消耗封顶：统计每日免登请求数，超过阈值即熔断
//      Redis key: circuit:device:daily:{date}
//   2. 单小时突增熔断：单小时免登请求数突增超过阈值即熔断
//      Redis key: circuit:device:hourly:{date:hour}
//   3. 熔断状态存储 Redis 并设置 TTL，到期自动恢复（半开/自动恢复）
//      Redis key: circuit:open:{scope}
//
// 熔断触发后，对应维度的请求直接返回 503，保护后端服务。
// 注：本中间件按“请求数”作为消耗代理指标（免登请求难以预估 Token），
//     实际 Token 消耗封顶可由 risk.CheckDeviceQuota 在 handler 层配合完成。
// ====================================================================================

// CircuitConfig 熔断配置参数
type CircuitConfig struct {
	DeviceDailyCap   int           // 全站免登每日请求数上限
	DeviceHourlySurge int          // 全站免登每小时突增阈值
	OpenTTL          time.Duration // 熔断开启后持续时间（到期自动恢复）
}

// 默认熔断参数
const (
	defaultDeviceDailyCap    = 100000 // 默认每日免登 10 万次
	defaultDeviceHourlySurge = 20000  // 默认每小时突增 2 万次
	defaultCircuitOpenTTL    = 5 * time.Minute // 默认熔断 5 分钟后自动恢复
)

// 熔断相关 Redis 键
const (
	circuitDeviceDailyFmt  = "circuit:device:daily:%s"  // 每日免登计数键，{date}
	circuitDeviceHourlyFmt = "circuit:device:hourly:%s" // 每小时免登计数键，{date:hour}
	circuitOpenDevice      = "circuit:open:device"       // 设备熔断开关键
	circuitOpenGlobal      = "circuit:open:global"       // 全局熔断开关键
)

// 熔断计数 Lua 脚本：原子 INCR + 首次 PEXPIRE，避免计数器永不过期
const circuitIncrScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`

// CircuitBreaker 熔断器
type CircuitBreaker struct {
	redis  *gwredis.Client
	config CircuitConfig
}

// NewCircuitBreaker 创建熔断器实例
func NewCircuitBreaker(redis *gwredis.Client, config CircuitConfig) *CircuitBreaker {
	applyCircuitDefaults(&config)
	return &CircuitBreaker{redis: redis, config: config}
}

// applyCircuitDefaults 填充默认熔断参数
func applyCircuitDefaults(c *CircuitConfig) {
	if c.DeviceDailyCap == 0 {
		c.DeviceDailyCap = defaultDeviceDailyCap
	}
	if c.DeviceHourlySurge == 0 {
		c.DeviceHourlySurge = defaultDeviceHourlySurge
	}
	if c.OpenTTL == 0 {
		c.OpenTTL = defaultCircuitOpenTTL
	}
}

// Middleware 返回熔断中间件
// 处理逻辑：
//   - 任何请求：先检查全局/设备熔断开关是否开启，开启则直接 503
//   - 免登请求（携带 X-Device-Id 或 context 中 auth_type=device）：
//     递增每日/每小时计数，超过阈值则开启熔断并 503
func (cb *CircuitBreaker) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// 1. 检查全局熔断开关（全局熔断拦截所有请求）
		if opened, err := cb.isOpen(ctx, circuitOpenGlobal); err == nil && opened {
			cb.reject(c, "全局熔断中，服务暂不可用")
			return
		}

		// 2. 判断是否为免登请求（device）
		//    判定依据：context 中 auth_type=device，或请求头携带 X-Device-Id
		if !cb.isDeviceRequest(c) {
			c.Next()
			return
		}

		// 3. 检查设备熔断开关
		if opened, err := cb.isOpen(ctx, circuitOpenDevice); err == nil && opened {
			cb.reject(c, "免登流量熔断中，请稍后重试或登录后使用")
			return
		}

		// 4. 递增每日免登计数，超限则开启熔断
		now := time.Now()
		dailyKey := fmt.Sprintf(circuitDeviceDailyFmt, now.Format("20060102"))
		if dailyCount, err := cb.incr(ctx, dailyKey, 24*time.Hour); err == nil {
			if dailyCount > int64(cb.config.DeviceDailyCap) {
				// 触达日封顶，开启设备熔断
				_ = cb.open(ctx, circuitOpenDevice, cb.config.OpenTTL)
				logger.Warn("免登日消耗封顶，触发熔断",
					zap.Int64("daily_count", dailyCount),
					zap.Int("cap", cb.config.DeviceDailyCap),
				)
				cb.reject(c, "免登日消耗已达上限，请登录后使用")
				return
			}
		} else {
			logger.Warn("免登日计数失败，容错放行", zap.Error(err))
		}

		// 5. 递增每小时免登计数，突增超限则开启熔断
		hourlyKey := fmt.Sprintf(circuitDeviceHourlyFmt, now.Format("2006010215"))
		if hourlyCount, err := cb.incr(ctx, hourlyKey, time.Hour); err == nil {
			if hourlyCount > int64(cb.config.DeviceHourlySurge) {
				_ = cb.open(ctx, circuitOpenDevice, cb.config.OpenTTL)
				logger.Warn("免登小时突增，触发熔断",
					zap.Int64("hourly_count", hourlyCount),
					zap.Int("surge", cb.config.DeviceHourlySurge),
				)
				cb.reject(c, "免登流量突增，触发熔断保护")
				return
			}
		} else {
			logger.Warn("免登小时计数失败，容错放行", zap.Error(err))
		}

		c.Next()
	}
}

// isDeviceRequest 判断当前请求是否为免登（device）请求
// 优先读取鉴权中间件写入的 auth_type，其次读取 X-Device-Id 请求头
func (cb *CircuitBreaker) isDeviceRequest(c *gin.Context) bool {
	if t, ok := c.Get(ContextKeyAuthType); ok {
		if authType, ok := t.(string); ok && authType == "device" {
			return true
		}
	}
	return c.GetHeader("X-Device-Id") != ""
}

// isOpen 查询指定熔断开关是否处于开启状态
// 键存在即为开启；Redis 异常时容错放行（返回 false），避免故障扩散
func (cb *CircuitBreaker) isOpen(ctx context.Context, key string) (bool, error) {
	n, err := cb.redis.GetClient().Exists(ctx, key).Result()
	if err != nil {
		logger.Warn("查询熔断状态失败，容错放行", zap.String("key", key), zap.Error(err))
		return false, err
	}
	return n > 0, nil
}

// open 开启熔断开关（设置键并带 TTL，到期自动恢复）
func (cb *CircuitBreaker) open(ctx context.Context, key string, ttl time.Duration) error {
	return cb.redis.GetClient().Set(ctx, key, "1", ttl).Err()
}

// Close 手动关闭熔断开关（用于运维手动恢复，或半开探测成功后调用）
func (cb *CircuitBreaker) Close(ctx context.Context, key string) error {
	return cb.redis.GetClient().Del(ctx, key).Err()
}

// incr 原子递增计数器（Lua 脚本保证 INCR + PEXPIRE 原子性）
func (cb *CircuitBreaker) incr(ctx context.Context, key string, window time.Duration) (int64, error) {
	windowMs := int64(window / time.Millisecond)
	result, err := cb.redis.GetClient().Eval(ctx, circuitIncrScript, []string{key}, windowMs).Result()
	if err != nil {
		return 0, err
	}
	if count, ok := result.(int64); ok {
		return count, nil
	}
	if f, ok := result.(float64); ok {
		return int64(f), nil
	}
	return 0, fmt.Errorf("unexpected circuit incr result type: %T", result)
}

// reject 拦截请求并返回 503
// 熔断属于服务端保护，使用 503 Service Unavailable
func (cb *CircuitBreaker) reject(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusServiceUnavailable, &model.GatewayResponse{
		Code:    model.CodeProviderError,
		Message: message,
		Data:    nil,
	})
}
