package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/middleware"
	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/internal/provider"
	"tokenfusiongateway/internal/service"
	"tokenfusiongateway/pkg/logger"
)

// ====================================================================================
// OpenAI 兼容层处理器（internal/handler/openai.go）
// ------------------------------------------------------------------------------------
// 提供与 OpenAI 官方 API 100% 对齐的接口，第三方 OpenAI SDK 可直接接入：
//   POST /v1/chat/completions   —— Chat Completions（支持 SSE 流式）
//   POST /v1/images/generations —— Images Generations
//   GET  /v1/models              —— 模型列表
//
// 鉴权：统一使用 Authorization: Bearer sk-tf-xxx（由 APIKeyAuth 中间件完成），
//       鉴权结果写入 gin context，本处理器直接读取，避免重复鉴权。
//
// 错误响应：统一 OpenAI 格式 {error:{message,type,param,code}}。
// 流式响应：SSE 格式 data: {json}\n\n，以 data: [DONE]\n\n 结尾。
// ====================================================================================

// defaultOpenAIModels 默认对外暴露的模型列表
// 这些模型 ID 对齐 OpenAI 官方命名，便于 SDK 直接使用；实际路由由底层 provider 完成
var defaultOpenAIModels = []model.OpenAIModel{
	{ID: "gpt-3.5-turbo", Object: model.OpenAIObjectModel, Created: 1677610602, OwnedBy: "tokenfusion"},
	{ID: "gpt-4", Object: model.OpenAIObjectModel, Created: 1687882411, OwnedBy: "tokenfusion"},
	{ID: "gpt-4o", Object: model.OpenAIObjectModel, Created: 1715367049, OwnedBy: "tokenfusion"},
	{ID: "gpt-4o-mini", Object: model.OpenAIObjectModel, Created: 1721262271, OwnedBy: "tokenfusion"},
	{ID: "dall-e-3", Object: model.OpenAIObjectModel, Created: 1692938000, OwnedBy: "tokenfusion"},
	{ID: "dall-e-2", Object: model.OpenAIObjectModel, Created: 1677610602, OwnedBy: "tokenfusion"},
}

// maxOpenAITokens 流式输出默认预估 Token（请求未指定 max_tokens 时用于预扣）
const maxOpenAITokens = 1024

// ====================================================================================
// Chat Completions
// ====================================================================================

// HandleOpenAIChatCompletions OpenAI Chat Completions 处理器
// POST /v1/chat/completions
//
// 处理流程：
//  1. 解析 OpenAI 格式请求（model, messages, temperature, max_tokens, stream 等）
//  2. 从 context 读取 API Key 鉴权结果
//  3. 风控校验
//  4. 预估 Token 并预扣
//  5. 调度厂商并调用：stream=true 时输出 OpenAI SSE 流，否则同步返回
//  6. 成功结算 / 失败回补
//  7. 记录审计日志
func (h *Handler) HandleOpenAIChatCompletions(c *gin.Context) {
	ctx := c.Request.Context()
	start := time.Now()
	reqID := h.requestID(c)

	// 1. 解析 OpenAI 格式请求
	var req model.OpenAIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondOpenAIError(c, http.StatusBadRequest,
			"Invalid request body: "+err.Error(),
			model.OpenAIErrTypeInvalidRequest, "invalid_request_body")
		return
	}
	// 必填字段校验
	if req.Model == "" || len(req.Messages) == 0 {
		h.respondOpenAIError(c, http.StatusBadRequest,
			"'model' and 'messages' are required.",
			model.OpenAIErrTypeInvalidRequest, "invalid_request")
		return
	}

	// 2. 读取 API Key 鉴权结果（由 APIKeyAuth 中间件写入 context）
	auth, ok := h.authFromContext(c)
	if !ok {
		h.respondOpenAIError(c, http.StatusUnauthorized,
			"Authentication required.",
			model.OpenAIErrTypeAuthentication, model.OpenAIErrCodeMissingAPIKey)
		return
	}

	// 3. 风控校验
	if err := h.risk.Check(ctx, auth, c.ClientIP()); err != nil {
		h.respondOpenAIRiskError(c, err)
		return
	}

	// 4. 预估 Token 并预扣
	provMessages := openAIMessagesToProvider(req.Messages)
	estPrompt := service.EstimateTokens(messagesToText(provMessages))
	estCompletion := req.MaxTokens
	if estCompletion <= 0 {
		estCompletion = maxOpenAITokens
	}
	estTotal := estPrompt + estCompletion

	freeze, err := h.billing.Freeze(ctx, &service.FreezeRequest{
		UserID:    auth.UserID,
		DeviceID:  auth.DeviceID,
		Tokens:    estTotal,
		Model:     req.Model,
		Type:      service.AuditTypeChat,
		RequestID: reqID,
	})
	if err != nil {
		// code 类型为 interface{}，以便在非额度错误时置为 nil（对齐 OpenAI 错误结构）
		var code interface{} = model.OpenAIErrCodeQuotaExceeded
		if !errors.Is(err, service.ErrQuotaExceeded) {
			code = nil
		}
		h.respondOpenAIError(c, http.StatusPaymentRequired,
			"Insufficient quota to complete the request.",
			model.OpenAIErrTypeInvalidRequest, code)
		return
	}

	// 5. 调度厂商
	p, err := h.dispatch.Select(ctx)
	if err != nil {
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "no available provider")
		h.respondOpenAIError(c, http.StatusServiceUnavailable,
			"No available AI provider.",
			model.OpenAIErrTypeAPIError, "no_provider")
		h.auditOpenAI(ctx, auth, service.AuditTypeChat, "", req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID)
		return
	}

	// 构造厂商请求（复用内部 provider.ChatRequest）
	chatReq := &provider.ChatRequest{
		Model:       req.Model,
		Messages:    provMessages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Stream:      req.Stream,
	}

	// 6. 根据是否流式分流处理
	if req.Stream {
		h.openAIChatStream(c, auth, &req, p, chatReq, freeze, reqID, start)
		return
	}
	h.openAIChatSync(c, auth, &req, p, chatReq, freeze, reqID, start)
}

