package handler

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	goredis "github.com/redis/go-redis/v9"

	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/internal/provider"
	"tokenfusiongateway/internal/service"
	"tokenfusiongateway/pkg/logger"
)

// 视频生成预估 Token（基于 prompt + 时长，实际以结算为准）
const (
	videoBaseTokens     = 5000  // 视频生成基础成本
	videoTokensPerSecond = 500  // 每秒视频附加成本
	videoTaskTTL         = 2 * time.Hour // 视频任务在 Redis 中的存活时间
)

// Redis 键前缀
const videoTaskKeyPrefix = "video:task:"

// videoTask 视频任务的持久化结构（存于 Redis）
type videoTask struct {
	TaskID    string    `json:"task_id"`             // 网关生成的任务唯一ID
	ProviderTaskID string `json:"provider_task_id,omitempty"` // 厂商返回的任务ID
	Status    string    `json:"status"`              // 任务状态：pending/processing/success/failed
	VideoURL  string    `json:"video_url,omitempty"` // 生成完成后的视频 URL
	Provider  string    `json:"provider"`            // 调用的厂商
	Model     string    `json:"model"`               // 调用的模型
	UserID    string    `json:"user_id"`             // 用户ID
	DeviceID  string    `json:"device_id,omitempty"` // 设备ID
	OrderID   string    `json:"order_id,omitempty"`  // 计费订单ID
	CreatedAt time.Time `json:"created_at"`          // 任务创建时间
}

// HandleVideo 视频生成处理器（异步）
// POST /gateway/v1/videos/generations
//
// 处理流程：
//  1. 解析请求、鉴权、风控、预扣
//  2. 调度厂商并调用 provider.Video 发起异步任务
//  3. 生成网关任务ID，将任务状态持久化到 Redis
//  4. 立即返回 task_id，客户端通过 GET 接口轮询任务状态
//
// 注意：视频生成为异步任务，预扣的 Token 在任务发起时按预估值结算；
// 实际精确结算需在厂商回调任务完成时进行（Phase 6 通过回调完善）
func (h *Handler) HandleVideo(c *gin.Context) {
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
	estTokens := service.EstimateTokens(req.Prompt) + videoBaseTokens + int(req.Duration)*videoTokensPerSecond
	freezeReq := &service.FreezeRequest{
		UserID:    auth.UserID,
		DeviceID:  auth.DeviceID,
		Tokens:    estTokens,
		Model:     req.Model,
		Type:      service.AuditTypeVideo,
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
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeVideo, "", req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 6. 构造厂商请求并调用
	videoReq := &provider.VideoRequest{
		Model:      req.Model,
		Prompt:     req.Prompt,
		Duration:   req.Duration,
		Resolution: req.Resolution,
	}
	resp, err := p.Video(ctx, videoReq)
	if err != nil {
		// 发起任务失败：标记不可用、回补、返回错误
		h.dispatch.MarkUnavailable(p.Name(), 0)
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "provider error: "+err.Error())
		h.respondError(c, model.CodeProviderError, "厂商调用失败")
		h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeVideo, p.Name(), req.Model, req, 0, time.Since(start), service.AuditStatusFailed, err.Error(), reqID))
		return
	}

	// 7. 生成网关任务ID并持久化到 Redis
	gatewayTaskID := uuid.New().String()
	// 状态规范化：厂商返回的状态直接采用，为空时按是否有视频URL判定
	status := resp.Status
	if status == "" {
		if resp.VideoURL != "" {
			status = "success"
		} else {
			status = "processing"
		}
	}
	task := &videoTask{
		TaskID:          gatewayTaskID,
		ProviderTaskID:  resp.TaskID,
		Status:          status,
		VideoURL:        resp.VideoURL,
		Provider:        p.Name(),
		Model:           req.Model,
		UserID:          auth.UserID,
		DeviceID:        auth.DeviceID,
		OrderID:         freeze.OrderID,
		CreatedAt:       resp.CreatedAt,
	}
	if task.CreatedAt.IsZero() {
		task.CreatedAt = time.Now()
	}
	if err := h.saveVideoTask(ctx, task); err != nil {
		// 持久化失败：回补并返回内部错误
		logger.Error("视频任务持久化失败", zap.String("task_id", gatewayTaskID), zap.Error(err))
		h.rollback(ctx, freeze.OrderID, auth.UserID, reqID, "persist task failed")
		h.respondError(c, model.CodeInternalError, "任务持久化失败")
		return
	}

	// 8. 按预估值结算（异步任务，精确结算待厂商回调）
	settleReq := &service.SettleRequest{
		OrderID:     freeze.OrderID,
		UserID:      auth.UserID,
		TotalTokens: estTokens,
		Model:       req.Model,
		Provider:    p.Name(),
		RequestID:   reqID,
	}
	if err := h.billing.Settle(ctx, settleReq); err != nil {
		logger.Error("视频结算失败", zap.String("order_id", freeze.OrderID), zap.Error(err))
	}

	// 9. 返回任务ID
	h.respondSuccess(c, &model.VideoTaskResult{
		TaskID:    gatewayTaskID,
		Status:    status,
		VideoURL:  resp.VideoURL,
		CreatedAt: task.CreatedAt,
	})

	// 记录审计日志
	h.audit.Log(ctx, h.buildAudit(auth, service.AuditTypeVideo, p.Name(), req.Model, req, estTokens, time.Since(start), service.AuditStatusSuccess, "", reqID))
}

// HandleVideoTask 查询视频任务状态
// GET /gateway/v1/videos/tasks/:id
func (h *Handler) HandleVideoTask(c *gin.Context) {
	ctx := c.Request.Context()
	taskID := c.Param("id")
	if taskID == "" {
		h.respondError(c, model.CodeInvalidRequest, "任务ID不能为空")
		return
	}

	// 从 Redis 读取任务
	task, err := h.loadVideoTask(ctx, taskID)
	if err != nil {
		h.respondError(c, model.CodeInvalidRequest, "任务不存在或已过期")
		return
	}

	// 返回任务状态
	h.respondSuccess(c, &model.VideoTaskResult{
		TaskID:    task.TaskID,
		Status:    task.Status,
		VideoURL:  task.VideoURL,
		CreatedAt: task.CreatedAt,
	})
}

// saveVideoTask 将视频任务持久化到 Redis（带过期时间）
func (h *Handler) saveVideoTask(ctx context.Context, task *videoTask) error {
	payload, err := json.Marshal(task)
	if err != nil {
		return err
	}
	key := videoTaskKeyPrefix + task.TaskID
	return h.redis.GetClient().Set(ctx, key, payload, videoTaskTTL).Err()
}

// loadVideoTask 从 Redis 读取视频任务
func (h *Handler) loadVideoTask(ctx context.Context, taskID string) (*videoTask, error) {
	key := videoTaskKeyPrefix + taskID
	payload, err := h.redis.GetClient().Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}
	var task videoTask
	if err := json.Unmarshal(payload, &task); err != nil {
		return nil, err
	}
	return &task, nil
}
