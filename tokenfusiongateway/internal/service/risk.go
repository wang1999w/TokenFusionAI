package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"tokenfusiongateway/pkg/logger"
	gwredis "tokenfusiongateway/pkg/redis"
)

// Redis 键前缀
const (
	riskBlacklistPrefix = "risk:blacklist:" // 黑名单键前缀，risk:blacklist:{userID|deviceID}
	riskQuotaPrefix     = "risk:quota:"     // 额度键前缀，risk:quota:{userID}
	riskRateLimitPrefix = "risk:ratelimit:" // 频率限制键前缀，risk:ratelimit:{key}:{window}

	// Phase 6 新增风控键
	riskIPBlacklistSet   = "risk:blacklist:ips"    // IP 黑名单集合，SISMEMBER 查询
	riskBlockedCIDRSet   = "risk:blocked:cidrs"    // 封禁 CIDR 集合（地区限制），SMEMBERS 查询
	riskDeviceDailyFmt   = "risk:device:daily:%s:%s" // 免登设备每日用量键，{deviceID}:{date}
)

// 风控默认参数
const (
	defaultRateLimit       = 60            // 默认每分钟请求上限
	defaultRateWindow      = time.Minute   // 默认频率统计窗口（1 分钟）
	defaultBlacklistTTL    = 24 * time.Hour // 黑名单默认过期时间

	// Phase 6 新增默认参数
	defaultDeviceDailyCap = 1000 // 默认每个免登设备每日请求上限
)

// RiskService 风控基础服务
// Phase 4 实现基础能力：黑名单查询、额度校验、基础频率限制
// Phase 6 增强：设备维度免登额度封顶、IP 维度地区限制、IP 黑名单实时查询
type RiskService struct {
	redis            *gwredis.Client // Redis 客户端，用于黑名单/额度/计数器
	deviceDailyCap   int             // 免登设备每日请求上限（运行时可调）
}

// NewRiskService 创建风控服务实例
func NewRiskService(redis *gwredis.Client) *RiskService {
	return &RiskService{
		redis:          redis,
		deviceDailyCap: defaultDeviceDailyCap,
	}
}

// SetDeviceDailyCap 设置免登设备每日请求上限（运行时动态调整）
func (s *RiskService) SetDeviceDailyCap(cap int) {
	if cap > 0 {
		s.deviceDailyCap = cap
	}
}

// Check 综合风控校验入口（Phase 6 增强，新增 IP 维度）
// 校验顺序：黑名单(主体) -> IP 黑名单 -> 地区限制 -> 频率限制 -> 额度校验
// 任一环节不通过即返回对应错误
//
// ip 为调用方 IP，为空时跳过 IP 维度校验（兼容旧调用）
func (s *RiskService) Check(ctx context.Context, auth *AuthResult, ip string) error {
	// 构造风控主体标识：优先使用 userID，免登用户使用 deviceID
	subject := auth.UserID
	if subject == "" {
		subject = auth.DeviceID
	}
	if subject == "" {
		// 既无 userID 也无 deviceID，无法进行风控，直接拒绝
		return ErrUnauthorized
	}

	// 1. 黑名单校验（用户/设备维度，实时查询 Redis）
	if err := s.CheckBan(ctx, subject); err != nil {
		return err
	}

	// 2. IP 维度风控（黑名单实时查询 + 地区限制）
	if ip != "" {
		if err := s.CheckIPBan(ctx, ip); err != nil {
			return err
		}
		if err := s.CheckRegion(ctx, ip); err != nil {
			return err
		}
	}

	// 3. 基础频率限制
	if err := s.RateLimit(ctx, subject, defaultRateLimit, defaultRateWindow); err != nil {
		return err
	}

	// 4. 额度校验
	//    已登录用户/API Key 用户：校验 Token 额度
	//    免登设备：校验每日免登额度封顶
	if auth.Type != AuthTypeDevice {
		if err := s.CheckQuota(ctx, auth.UserID); err != nil {
			return err
		}
	} else {
		if err := s.CheckDeviceQuota(ctx, auth.DeviceID); err != nil {
			return err
		}
	}

	return nil
}

// CheckBan 检查用户/设备是否被封禁（黑名单查询）
// 黑名单通过 Redis SET 或 STRING 存储，命中即返回 ErrForbidden
func (s *RiskService) CheckBan(ctx context.Context, subject string) error {
	key := riskBlacklistPrefix + subject
	client := s.redis.GetClient()

	// 查询黑名单是否存在该主体
	result, err := client.Get(ctx, key).Result()
	if err != nil {
		// 键不存在表示未被封禁，属于正常情况
		if errors.Is(err, goredis.Nil) {
			return nil
		}
		// Redis 异常时采用容错策略（放行），仅记录日志，避免 Redis 故障导致全部请求失败
		logger.Error("查询黑名单失败", zap.String("subject", subject), zap.Error(err))
		return nil
	}

	// 命中黑名单，记录原因并拒绝
	logger.Warn("用户命中黑名单",
		zap.String("subject", subject),
		zap.String("reason", result),
	)
	return ErrForbidden
}