// openAIChatSync 同步对话处理（非流式），返回 OpenAI Chat Completions 响应
func (h *Handler) openAIChatSync(c *gin.Context, auth *service.AuthResult, req *model.OpenAIChatRequest, p provider.Provider, chatReq *provider.ChatRequest, freeze *service.FreezeResult, reqID string, start time.Time) {
	ctx := c.Request.Context()

	// 调用厂商
	resp, err := p.Chat(ctx, chatReq)
	if err != nil {
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
		h.respondOpenAIError(c, http.StatusBadGateway,
			"Upstream provider error.",
			model.OpenAIErrTypeAPIError, "provider_error")
		h.auditOpenAI(ctx, auth, service.AuditTypeChat, p.Name(), req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID)
		return
	}

	// 结算（按实际 Token 用量，缺失时使用预估值）
	totalTokens := resp.Usage.TotalTokens
	if totalTokens == 0 {
		totalTokens = freezeReqTokens(chatReq, resp)
	}
	if err := h.billing.Settle(ctx, &service.SettleRequest{
		OrderID:          freeze.OrderID,
		UserID:           auth.UserID,
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		TotalTokens:      totalTokens,
		Model:            req.Model,
		Provider:         p.Name(),
		RequestID:        reqID,
	}); err != nil {
		logger.Error("OpenAI 接口结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 构造 OpenAI 格式响应
	finishReason := "stop"
	if resp.Message.Content == "" {
		finishReason = "length"
	}
	openAIResp := &model.OpenAIChatResponse{
		ID:      openAICompletionID(resp.ID),
		Object:  model.OpenAIObjectChatCompletion,
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []model.OpenAIChoice{
			{
				Index:        0,
				Message:      model.OpenAIMessage{Role: resp.Message.Role, Content: resp.Message.Content},
				FinishReason: finishReason,
			},
		},
		Usage: model.OpenAIUsage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      totalTokens,
		},
	}

	// 返回 OpenAI 格式（成功响应为裸对象，不包裹）
	c.JSON(http.StatusOK, openAIResp)

	// 记录审计日志
	h.auditOpenAI(ctx, auth, service.AuditTypeChat, p.Name(), req.Model, req, totalTokens, time.Since(start), service.AuditStatusSuccess, "", reqID)
}

// openAIChatStream 流式对话处理（OpenAI SSE 格式）
// 输出格式：data: {chunk}\n\n，最后以 data: [DONE]\n\n 结尾
func (h *Handler) openAIChatStream(c *gin.Context, auth *service.AuthResult, req *model.OpenAIChatRequest, p provider.Provider, chatReq *provider.ChatRequest, freeze *service.FreezeResult, reqID string, start time.Time) {
	ctx := c.Request.Context()

	// 初始化 OpenAI SSE 写入器（设置 text/event-stream 等响应头）
	sseWriter, err := NewOpenAISSEWriter(c.Writer)
	if err != nil {
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "sse init failed")
		h.respondOpenAIError(c, http.StatusInternalServerError,
			"Failed to initialize SSE stream.",
			model.OpenAIErrTypeServerError, "sse_init_failed")
		return
	}

	// 统一的响应 ID，同一流内保持一致
	completionID := openAICompletionID(uuid.New().String())
	created := time.Now().Unix()

	// 发送首片：仅含 role=assistant（对齐 OpenAI 流式首片约定）
	firstChunk := model.OpenAIChatCompletionChunk{
		ID:      completionID,
		Object:  model.OpenAIObjectChatChunk,
		Created: created,
		Model:   req.Model,
		Choices: []model.OpenAIChunkChoice{
			{Index: 0, Delta: model.OpenAIDelta{Role: "assistant"}, FinishReason: nil},
		},
	}
	if werr := sseWriter.WriteChunk(firstChunk); werr != nil {
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "sse write first chunk failed")
		return
	}

	var lastUsage *provider.Usage
	var totalTokens int
	var fullText strings.Builder

	// 判断厂商是否支持流式接口
	if streamProvider, ok := p.(provider.ChatStreamProvider); ok {
		ch, err := streamProvider.ChatStream(ctx, chatReq)
		if err != nil {
			h.dispatch.MarkUnavailable(p.Name(), 0)
			h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "stream start failed: "+err.Error())
			_ = sseWriter.WriteDone()
			h.auditOpenAI(ctx, auth, service.AuditTypeChat, p.Name(), req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID)
			return
		}
		// 消费厂商流式分片，逐片转换为 OpenAI 格式推送
		for chunk := range ch {
			if chunk.Err != nil {
				h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "stream error: "+chunk.Err.Error())
				_ = sseWriter.WriteDone()
				h.auditOpenAI(ctx, auth, service.AuditTypeChat, p.Name(), req.Model, req, totalTokens, time.Since(start), service.AuditStatusFailed, chunk.Err.Error(), reqID)
				return
			}
			// 推送内容增量分片
			if chunk.Delta != "" {
				_ = sseWriter.WriteChunk(model.OpenAIChatCompletionChunk{
					ID:      completionID,
					Object:  model.OpenAIObjectChatChunk,
					Created: created,
					Model:   req.Model,
					Choices: []model.OpenAIChunkChoice{
						{Index: 0, Delta: model.OpenAIDelta{Content: chunk.Delta}, FinishReason: nil},
					},
				})
				fullText.WriteString(chunk.Delta)
			}
			if chunk.Usage != nil {
				lastUsage = chunk.Usage
			}
			if chunk.Done {
				break
			}
		}
	} else {
		// 厂商不支持流式：退化为整体调用后按 rune 分片推送
		resp, err := p.Chat(ctx, chatReq)
		if err != nil {
			h.dispatch.MarkUnavailable(p.Name(), 0)
			h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
			_ = sseWriter.WriteDone()
			h.auditOpenAI(ctx, auth, service.AuditTypeChat, p.Name(), req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID)
			return
		}
		// 按 rune 分片，避免中文截断乱码
		runes := []rune(resp.Message.Content)
		for i := 0; i < len(runes); i += streamChunkSize {
			end := i + streamChunkSize
			if end > len(runes) {
				end = len(runes)
			}
			_ = sseWriter.WriteChunk(model.OpenAIChatCompletionChunk{
				ID:      completionID,
				Object:  model.OpenAIObjectChatChunk,
				Created: created,
				Model:   req.Model,
				Choices: []model.OpenAIChunkChoice{
					{Index: 0, Delta: model.OpenAIDelta{Content: string(runes[i:end])}, FinishReason: nil},
				},
			})
			fullText.WriteString(string(runes[i:end]))
		}
		lastUsage = &resp.Usage
	}

	// 结算
	if lastUsage != nil {
		totalTokens = lastUsage.TotalTokens
	}
	if totalTokens == 0 {
		totalTokens = service.EstimateTokens(fullText.String())
	}
	if err := h.billing.Settle(ctx, &service.SettleRequest{
		OrderID:          freeze.OrderID,
		UserID:           auth.UserID,
		PromptTokens:     openAIUsageOrZero(lastUsage, true),
		CompletionTokens: openAIUsageOrZero(lastUsage, false),
		TotalTokens:      totalTokens,
		Model:            req.Model,
		Provider:         p.Name(),
		RequestID:        reqID,
	}); err != nil {
		logger.Error("OpenAI 流式结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 发送结束分片：finish_reason=stop
	stop := "stop"
	_ = sseWriter.WriteChunk(model.OpenAIChatCompletionChunk{
		ID:      completionID,
		Object:  model.OpenAIObjectChatChunk,
		Created: created,
		Model:   req.Model,
		Choices: []model.OpenAIChunkChoice{
			{Index: 0, Delta: model.OpenAIDelta{}, FinishReason: &stop},
		},
	})

	// 发送结束标记：data: [DONE]
	_ = sseWriter.WriteDone()

	// 审计日志
	h.auditOpenAI(ctx, auth, service.AuditTypeChat, p.Name(), req.Model, req, totalTokens, time.Since(start), service.AuditStatusSuccess, "", reqID)
}

// ====================================================================================
// Images Generations
// ====================================================================================

// HandleOpenAIImageGenerations OpenAI 图片生成处理器
// POST /v1/images/generations
func (h *Handler) HandleOpenAIImageGenerations(c *gin.Context) {
	ctx := c.Request.Context()
	start := time.Now()
	reqID := h.requestID(c)

	// 1. 解析 OpenAI 图片请求
	var req model.OpenAIImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondOpenAIError(c, http.StatusBadRequest,
			"Invalid request body: "+err.Error(),
			model.OpenAIErrTypeInvalidRequest, "invalid_request_body")
		return
	}
	if req.Prompt == "" {
		h.respondOpenAIError(c, http.StatusBadRequest,
			"'prompt' is required.",
			model.OpenAIErrTypeInvalidRequest, "invalid_request")
		return
	}
	if req.N <= 0 {
		req.N = 1
	}

	// 2. 读取鉴权结果
	auth, ok := h.authFromContext(c)
	if !ok {
		h.respondOpenAIError(c, http.StatusUnauthorized,
			"Authentication required.",
			model.OpenAIErrTypeAuthentication, model.OpenAIErrCodeMissingAPIKey)
		return
	}

	// 3. 风控校验
	if err := h.risk.Check(ctx, auth, c.ClientIP()); err != nil {
		h.respondOpenAIRiskError(c, err)
		return
	}

	// 4. 预扣（图片按张数预估）
	estTokens := service.EstimateTokens(req.Prompt) + req.N*imageTokensPerItem
	freeze, err := h.billing.Freeze(ctx, &service.FreezeRequest{
		UserID:    auth.UserID,
		DeviceID:  auth.DeviceID,
		Tokens:    estTokens,
		Model:     req.Model,
		Type:      service.AuditTypeImage,
		RequestID: reqID,
	})
	if err != nil {
		h.respondOpenAIError(c, http.StatusPaymentRequired,
			"Insufficient quota to complete the request.",
			model.OpenAIErrTypeInvalidRequest, model.OpenAIErrCodeQuotaExceeded)
		return
	}

	// 5. 调度厂商
	p, err := h.dispatch.Select(ctx)
	if err != nil {
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "no available provider")
		h.respondOpenAIError(c, http.StatusServiceUnavailable,
			"No available AI provider.",
			model.OpenAIErrTypeAPIError, "no_provider")
		return
	}

	// 构造厂商图片请求
	imageReq := &provider.ImageRequest{
		Model:          req.Model,
		Prompt:         req.Prompt,
		N:              req.N,
		Size:           req.Size,
		Quality:        req.Quality,
		ResponseFormat: req.ResponseFormat,
	}

	// 6. 调用厂商
	resp, err := p.Image(ctx, imageReq)
	if err != nil {
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
		h.respondOpenAIError(c, http.StatusBadGateway,
			"Upstream provider error.",
			model.OpenAIErrTypeAPIError, "provider_error")
		return
	}

	// 7. 结算
	if err := h.billing.Settle(ctx, &service.SettleRequest{
		OrderID:     freeze.OrderID,
		UserID:      auth.UserID,
		TotalTokens: estTokens,
		Model:       req.Model,
		Provider:    p.Name(),
		RequestID:   reqID,
	}); err != nil {
		logger.Error("OpenAI 图片结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 8. 构造 OpenAI 图片响应
	images := make([]model.OpenAIImage, 0, len(resp.Data))
	for _, img := range resp.Data {
		images = append(images, model.OpenAIImage{
			URL:           img.URL,
			B64JSON:       img.B64JSON,
			RevisedPrompt: img.RevisedPrompt,
		})
	}
	c.JSON(http.StatusOK, &model.OpenAIImageResponse{
		Created: resp.Created,
		Data:    images,
	})

	// 审计日志
	h.auditOpenAI(ctx, auth, service.AuditTypeImage, p.Name(), req.Model, req, estTokens, time.Since(start), service.AuditStatusSuccess, "", reqID)
}

// ====================================================================================
// Models
// ====================================================================================

// HandleOpenAIModels 返回模型列表
// GET /v1/models
// 鉴权：仍需 API Key（由路由组中间件统一处理）
func (h *Handler) HandleOpenAIModels(c *gin.Context) {
	// 合并默认模型与已注册厂商名称（厂商名称作为可调用模型暴露）
	data := make([]model.OpenAIModel, 0, len(defaultOpenAIModels))
	data = append(data, defaultOpenAIModels...)

	// 将已注册的底层厂商名称补充为可用模型，便于调试与发现
	for _, name := range h.dispatchStatus() {
		data = append(data, model.OpenAIModel{
			ID:      name,
			Object:  model.OpenAIObjectModel,
			Created: time.Now().Unix(),
			OwnedBy: "tokenfusion",
		})
	}

	c.JSON(http.StatusOK, &model.OpenAIModelList{
		Object: model.OpenAIObjectList,
		Data:   data,
	})
}

// dispatchStatus 返回已注册厂商名称（用于 /v1/models 补充可发现模型）
// 通过 DispatchService 暴露的状态快照聚合
func (h *Handler) dispatchStatus() []string {
	statuses := h.dispatch.Status()
	names := make([]string, 0, len(statuses))
	for _, s := range statuses {
		names = append(names, s.Name)
	}
	return names
}

// ====================================================================================
// 辅助方法
// ====================================================================================

// authFromContext 从 gin context 读取鉴权结果（由 APIKeyAuth 中间件写入）
func (h *Handler) authFromContext(c *gin.Context) (*service.AuthResult, bool) {
	if v, ok := c.Get(middleware.ContextKeyAuthResult); ok {
		if auth, ok := v.(*service.AuthResult); ok {
			return auth, true
		}
	}
	return nil, false
}

// respondOpenAIError 返回 OpenAI 兼容错误响应
func (h *Handler) respondOpenAIError(c *gin.Context, status int, message, errType string, code interface{}) {
	c.AbortWithStatusJSON(status, model.NewOpenAIError(message, errType, code))
}

// respondOpenAIRiskError 将风控错误转换为 OpenAI 兼容错误响应
func (h *Handler) respondOpenAIRiskError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrForbidden):
		h.respondOpenAIError(c, http.StatusForbidden,
			"Access denied.",
			model.OpenAIErrTypeInvalidRequest, "forbidden")
	case errors.Is(err, service.ErrQuotaExceeded):
		h.respondOpenAIError(c, http.StatusPaymentRequired,
			"Insufficient quota.",
			model.OpenAIErrTypeInvalidRequest, model.OpenAIErrCodeQuotaExceeded)
	case errors.Is(err, service.ErrRateLimited):
		h.respondOpenAIError(c, http.StatusTooManyRequests,
			"Rate limit exceeded.",
			model.OpenAIErrTypeRateLimit, model.OpenAIErrCodeRateLimitExceeded)
	default:
		h.respondOpenAIError(c, http.StatusInternalServerError,
			"Internal error.",
			model.OpenAIErrTypeServerError, nil)
	}
}

