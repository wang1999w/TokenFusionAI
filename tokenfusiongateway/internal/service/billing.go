package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"tokenfusiongateway/internal/config"
	"tokenfusiongateway/pkg/logger"
)

// 后端计费内部接口路径
const (
	billingFreezePath   = "/api/v1/billing/internal/freeze"   // 预扣 Token
	billingSettlePath   = "/api/v1/billing/internal/settle"   // 结算
	billingRollbackPath = "/api/v1/billing/internal/rollback" // 回补
)

// FreezeRequest 预扣 Token 请求体
// 在调用 AI 厂商前，先冻结预估的 Token 额度，防止超用
type FreezeRequest struct {
	UserID    string `json:"user_id"`             // 用户ID
	DeviceID  string `json:"device_id,omitempty"` // 设备ID（免登用户）
	Tokens    int    `json:"tokens"`              // 预扣 Token 数量
	Model     string `json:"model"`               // 调用的模型
	Type      string `json:"type"`                // 请求类型：chat/image/video/code
	RequestID string `json:"request_id"`          // 请求唯一ID，用于全链路追踪
}

// FreezeResult 预扣结果
type FreezeResult struct {
	OrderID string `json:"order_id"` // 预扣订单ID，后续结算/回补需携带
	Success bool   `json:"success"`  // 是否预扣成功
}

// SettleRequest 结算请求体
// 调用厂商成功后，根据实际 Token 消耗进行结算
type SettleRequest struct {
	OrderID          string `json:"order_id"`           // 预扣订单ID
	UserID           string `json:"user_id"`            // 用户ID
	PromptTokens     int    `json:"prompt_tokens"`      // 实际输入 Token 数
	CompletionTokens int    `json:"completion_tokens"`  // 实际输出 Token 数
	TotalTokens      int    `json:"total_tokens"`        // 实际总 Token 数
	Model            string `json:"model"`               // 实际使用的模型
	Provider         string `json:"provider"`            // 实际调用的厂商
	RequestID        string `json:"request_id"`          // 请求唯一ID
}

// RollbackRequest 回补请求体
// 调用厂商失败时，将预扣的额度回补给用户
type RollbackRequest struct {
	OrderID   string `json:"order_id"`  // 预扣订单ID
	UserID    string `json:"user_id"`   // 用户ID
	Reason    string `json:"reason"`    // 回补原因
	RequestID string `json:"request_id"` // 请求唯一ID
}

// billingResponse 后端计费接口统一响应
type billingResponse struct {
	Code    int    `json:"code"`    // 业务状态码：0 成功
	Message string `json:"message"` // 提示信息
	Data    struct {
		OrderID string `json:"order_id"` // 订单ID
	} `json:"data"`
}

// BillingService 计费服务
// 通过 HTTP 调用后端的计费内部接口，完成 Token 的预扣、结算、回补
type BillingService struct {
	cfg        *config.Config // 应用配置
	httpClient *http.Client   // HTTP 客户端
}

// NewBillingService 创建计费服务实例
func NewBillingService(cfg *config.Config) *BillingService {
	timeout := time.Duration(cfg.Backend.Timeout) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &BillingService{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// Freeze 预扣 Token
// 在调用 AI 厂商前调用，冻结预估 Token 额度
// 成功返回订单ID，失败返回 ErrQuotaExceeded 或具体错误
func (s *BillingService) Freeze(ctx context.Context, req *FreezeRequest) (*FreezeResult, error) {
	resp, err := s.callBackend(ctx, http.MethodPost, billingFreezePath, req)
	if err != nil {
		return nil, fmt.Errorf("freeze failed: %w", err)
	}

	// 后端业务码非 0，通常表示额度不足
	if resp.Code != 0 {
		logger.Warn("预扣 Token 失败",
			zap.String("user_id", req.UserID),
			zap.Int("tokens", req.Tokens),
			zap.String("message", resp.Message),
		)
		return nil, ErrQuotaExceeded
	}

	logger.Info("预扣 Token 成功",
		zap.String("order_id", resp.Data.OrderID),
		zap.String("user_id", req.UserID),
		zap.Int("tokens", req.Tokens),
	)

	return &FreezeResult{
		OrderID: resp.Data.OrderID,
		Success: true,
	}, nil
}

// Settle 结算
// 调用厂商成功后，根据实际 Token 消耗进行结算（多退少补）
func (s *BillingService) Settle(ctx context.Context, req *SettleRequest) error {
	resp, err := s.callBackend(ctx, http.MethodPost, billingSettlePath, req)
	if err != nil {
		return fmt.Errorf("settle failed: %w", err)
	}

	if resp.Code != 0 {
		logger.Warn("结算失败",
			zap.String("order_id", req.OrderID),
			zap.String("message", resp.Message),
		)
		return fmt.Errorf("settle failed: %s", resp.Message)
	}

	logger.Info("结算成功",
		zap.String("order_id", req.OrderID),
		zap.Int("total_tokens", req.TotalTokens),
	)
	return nil
}

// Rollback 回补
// 调用厂商失败时调用，将预扣的额度退回给用户
func (s *BillingService) Rollback(ctx context.Context, req *RollbackRequest) error {
	resp, err := s.callBackend(ctx, http.MethodPost, billingRollbackPath, req)
	if err != nil {
		return fmt.Errorf("rollback failed: %w", err)
	}

	if resp.Code != 0 {
		logger.Warn("回补失败",
			zap.String("order_id", req.OrderID),
			zap.String("message", resp.Message),
		)
		return fmt.Errorf("rollback failed: %s", resp.Message)
	}

	logger.Info("回补成功",
		zap.String("order_id", req.OrderID),
		zap.String("reason", req.Reason),
	)
	return nil
}

// EstimateTokens 粗略估算 Token 数量
// Phase 4 采用简单启发式：按字符数估算（英文约 4 字符/Token，中文约 1.5 字符/Token）
// 后续可接入更精确的分词器
func EstimateTokens(text string) int {
	if text == "" {
		return 1
	}
	// 统计 rune 数，按 3 字符/Token 估算（折中中英文）
	runes := 0
	for range text {
		runes++
	}
	tokens := runes / 3
	if tokens < 1 {
		tokens = 1
	}
	return tokens
}

// callBackend 调用后端计费内部接口的通用方法
// method 为 HTTP 方法，path 为接口路径，body 为请求体（会被 JSON 序列化）
// 所有请求自动携带 X-Internal-Key 头用于内部调用校验
func (s *BillingService) callBackend(ctx context.Context, method, path string, body interface{}) (*billingResponse, error) {
	url := strings.TrimRight(s.cfg.Backend.URL, "/") + path

	// 序列化请求体
	var bodyReader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body failed: %w", err)
		}
		bodyReader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	// 设置请求头：内部调用密钥、内容类型
	req.Header.Set(HeaderInternalKey, s.cfg.Backend.InternalKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call backend failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backend returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result billingResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response failed: %w", err)
	}

	return &result, nil
}
