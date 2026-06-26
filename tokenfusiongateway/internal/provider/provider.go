package provider

import (
	"context"
	"time"
)

// Message 统一对话消息结构体，所有 AI 厂商共用
type Message struct {
	Role    string `json:"role"`    // 角色：system/user/assistant
	Content string `json:"content"` // 消息内容
}

// Usage 报告 Token 消耗情况
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`      // 输入 Token 数
	CompletionTokens int `json:"completion_tokens"`   // 输出 Token 数
	TotalTokens      int `json:"total_tokens"`        // 总 Token 数
}

// ChatRequest 对话补全请求体
type ChatRequest struct {
	Model       string    `json:"model"`                  // 模型名称
	Messages    []Message `json:"messages"`               // 对话消息列表
	Temperature float64   `json:"temperature,omitempty"`  // 温度参数，控制随机性
	MaxTokens   int       `json:"max_tokens,omitempty"`   // 最大生成 Token 数
	Stream      bool      `json:"stream,omitempty"`       // 是否流式输出（SSE）
}

// ChatResponse 对话补全响应体
type ChatResponse struct {
	ID      string  `json:"id"`              // 响应唯一ID
	Model   string  `json:"model"`           // 实际使用的模型
	Message Message `json:"message"`         // AI 回复消息
	Usage   Usage   `json:"usage"`           // Token 消耗统计
}

// ImageRequest 图片生成请求体
type ImageRequest struct {
	Model          string `json:"model"`                      // 模型名称
	Prompt         string `json:"prompt"`                    // 提示词
	N              int    `json:"n,omitempty"`                // 生成数量
	Size           string `json:"size,omitempty"`             // 图片尺寸
	Quality        string `json:"quality,omitempty"`          // 图片质量
	ResponseFormat string `json:"response_format,omitempty"` // 返回格式：url/b64_json
}

// ImageData 单张生成图片数据
type ImageData struct {
	URL           string `json:"url,omitempty"`            // 图片 URL
	B64JSON       string `json:"b64_json,omitempty"`       // Base64 编码图片
	RevisedPrompt string `json:"revised_prompt,omitempty"` // 修正后的提示词
}

// ImageResponse 图片生成响应体
type ImageResponse struct {
	Created int64       `json:"created"` // 生成时间戳
	Data    []ImageData `json:"data"`    // 图片数据列表
}

// VideoRequest 视频生成请求体
type VideoRequest struct {
	Model      string  `json:"model"`                 // 模型名称
	Prompt     string  `json:"prompt"`                // 提示词
	Duration   float64 `json:"duration,omitempty"`    // 视频时长（秒）
	Resolution string  `json:"resolution,omitempty"`  // 分辨率
}

// VideoTaskResponse 视频生成任务响应体（异步任务）
type VideoTaskResponse struct {
	TaskID    string    `json:"task_id"`              // 任务唯一ID
	Status    string    `json:"status"`               // 任务状态：pending/processing/success/failed
	VideoURL  string    `json:"video_url,omitempty"`  // 生成完成后的视频 URL
	CreatedAt time.Time `json:"created_at"`           // 任务创建时间
}

// CodeRequest 代码生成请求体
type CodeRequest struct {
	Model     string `json:"model"`                // 模型名称
	Prompt    string `json:"prompt"`                // 需求描述
	Language  string `json:"language,omitempty"`    // 编程语言
	MaxTokens int    `json:"max_tokens,omitempty"`  // 最大生成 Token 数
}

// CodeResponse 代码生成响应体
type CodeResponse struct {
	ID    string `json:"id"`    // 响应唯一ID
	Model string `json:"model"` // 实际使用的模型
	Code  string `json:"code"`  // 生成的代码
}

// Provider 定义底层 AI 厂商的统一接口
// 新增厂商只需实现此接口并注册到 Registry，无需修改核心调度逻辑
type Provider interface {
	Name() string  // 返回厂商名称
	Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error)       // 对话生成
	Image(ctx context.Context, req *ImageRequest) (*ImageResponse, error)    // 图片生成
	Video(ctx context.Context, req *VideoRequest) (*VideoTaskResponse, error) // 视频生成（异步）
	Code(ctx context.Context, req *CodeRequest) (*CodeResponse, error)       // 代码生成
}
