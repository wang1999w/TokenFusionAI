package handler

import (
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/internal/provider"
	"tokenfusiongateway/internal/service"
	"tokenfusiongateway/pkg/logger"
	"tokenfusiongateway/pkg/sse"
)

// 流式输出时模拟分片的大小（厂商不支持流式时退化为分片推送）
const streamChunkSize = 20

// HandleChat 对话生成处理器
// POST /gateway/v1/chat
//
// 处理流程：
//  1. 解析请求体
//  2. 鉴权（access_token / api_key / device_id）
//  3. 风控校验（黑名单、频率、额度）
//  4. 预估 Token 并预扣
//  5. 调度厂商
//  6. 调用厂商：stream=true 时透传 SSE，否则同步返回
//  7. 成功结算 / 失败回补
//  8. 记录审计日志
func (h *Handler) HandleChat(c *gin.Context) {
	ctx := c.Request.Context()
	start := time.Now()
	reqID := h.requestID(c)

	// 1. 解析请求
	var req model.GatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, model.CodeInvalidRequest, "请求参数错误: "+err.Error())
		return
	}
	if req.Model == "" || len(req.Messages) == 0 {
		h.respondError(c, model.CodeInvalidRequest, "model 和 messages 为必填项")
		return
	}

	// 2. 鉴权
	auth, ok := h.authenticate(c)
	if !ok {
		return
	}

	// 3. 风控校验
	if !h.checkRisk(c, auth) {
		return
	}

	// 4. 预估 Token 并预扣
	estPrompt := service.EstimateTokens(messagesToText(req.Messages))
	estCompletion := req.MaxTokens
	if estCompletion <= 0 {
		estCompletion = 1024 // 默认预估输出 Token
	}
	estTotal := estPrompt + estCompletion

	freezeReq := &service.FreezeRequest{
		UserID:    auth.UserID,
		DeviceID:  auth.DeviceID,
		Tokens:    estTotal,
		Model:     req.Model,
		Type:      service.AuditTypeChat,
		RequestID: reqID,
	}
	freeze, err := h.billing.Freeze(ctx, freezeReq)
	if err != nil {
		code := model.CodeQuotaExceeded
		if !errors.Is(err, service.ErrQuotaExceeded) {
			code = model.CodeInternalError
		}
		h.respondError(c, code, "预扣 Token 失败")
		return
	}

	// 5. 调度厂商
	p, err := h.dispatch.Select(ctx)
	if err != nil {
		// 无可用厂商，回补并返回错误
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "no available provider")
		h.respondError(c, model.CodeNoProvider, "无可用 AI 厂商")
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, "", req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 构造厂商请求
	chatReq := &provider.ChatRequest{
		Model:       req.Model,
		Messages:    req.Messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Stream:      req.Stream,
	}

	// 6. 根据是否流式分流处理
	if req.Stream {
		h.handleChatStream(c, auth, &req, p, chatReq, freeze, reqID, start)
		return
	}

	h.handleChatSync(c, auth, &req, p, chatReq, freeze, reqID, start)
}

// handleChatSync 同步对话处理（非流式）
func (h *Handler) handleChatSync(c *gin.Context, auth *service.AuthResult, req *model.GatewayRequest, p provider.Provider, chatReq *provider.ChatRequest, freeze *service.FreezeResult, reqID string, start time.Time) {
	ctx := c.Request.Context()

	// 调用厂商
	resp, err := p.Chat(ctx, chatReq)
	if err != nil {
		// 调用失败：标记厂商不可用、回补、返回错误
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
		h.respondError(c, model.CodeProviderError, "厂商调用失败")
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, p.Name(), req.Model, *req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 结算（按实际 Token 用量，缺失时使用预估值）
	totalTokens := resp.Usage.TotalTokens
	if totalTokens == 0 {
		totalTokens = freezeReqTokens(chatReq, resp)
	}
	settleReq := &service.SettleRequest{
		OrderID:          freeze.OrderID,
		UserID:           auth.UserID,
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		TotalTokens:      totalTokens,
		Model:            req.Model,
		Provider:         p.Name(),
		RequestID:        reqID,
	}
	if err := h.billing.Settle(ctx, settleReq); err != nil {
		// 结算失败不阻断响应（已生成内容），仅记录日志
		logger.Error("结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 返回统一格式
	h.respondSuccess(c, &model.ChatResult{
		ID:      resp.ID,
		Model:   resp.Model,
		Message: resp.Message,
		Usage:   resp.Usage,
	})

	// 记录审计日志
	h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, p.Name(), req.Model, *req, totalTokens, time.Since(start), service.AuditStatusSuccess, "", reqID))
}

// handleChatStream 流式对话处理（SSE 透传）
func (h *Handler) handleChatStream(c *gin.Context, auth *service.AuthResult, req *model.GatewayRequest, p provider.Provider, chatReq *provider.ChatRequest, freeze *service.FreezeResult, reqID string, start time.Time) {
	ctx := c.Request.Context()

	// 初始化 SSE 写入器
	sseWriter, err := sse.New(c.Writer)
	if err != nil {
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "sse init failed")
		h.respondError(c, model.CodeInternalError, "SSE 初始化失败")
		return
	}

	// 判断厂商是否支持流式接口（透传底层 SSE）
	if streamProvider, ok := p.(provider.ChatStreamProvider); ok {
		h.streamFromProvider(c, sseWriter, auth, req, p, streamProvider, chatReq, freeze, reqID, start)
		return
	}

	// 厂商不支持流式：退化为整体调用后分片推送
	h.streamFallback(c, sseWriter, auth, req, p, chatReq, freeze, reqID, start)
}

