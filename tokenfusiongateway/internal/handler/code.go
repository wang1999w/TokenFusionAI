package handler

import (
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/internal/provider"
	"tokenfusiongateway/internal/service"
	"tokenfusiongateway/pkg/logger"
)

// 代码生成预估输出 Token（厂商未返回 usage 时使用）
const codeDefaultCompletionTokens = 2048

// HandleCode 代码生成处理器
// POST /gateway/v1/code/generations
//
// 处理流程：
//  1. 解析请求、鉴权、风控、预扣
//  2. 调度厂商并调用 provider.Code 同步生成
//  3. 成功结算 / 失败回补
//  4. 返回生成的代码
func (h *Handler) HandleCode(c *gin.Context) {
	ctx := c.Request.Context()
	start := time.Now()
	reqID := h.requestID(c)

	// 1. 解析请求
	var req model.GatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, model.CodeInvalidRequest, "请求参数错误: "+err.Error())
		return
	}
	if req.Model == "" || req.Prompt == "" {
		h.respondError(c, model.CodeInvalidRequest, "model 和 prompt 为必填项")
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
	estPrompt := service.EstimateTokens(req.Prompt)
	estCompletion := req.MaxTokens
	if estCompletion <= 0 {
		estCompletion = codeDefaultCompletionTokens
	}
	estTotal := estPrompt + estCompletion
	freezeReq := &service.FreezeRequest{
		UserID:    auth.UserID,
		DeviceID:  auth.DeviceID,
		Tokens:    estTotal,
		Model:     req.Model,
		Type:      service.AuditTypeCode,
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
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "no available provider")
		h.respondError(c, model.CodeNoProvider, "无可用 AI 厂商")
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeCode, "", req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 6. 构造厂商请求并调用
	codeReq := &provider.CodeRequest{
		Model:     req.Model,
		Prompt:    req.Prompt,
		Language:  req.Language,
		MaxTokens: req.MaxTokens,
	}
	resp, err := p.Code(ctx, codeReq)
	if err != nil {
		// 调用失败：标记不可用、回补、返回错误
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
		h.respondError(c, model.CodeProviderError, "厂商调用失败")
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeCode, p.Name(), req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 7. 结算（代码生成无精确 usage，按生成内容估算）
	totalTokens := service.EstimateTokens(resp.Code)
	if totalTokens < estPrompt {
		totalTokens = estTotal
	}
	settleReq := &service.SettleRequest{
		OrderID:     freeze.OrderID,
		UserID:      auth.UserID,
		TotalTokens: totalTokens,
		Model:       req.Model,
		Provider:    p.Name(),
		RequestID:   reqID,
	}
	if err := h.billing.Settle(ctx, settleReq); err != nil {
		logger.Error("代码结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 8. 返回代码结果
	h.respondSuccess(c, &model.CodeResult{
		ID:    resp.ID,
		Model: resp.Model,
		Code:  resp.Code,
	})

	// 记录审计日志
	h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeCode, p.Name(), req.Model, req, totalTokens, time.Since(start), service.AuditStatusSuccess, "", reqID))
}
