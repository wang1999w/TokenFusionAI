package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"tokenfusiongateway/internal/config"
	"tokenfusiongateway/internal/middleware"
	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/internal/provider"
	"tokenfusiongateway/internal/service"
	gwredis "tokenfusiongateway/pkg/redis"
)

// Deps 处理器依赖集合
// 由 main 装配后传入，集中管理 handler 所需的所有服务依赖
type Deps struct {
	Cfg      *config.Config          // 应用配置
	Redis    *gwredis.Client         // Redis 客户端（视频任务存储等）
	Auth     *service.AuthService   // 鉴权服务
	Risk     *service.RiskService    // 风控服务
	Billing  *service.BillingService // 计费服务
	Dispatch *service.DispatchService // 厂商调度服务
	Audit    *service.AuditService  // 审计日志服务
}

// Handler 网关请求处理器
// 持有所有服务依赖，各类型请求（chat/image/video/code）的处理方法挂在其上
type Handler struct {
	cfg      *config.Config
	redis    *gwredis.Client
	auth     *service.AuthService
	risk     *service.RiskService
	billing  *service.BillingService
	dispatch *service.DispatchService
	audit    *service.AuditService
}

// NewHandler 根据依赖创建处理器实例
func NewHandler(deps *Deps) *Handler {
	return &Handler{
		cfg:      deps.Cfg,
		redis:    deps.Redis,
		auth:     deps.Auth,
		risk:     deps.Risk,
		billing:  deps.Billing,
		dispatch: deps.Dispatch,
		audit:    deps.Audit,
	}
}

// Setup 注册所有网关路由并装配处理器
// 中间件链由 main 负责（Recover/Logger/CORS/RequestID），本函数注册业务路由与路由级中间件
//
// 路由分组：
//   - /health          健康检查（无鉴权）
//   - /v1/*            OpenAI 兼容层（API Key 鉴权 + OpenAI 格式限流）
//   - /gateway/v1/*    内部网关（签名校验 + 三级限流 + 熔断，handler 内再做 device/token 鉴权）
func Setup(r *gin.Engine, deps *Deps) {
	h := NewHandler(deps)

	// 健康检查路由（无需鉴权，供探活使用）
	r.GET("/health", h.handleHealth)

	// ==================== OpenAI 兼容层路由组（/v1） ====================
	// 鉴权：统一 API Key（Authorization: Bearer sk-tf-xxx）
	// 限流：三级限流，错误响应采用 OpenAI 格式
	v1 := r.Group("/v1")
	{
		// API Key 鉴权中间件（写入鉴权结果到 context，供限流/handler 复用）
		v1.Use(middleware.NewAPIKeyAuth(deps.Auth).Middleware())
		// OpenAI 格式限流（用户级/IP级/全局级）
		v1.Use(middleware.NewOpenAIRateLimiter(deps.Redis, openAIRateLimitConfig(deps.Cfg)).Middleware())

		v1.POST("/chat/completions", h.HandleOpenAIChatCompletions)   // Chat Completions（支持 SSE 流式）
		v1.POST("/images/generations", h.HandleOpenAIImageGenerations) // Images Generations
		v1.GET("/models", h.HandleOpenAIModels)                        // 模型列表
	}

	// ==================== 内部网关路由组（/gateway/v1） ====================
	// 中间件链：签名校验 -> 三级限流 -> 熔断保护
	// 签名与限流保障内部 API 安全与稳定，熔断防止免登流量刷量
	gw := r.Group("/gateway/v1")
	{
		// 签名校验中间件（HMAC-SHA256 + 时间戳防重放，secret 为空时自动关闭）
		gw.Use(buildSignature(deps.Cfg, deps.Redis).Middleware())
		// 网关格式三级限流
		gw.Use(middleware.NewRateLimiter(deps.Redis, gatewayRateLimitConfig(deps.Cfg)).Middleware())
		// 熔断中间件（免登日消耗封顶 + 单小时突增熔断）
		gw.Use(middleware.NewCircuitBreaker(deps.Redis, circuitConfig(deps.Cfg)).Middleware())

		gw.POST("/chat", h.HandleChat)                       // 对话生成（支持 SSE 流式）
		gw.POST("/images/generations", h.HandleImage)       // 图片生成
		gw.POST("/videos/generations", h.HandleVideo)       // 视频生成（异步）
		gw.GET("/videos/tasks/:id", h.HandleVideoTask)      // 查询视频任务状态
		gw.POST("/code/generations", h.HandleCode)          // 代码生成
	}
}

// openAIRateLimitConfig 从应用配置构造 OpenAI 路由的三级限流参数
func openAIRateLimitConfig(cfg *config.Config) middleware.RateLimitConfig {
	return middleware.RateLimitConfig{
		UserPerMinute:   cfg.Security.RateUserPerMinute,
		IPPerMinute:     cfg.Security.RateIPPerMinute,
		GlobalPerSecond: cfg.Security.RateGlobalPerSecond,
	}
}

