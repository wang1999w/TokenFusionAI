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

// 图片生成单张预估 Token（用于预扣，实际以结算为准）
const imageTokensPerItem = 1000

// HandleImage 图片生成处理器
// POST /gateway/v1/images/generations
//
// 处理流程与对话一致，区别在于：
//   - 同步处理，返回图片 URL 列表
//   - Token 预估基于 prompt + 生成数量
func (h *Handler) HandleImage(c *gin.Context) {
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
	// 生成数量默认 1
	if req.N <= 0 {
		req.N = 1
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

	// 4. 预估 Token 并预扣（prompt + 每张图片固定成本）
	estTokens := service.EstimateTokens(req.Prompt) + req.N*imageTokensPerItem
	freezeReq := &service.FreezeRequest{
		UserID:    auth.UserID,
		DeviceID:  auth.DeviceID,
		Tokens:    estTokens,
		Model:     req.Model,
		Type:      service.AuditTypeImage,
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
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeImage, "", req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 构造厂商请求
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
		// 调用失败：标记不可用、回补、返回错误
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
		h.respondError(c, model.CodeProviderError, "厂商调用失败")
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeImage, p.Name(), req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 7. 结算（图片生成无精确 Token 用量，使用预估值）
	totalTokens := estTokens
	settleReq := &service.SettleRequest{
		OrderID:     freeze.OrderID,
		UserID:      auth.UserID,
		TotalTokens: totalTokens,
		Model:       req.Model,
		Provider:    p.Name(),
		RequestID:   reqID,
	}
	if err := h.billing.Settle(ctx, settleReq); err != nil {
		logger.Error("图片结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 8. 返回图片结果
	h.respondSuccess(c, &model.ImageResult{
		Created: resp.Created,
		Data:    resp.Data,
	})

	// 记录审计日志
	h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeImage, p.Name(), req.Model, req, totalTokens, time.Since(start), service.AuditStatusSuccess, "", reqID))
}