// auditOpenAI 构造并记录 OpenAI 接口的审计日志
// 泛型入参 req 用于提取 prompt（支持 chat 与 image 两种请求体）
func (h *Handler) auditOpenAI(ctx context.Context, auth *service.AuthResult, typ, providerName, modelName string, req interface{}, tokenCost int, duration time.Duration, status, errMsg, reqID string) {
	prompt := openAIRequestPrompt(req)
	h.audit.Log(ctx, &service.AuditEntry{
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
	})
}

// openAIRequestPrompt 从 OpenAI 请求体中提取 prompt 文本（用于审计）
// 同时兼容值与指针两种传参方式，避免调用点类型不一致导致 prompt 丢失
func openAIRequestPrompt(req interface{}) string {
	switch r := req.(type) {
	case *model.OpenAIChatRequest:
		return joinOpenAIMessages(r.Messages)
	case model.OpenAIChatRequest:
		return joinOpenAIMessages(r.Messages)
	case *model.OpenAIImageRequest:
		return r.Prompt
	case model.OpenAIImageRequest:
		return r.Prompt
	default:
		return ""
	}
}

// joinOpenAIMessages 将 OpenAI 消息列表拼接为纯文本，用于审计 prompt 记录
func joinOpenAIMessages(msgs []model.OpenAIMessage) string {
	if len(msgs) == 0 {
		return ""
	}
	parts := make([]string, 0, len(msgs))
	for _, m := range msgs {
		parts = append(parts, m.Content)
	}
	return strings.Join(parts, "\n")
}

