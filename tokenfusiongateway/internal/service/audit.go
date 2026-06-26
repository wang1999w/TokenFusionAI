package service

import (
	"context"
	"encoding/json"
	"time"

	"go.uber.org/zap"

	"tokenfusiongateway/pkg/logger"
	gwredis "tokenfusiongateway/pkg/redis"
)

// Redis 键
const (
	auditLogListKey = "audit:logs" // 审计日志 Redis 列表键，异步消费后写入数据库
)

// 审计请求类型
const (
	AuditTypeChat  = "chat"  // 对话生成
	AuditTypeImage = "image" // 图片生成
	AuditTypeVideo = "video" // 视频生成
	AuditTypeCode  = "code"  // 代码生成
)

// 审计请求状态
const (
	AuditStatusSuccess = "success" // 成功
	AuditStatusFailed  = "failed"  // 失败
)

// prompt 截断长度（避免单个审计记录过大，仅保留前 512 字符用于排查）
const maxPromptLength = 512

// AuditEntry 审计日志条目
// 记录每次网关调用的关键信息，用于计费对账、问题排查、行为分析
type AuditEntry struct {
	RequestID string    `json:"request_id"`         // 请求唯一ID
	UserID    string    `json:"user_id,omitempty"`  // 用户ID（免登用户为空）
	DeviceID  string    `json:"device_id,omitempty"` // 设备ID（仅免登用户）
	AuthType  string    `json:"auth_type"`          // 鉴权类型：user/apikey/device
	Type      string    `json:"type"`                // 请求类型：chat/image/video/code
	Provider  string    `json:"provider"`            // 实际调用的厂商
	Model     string    `json:"model"`               // 调用的模型
	Prompt    string    `json:"prompt"`              // 提示词（已截断）
	TokenCost int       `json:"token_cost"`          // Token 消耗
	Duration  float64   `json:"duration"`            // 耗时（秒）
	Status    string    `json:"status"`              // 状态：success/failed
	Error     string    `json:"error,omitempty"`     // 错误信息（失败时）
	Timestamp time.Time `json:"timestamp"`           // 记录时间
}

// AuditService 审计日志服务
// Phase 4 将审计日志写入 Redis 列表，后续由异步任务消费并持久化到数据库
type AuditService struct {
	redis *gwredis.Client // Redis 客户端
}

// NewAuditService 创建审计日志服务实例
func NewAuditService(redis *gwredis.Client) *AuditService {
	return &AuditService{redis: redis}
}

// Log 记录一条审计日志
// 将日志序列化为 JSON 后 LPUSH 到 Redis 列表，异步消费写入数据库
// Redis 写入失败不影响主流程，仅记录错误日志
func (s *AuditService) Log(ctx context.Context, entry *AuditEntry) {
	// 补全默认字段
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}
	// 截断 prompt，避免审计记录过大
	entry.Prompt = truncate(entry.Prompt, maxPromptLength)

	// 序列化为 JSON
	payload, err := json.Marshal(entry)
	if err != nil {
		logger.Error("审计日志序列化失败",
			zap.String("request_id", entry.RequestID),
			zap.Error(err),
		)
		return
	}

	// 写入 Redis 列表（LPUSH，最新的在前）
	if err := s.redis.GetClient().LPush(ctx, auditLogListKey, payload).Err(); err != nil {
		// 审计日志写入失败不应影响主流程，仅记录错误
		logger.Error("审计日志写入 Redis 失败",
			zap.String("request_id", entry.RequestID),
			zap.Error(err),
		)
		return
	}

	logger.Debug("审计日志已记录",
		zap.String("request_id", entry.RequestID),
		zap.String("type", entry.Type),
		zap.String("provider", entry.Provider),
		zap.String("model", entry.Model),
		zap.String("status", entry.Status),
		zap.Int("token_cost", entry.TokenCost),
		zap.Float64("duration", entry.Duration),
	)
}

// truncate 截断字符串到指定最大长度，超出部分用省略号标记
func truncate(s string, maxLen int) string {
	if maxLen <= 0 {
		return ""
	}
	// 按 rune 统计，避免截断中文字符产生乱码
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + "..."
}