// gatewayRateLimitConfig 从应用配置构造内部网关路由的三级限流参数
func gatewayRateLimitConfig(cfg *config.Config) middleware.RateLimitConfig {
	return middleware.RateLimitConfig{
		UserPerMinute:   cfg.Security.RateUserPerMinute,
		IPPerMinute:     cfg.Security.RateIPPerMinute,
		GlobalPerSecond: cfg.Security.RateGlobalPerSecond,
	}
}

// circuitConfig 从应用配置构造熔断参数
func circuitConfig(cfg *config.Config) middleware.CircuitConfig {
	c := middleware.CircuitConfig{
		DeviceDailyCap:    cfg.Security.CircuitDeviceDailyCap,
		DeviceHourlySurge: cfg.Security.CircuitDeviceHourlySurge,
	}
	if cfg.Security.CircuitOpenTTL > 0 {
		c.OpenTTL = time.Duration(cfg.Security.CircuitOpenTTL) * time.Second
	}
	return c
}

// buildSignature 从应用配置构造签名校验中间件
func buildSignature(cfg *config.Config, redis *gwredis.Client) *middleware.Signature {
	sig := middleware.NewSignature(cfg.Security.SignatureSecret, redis)
	if cfg.Security.SignatureTTL > 0 {
		sig = sig.WithTTL(time.Duration(cfg.Security.SignatureTTL) * time.Second)
	}
	return sig
}

// handleHealth 健康检查端点，返回服务运行状态
func (h *Handler) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"service":  "tokenfusion-gateway",
		"version":  "phase4",
	})
}

// ==================== 通用辅助方法 ====================

// respondSuccess 返回成功响应（HTTP 200，业务码 0）
func (h *Handler) respondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, model.Success(data))
}

// respondError 返回失败响应
// 根据业务码映射 HTTP 状态码，响应体统一为 {code, message, data:null}
func (h *Handler) respondError(c *gin.Context, code int, message string) {
	c.JSON(httpStatusFor(code), model.Fail(code, message))
}

// httpStatusFor 根据业务状态码返回合适的 HTTP 状态码
func httpStatusFor(code int) int {
	switch code {
	case model.CodeUnauthorized:
		return http.StatusUnauthorized
	case model.CodeForbidden, model.CodeQuotaExceeded:
		return http.StatusForbidden
	case model.CodeRateLimited:
		return http.StatusTooManyRequests
	case model.CodeNoProvider, model.CodeProviderError:
		return http.StatusServiceUnavailable
	case model.CodeInvalidRequest:
		return http.StatusBadRequest
	default:
		return http.StatusOK
	}
}

// authenticate 执行鉴权，失败时已写入错误响应，调用方通过第二个返回值判断是否继续
func (h *Handler) authenticate(c *gin.Context) (*service.AuthResult, bool) {
	auth, err := h.auth.Authenticate(c.Request.Context(), c.Request.Header)
	if err != nil {
		h.respondError(c, model.CodeUnauthorized, "鉴权失败")
		return nil, false
	}
	return auth, true
}

// checkRisk 执行风控校验，失败时已写入错误响应
func (h *Handler) checkRisk(c *gin.Context, auth *service.AuthResult) bool {
	if err := h.risk.Check(c.Request.Context(), auth, c.ClientIP()); err != nil {
		h.respondError(c, mapRiskError(err), err.Error())
		return false
	}
	return true
}

// mapRiskError 将风控错误映射为业务状态码
func mapRiskError(err error) int {
	switch {
	case errors.Is(err, service.ErrForbidden):
		return model.CodeForbidden
	case errors.Is(err, service.ErrQuotaExceeded):
		return model.CodeQuotaExceeded
	case errors.Is(err, service.ErrRateLimited):
		return model.CodeRateLimited
	default:
		return model.CodeInternalError
	}
}

// requestID 从 gin context 获取请求ID
func (h *Handler) requestID(c *gin.Context) string {
	if v, ok := c.Get(middleware.ContextKey); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}

// rollback 通用回补封装，忽略错误（内部已记录日志）
func (h *Handler) rollback(ctx context.Context, orderID, userID, reqID, reason string) {
	_ = h.billing.Rollback(ctx, &service.RollbackRequest{
		OrderID:   orderID,
		UserID:    userID,
		Reason:    reason,
		RequestID: reqID,
	})
}

// messagesToText 将对话消息列表拼接为纯文本，用于 Token 预估
func messagesToText(messages []provider.Message) string {
	parts := make([]string, 0, len(messages))
	for _, m := range messages {
		parts = append(parts, m.Content)
	}
	return strings.Join(parts, "\n")
}