// openAIMessagesToProvider 将 OpenAI 消息列表转换为内部 provider.Message
func openAIMessagesToProvider(msgs []model.OpenAIMessage) []provider.Message {
	result := make([]provider.Message, 0, len(msgs))
	for _, m := range msgs {
		result = append(result, provider.Message{Role: m.Role, Content: m.Content})
	}
	return result
}

// openAICompletionID 生成 OpenAI 风格的响应 ID（chatcmpl-<uuid>）
// 若入参已有值则直接复用（厂商返回的 ID）
func openAICompletionID(id string) string {
	if id != "" {
		return id
	}
	return "chatcmpl-" + strings.ReplaceAll(uuid.New().String(), "-", "")
}

// openAIUsageOrZero 安全读取流式 usage，缺失时返回 0
// prompt 为 true 时返回 PromptTokens，false 时返回 CompletionTokens
func openAIUsageOrZero(u *provider.Usage, prompt bool) int {
	if u == nil {
		return 0
	}
	if prompt {
		return u.PromptTokens
	}
	return u.CompletionTokens
}

// ====================================================================================
// OpenAI SSE 写入器
// ------------------------------------------------------------------------------------
// OpenAI 流式格式与网关内部 SSE 不同：
//   - 不使用 event: 行，仅使用 data: 行
//   - 每条事件为 "data: {json}\n\n"
//   - 流结束标记为 "data: [DONE]\n\n"
// 因此单独实现，不复用 pkg/sse.SSEWriter（其会写入 event: 行）。
// ====================================================================================

// OpenAISSEWriter OpenAI 格式 SSE 写入器
type OpenAISSEWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

// NewOpenAISSEWriter 创建 OpenAI SSE 写入器并写入响应头
func NewOpenAISSEWriter(w http.ResponseWriter) (*OpenAISSEWriter, error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf("response writer does not support flushing")
	}
	// 设置 SSE 必需响应头，禁用缓冲保证实时推送
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	return &OpenAISSEWriter{w: w, flusher: flusher}, nil
}

// WriteChunk 写入一个流式分片（data: {json}\n\n）
func (s *OpenAISSEWriter) WriteChunk(chunk model.OpenAIChatCompletionChunk) error {
	payload, err := json.Marshal(chunk)
	if err != nil {
		return err
	}
	// OpenAI 流式格式：data: {json}\n\n
	if _, err := fmt.Fprintf(s.w, "data: %s\n\n", payload); err != nil {
		return err
	}
	s.flusher.Flush()
	return nil
}

// WriteDone 写入流结束标记（data: [DONE]\n\n）
func (s *OpenAISSEWriter) WriteDone() error {
	if _, err := fmt.Fprintf(s.w, "data: [DONE]\n\n"); err != nil {
		return err
	}
	s.flusher.Flush()
	return nil
}