// streamFromProvider 透传底层 SSE 流
// 从厂商流式接口读取分片，逐片通过 SSE 推送给客户端
func (h *Handler) streamFromProvider(c *gin.Context, w *sse.SSEWriter, auth *service.AuthResult, req *model.GatewayRequest, p provider.Provider, sp provider.ChatStreamProvider, chatReq *provider.ChatRequest, freeze *service.FreezeResult, reqID string, start time.Time) {
	ctx := c.Request.Context()

	ch, err := sp.ChatStream(ctx, chatReq)
	if err != nil {
		// 启动流式失败：标记不可用、回补、通过 SSE 返回错误
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "stream start failed: "+err.Error())
		_ = w.WriteError("厂商调用失败")
		_ = w.WriteDone()
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, p.Name(), req.Model, *req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	var lastUsage *provider.Usage
	var totalTokens int
	var fullText strings.Builder

	// 消费流式分片并透传
	for chunk := range ch {
		// 流式过程中出错
		if chunk.Err != nil {
			h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "stream error: "+chunk.Err.Error())
			_ = w.WriteError(chunk.Err.Error())
			_ = w.WriteDone()
			h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, p.Name(), req.Model, *req, totalTokens, time.Since(start), service.AuditStatusFailed, chunk.Err.Error(), reqID))
			return
		}

		// 透传增量内容
		if chunk.Delta != "" {
			_ = w.WriteData(chunk.Delta)
			fullText.WriteString(chunk.Delta)
		}
		// 记录最后一片的 Token 用量
		if chunk.Usage != nil {
			lastUsage = chunk.Usage
		}
		if chunk.Done {
			break
		}
	}

	// 结算
	if lastUsage != nil {
		totalTokens = lastUsage.TotalTokens
	}
	if totalTokens == 0 {
		totalTokens = service.EstimateTokens(fullText.String())
	}
	settleReq := &service.SettleRequest{
		OrderID:   freeze.OrderID,
		UserID:    auth.UserID,
		PromptTokens: func() int {
			if lastUsage != nil {
				return lastUsage.PromptTokens
			}
			return 0
		}(),
		CompletionTokens: func() int {
			if lastUsage != nil {
				return lastUsage.CompletionTokens
			}
			return totalTokens
		}(),
		TotalTokens: totalTokens,
		Model:       req.Model,
		Provider:    p.Name(),
		RequestID:   reqID,
	}
	if err := h.billing.Settle(ctx, settleReq); err != nil {
		logger.Error("流式结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 结束事件
	_ = w.WriteDone()

	// 审计日志
	h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, p.Name(), req.Model, *req, totalTokens, time.Since(start), service.AuditStatusSuccess, "", reqID))
}

// streamFallback 退化流式处理
// 厂商不支持流式接口时，整体调用后按固定长度分片推送，模拟流式体验
func (h *Handler) streamFallback(c *gin.Context, w *sse.SSEWriter, auth *service.AuthResult, req *model.GatewayRequest, p provider.Provider, chatReq *provider.ChatRequest, freeze *service.FreezeResult, reqID string, start time.Time) {
	ctx := c.Request.Context()

	resp, err := p.Chat(ctx, chatReq)
	if err != nil {
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
		_ = w.WriteError("厂商调用失败")
		_ = w.WriteDone()
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, p.Name(), req.Model, *req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 按 rune 分片推送，避免中文截断乱码
	content := resp.Message.Content
	runes := []rune(content)
	for i := 0; i < len(runes); i += streamChunkSize {
		end := i + streamChunkSize
		if end > len(runes) {
			end = len(runes)
		}
		_ = w.WriteData(string(runes[i:end]))
	}

	// 结算
	totalTokens := resp.Usage.TotalTokens
	if totalTokens == 0 {
		totalTokens = service.EstimateTokens(content)
	}
	settleReq := &service.SettleRequest{
		OrderID:          freeze.OrderID,
		UserID:           auth.UserID,
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		TotalTokens:      totalTokens,
		Model:            req.Model,
		Provider:         p.Name(),
		RequestID:        reqID,
	}
	if err := h.billing.Settle(ctx, settleReq); err != nil {
		logger.Error("退化流式结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	_ = w.WriteDone()
	h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeChat, p.Name(), req.Model, *req, totalTokens, time.Since(start), service.AuditStatusSuccess, "", reqID))
}

// freezeReqTokens 计算结算用的 Token 总数（厂商未返回 usage 时使用预估值）
func freezeReqTokens(chatReq *provider.ChatRequest, resp *provider.ChatResponse) int {
	prompt := service.EstimateTokens(messagesToText(chatReq.Messages))
	completion := chatReq.MaxTokens
	if completion <= 0 {
		completion = service.EstimateTokens(resp.Message.Content)
	}
	if completion <= 0 {
		completion = 1024
	}
	return prompt + completion
}

// buildAudit 构造审计日志条目（截断 prompt）
func (h *Handler) buildAudit(auth *service.AuthResult, typ, providerName, modelName string, req model.GatewayRequest, tokenCost int, duration time.Duration, status, errMsg, reqID string) *service.AuditEntry {
	prompt := req.Prompt
	if prompt == "" && len(req.Messages) > 0 {
		prompt = messagesToText(req.Messages)
	}
	return &service.AuditEntry{
		RequestID: reqID,
		UserID:    auth.UserID,
		DeviceID:  auth.DeviceID,
		AuthType:  auth.Type,
		Type:      typ,
		Provider:  providerName,
		Model:     modelName,
		Prompt:    prompt,
		TokenCost: tokenCost,
		Duration:  duration.Seconds(),
		Status:    status,
		Error:     errMsg,
	}
}