// CheckQuota 额度校验
// Phase 4 基础实现：查询用户剩余额度（Redis 缓存），额度不足返回 ErrQuotaExceeded
// 实际预扣动作由计费服务（BillingService.Freeze）完成，此处仅做前置校验
func (s *RiskService) CheckQuota(ctx context.Context, userID string) error {
	if userID == "" {
		return nil
	}

	key := riskQuotaPrefix + userID
	client := s.redis.GetClient()

	// 查询剩余额度（由后端同步写入 Redis 缓存）
	val, err := client.Get(ctx, key).Int64()
	if err != nil {
		// 额度缓存不存在时，不直接拦截，交由计费服务预扣时由后端判定
		if errors.Is(err, goredis.Nil) {
			return nil
		}
		logger.Error("查询额度失败", zap.String("user_id", userID), zap.Error(err))
		return nil
	}

	// 额度耗尽
	if val <= 0 {
		return ErrQuotaExceeded
	}
	return nil
}

// RateLimit 基础频率限制（Redis 计数器）
// 在指定时间窗口内限制请求次数，超过限制返回 ErrRateLimited
// 实现原理：首次请求 INCR 并设置过期时间，后续请求仅 INCR，超过阈值即拒绝
func (s *RiskService) RateLimit(ctx context.Context, key string, limit int, window time.Duration) error {
	if limit <= 0 {
		return nil // limit <= 0 表示不限制
	}

	redisKey := fmt.Sprintf("%s%s:%d", riskRateLimitPrefix, key, int(window.Seconds()))
	client := s.redis.GetClient()

	// 原子递增计数
	count, err := client.Incr(ctx, redisKey).Result()
	if err != nil {
		// Redis 异常时容错放行，避免影响正常请求
		logger.Error("频率限制计数失败", zap.String("key", key), zap.Error(err))
		return nil
	}

	// 首次请求时设置过期时间（窗口结束后自动清零）
	if count == 1 {
		if err := client.Expire(ctx, redisKey, window).Err(); err != nil {
			logger.Warn("设置频率限制过期时间失败", zap.String("key", redisKey), zap.Error(err))
		}
	}

	// 超过阈值，触发限流
	if count > int64(limit) {
		logger.Warn("触发频率限制",
			zap.String("key", key),
			zap.Int64("count", count),
			zap.Int("limit", limit),
		)
		return ErrRateLimited
	}

	return nil
}

// AddToBlacklist 将主体加入黑名单（供后续风控管理使用）
func (s *RiskService) AddToBlacklist(ctx context.Context, subject, reason string, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = defaultBlacklistTTL
	}
	key := riskBlacklistPrefix + subject
	return s.redis.GetClient().Set(ctx, key, reason, ttl).Err()
}

// RemoveFromBlacklist 将主体移出黑名单
func (s *RiskService) RemoveFromBlacklist(ctx context.Context, subject string) error {
	key := riskBlacklistPrefix + subject
	return s.redis.GetClient().Del(ctx, key).Err()
}

// ====================================================================================
// Phase 6 新增：IP 维度风控
// ====================================================================================

// CheckIPBan 检查 IP 是否被封禁（IP 黑名单实时查询）
// 使用 Redis 集合存储封禁 IP，SISMEMBER 查询，命中即返回 ErrForbidden
func (s *RiskService) CheckIPBan(ctx context.Context, ip string) error {
	if ip == "" {
		return nil
	}
	client := s.redis.GetClient()

	// 集合查询 O(1)，命中即拒绝
	isMember, err := client.SIsMember(ctx, riskIPBlacklistSet, ip).Result()
	if err != nil {
		// Redis 异常时容错放行，避免故障扩散
		logger.Error("查询 IP 黑名单失败", zap.String("ip", ip), zap.Error(err))
		return nil
	}
	if isMember {
		logger.Warn("IP 命中黑名单", zap.String("ip", ip))
		return ErrForbidden
	}
	return nil
}

