package model

import (
	"time"

	"tokenfusiongateway/internal/provider"
)

// 业务状态码约定
const (
	CodeSuccess        = 0      // 成功
	CodeInvalidRequest = 40001  // 请求参数错误
	CodeUnauthorized   = 40101  // 未授权（鉴权失败）
	CodeForbidden      = 40301  // 禁止访问（风控拦截）
	CodeQuotaExceeded  = 40302  // 额度不足
	CodeRateLimited    = 42901  // 触发频率限制
	CodeNoProvider     = 50301  // 无可用厂商
	CodeProviderError  = 50302  // 厂商调用失败
	CodeInternalError  = 50000  // 内部错误
)

// GatewayResponse 网关统一响应格式
// 所有接口均返回此结构：{code, message, data}
// code 为 0 表示成功，非 0 表示失败；失败时 data 为 null
type GatewayResponse struct {
	Code    int         `json:"code"`    // 业务状态码：0 成功，非 0 失败
	Message string      `json:"message"` // 提示信息
	Data    interface{} `json:"data"`    // 业务数据，失败时为 null
}

// GatewayRequest 网关通用请求体
// 对话/图片/视频/代码等各类型请求统一使用此结构，未使用字段留空
type GatewayRequest struct {
	Model          string             `json:"model"`                     // 模型名称
	Messages       []provider.Message `json:"messages,omitempty"`        // 对话消息列表（chat 类型使用）
	Prompt         string             `json:"prompt,omitempty"`          // 提示词（image/video/code 类型使用）
	Stream         bool               `json:"stream,omitempty"`          // 是否流式输出（仅 chat 支持 SSE）
	Temperature    float64            `json:"temperature,omitempty"`     // 温度参数，控制随机性
	MaxTokens      int                `json:"max_tokens,omitempty"`      // 最大生成 Token 数
	N              int                `json:"n,omitempty"`               // 生成数量（image）
	Size           string             `json:"size,omitempty"`            // 图片尺寸（image）
	Quality        string             `json:"quality,omitempty"`         // 图片质量（image）
	ResponseFormat string             `json:"response_format,omitempty"` // 返回格式：url/b64_json（image）
	Duration       float64            `json:"duration,omitempty"`         // 视频时长（秒，video）
	Resolution     string             `json:"resolution,omitempty"`      // 视频分辨率（video）
	Language       string             `json:"language,omitempty"`        // 编程语言（code）
}

// ChatResult 对话生成结果（放入 GatewayResponse.Data 字段）
type ChatResult struct {
	ID      string           `json:"id"`      // 响应唯一ID
	Model   string           `json:"model"`   // 实际使用的模型
	Message provider.Message `json:"message"` // AI 回复消息
	Usage   provider.Usage   `json:"usage"`   // Token 消耗统计
}

// ImageResult 图片生成结果（放入 GatewayResponse.Data 字段）
type ImageResult struct {
	Created int64                `json:"created"` // 生成时间戳
	Data    []provider.ImageData `json:"data"`    // 图片数据列表
}

// VideoTaskResult 视频生成任务结果（放入 GatewayResponse.Data 字段）
type VideoTaskResult struct {
	TaskID    string    `json:"task_id"`              // 任务唯一ID
	Status    string    `json:"status"`               // 任务状态：pending/processing/success/failed
	VideoURL  string    `json:"video_url,omitempty"`  // 生成完成后的视频 URL
	CreatedAt time.Time `json:"created_at"`           // 任务创建时间
}

// CodeResult 代码生成结果（放入 GatewayResponse.Data 字段）
type CodeResult struct {
	ID    string `json:"id"`    // 响应唯一ID
	Model string `json:"model"` // 实际使用的模型
	Code  string `json:"code"`  // 生成的代码
}

// SSEEvent SSE 流式事件结构（用于透传底层 SSE 数据）
type SSEEvent struct {
	Event string `json:"event,omitempty"` // 事件类型：data/done/error
	Data  string `json:"data"`           // 事件数据
}

// Success 构造成功响应，data 为业务数据
func Success(data interface{}) *GatewayResponse {
	return &GatewayResponse{
		Code:    CodeSuccess,
		Message: "success",
		Data:    data,
	}
}

// Fail 构造失败响应，data 固定为 null
func Fail(code int, msg string) *GatewayResponse {
	return &GatewayResponse{
		Code:    code,
		Message: msg,
		Data:    nil,
	}
}