// CheckRegion 检查 IP 所在地区是否被限制（地区限制配置）
// 通过封禁 CIDR 集合实现地区级封禁：管理员将需封禁的地区/网段以 CIDR 形式写入 Redis 集合。
// 由于不引入 GeoIP 依赖，地区以网段表达；命中任一封禁 CIDR 即返回 ErrForbidden
func (s *RiskService) CheckRegion(ctx context.Context, ip string) error {
	if ip == "" {
		return nil
	}
	client := s.redis.GetClient()

	// 读取封禁 CIDR 集合（中等规模，SMEMBERS 一次性读取后本地匹配）
	cidrs, err := client.SMembers(ctx, riskBlockedCIDRSet).Result()
	if err != nil {
		logger.Error("查询封禁 CIDR 集合失败", zap.Error(err))
		return nil // 容错放行
	}
	if len(cidrs) == 0 {
		return nil
	}

	// 解析客户端 IP
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		// 非法 IP 无法匹配 CIDR，放行交由后续校验
		return nil
	}

	// 逐一匹配封禁 CIDR
	for _, cidr := range cidrs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			// 配置了非法 CIDR，记录日志并跳过该项
			logger.Warn("非法 CIDR 配置，已跳过", zap.String("cidr", cidr), zap.Error(err))
			continue
		}
		if ipNet.Contains(parsedIP) {
			logger.Warn("IP 命中封禁地区(CIDR)",
				zap.String("ip", ip),
				zap.String("cidr", cidr),
			)
			return ErrForbidden
		}
	}
	return nil
}

// ====================================================================================
// Phase 6 新增：设备维度风控（免登额度封顶）
// ====================================================================================

// CheckDeviceQuota 免登设备每日额度校验
// 递增当日该设备的请求计数，超过每日上限即返回 ErrQuotaExceeded
// 计数器使用 INCR + 首次 EXPIRE，TTL 设为当日剩余时间，次日自动归零
func (s *RiskService) CheckDeviceQuota(ctx context.Context, deviceID string) error {
	if deviceID == "" {
		return nil
	}

	now := time.Now()
	date := now.Format("20060102")
	// 当日剩余时间，作为计数器 TTL，次日自动失效
	_, endOfDay := nextDayStart(now)
	ttl := endOfDay.Sub(now)
	if ttl <= 0 {
		ttl = time.Hour
	}

	key := fmt.Sprintf(riskDeviceDailyFmt, deviceID, date)
	client := s.redis.GetClient()

	// 原子递增计数
	count, err := client.Incr(ctx, key).Result()
	if err != nil {
		logger.Error("免登设备每日计数失败", zap.String("device_id", deviceID), zap.Error(err))
		return nil // 容错放行
	}
	// 首次请求设置过期时间（当日剩余时长）
	if count == 1 {
		if err := client.Expire(ctx, key, ttl).Err(); err != nil {
			logger.Warn("设置免登设备每日计数过期时间失败", zap.Error(err))
		}
	}

	// 超过每日封顶
	if count > int64(s.deviceDailyCap) {
		logger.Warn("免登设备触发每日额度封顶",
			zap.String("device_id", deviceID),
			zap.Int64("count", count),
			zap.Int("cap", s.deviceDailyCap),
		)
		return ErrQuotaExceeded
	}
	return nil
}

// nextDayStart 返回次日开始时刻（用于计算当日剩余时长）
func nextDayStart(t time.Time) (time.Time, time.Time) {
	start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	end := start.Add(24 * time.Hour)
	return start, end
}

// ====================================================================================
// Phase 6 新增：IP / 地区封禁管理方法（供风控管理后台调用）
// ====================================================================================

// AddBlockedIP 将 IP 加入封禁集合
func (s *RiskService) AddBlockedIP(ctx context.Context, ip string) error {
	return s.redis.GetClient().SAdd(ctx, riskIPBlacklistSet, ip).Err()
}

// RemoveBlockedIP 将 IP 移出封禁集合
func (s *RiskService) RemoveBlockedIP(ctx context.Context, ip string) error {
	return s.redis.GetClient().SRem(ctx, riskIPBlacklistSet, ip).Err()
}

// AddBlockedCIDR 将 CIDR 网段加入地区封禁集合
func (s *RiskService) AddBlockedCIDR(ctx context.Context, cidr string) error {
	if _, _, err := net.ParseCIDR(cidr); err != nil {
		return fmt.Errorf("invalid cidr: %w", err)
	}
	return s.redis.GetClient().SAdd(ctx, riskBlockedCIDRSet, cidr).Err()
}

// RemoveBlockedCIDR 将 CIDR 网段移出地区封禁集合
func (s *RiskService) RemoveBlockedCIDR(ctx context.Context, cidr string) error {
	return s.redis.GetClient().SRem(ctx, riskBlockedCIDRSet, cidr).Err()
}
