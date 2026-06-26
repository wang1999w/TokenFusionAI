package model

import "time"

// ====================================================================================
// OpenAI 兼容层数据模型（internal/model/openai.go）
// ------------------------------------------------------------------------------------
// 本文件定义与 OpenAI 官方 API 100% 对齐的请求/响应结构体。
// 所有字段命名、JSON tag、嵌套层级均严格按照 OpenAI 官方文档定义，
// 以便第三方 OpenAI SDK / 客户端可直接接入网关而无需改动代码。
//
// 涵盖接口：
//   1. POST /v1/chat/completions   —— Chat Completions（含 SSE 流式）
//   2. POST /v1/images/generations —— Images Generations
//   3. GET  /v1/models             —— 模型列表
//
// 错误响应统一采用 {error: {message, type, param, code}} 结构。
// ====================================================================================

// ------------------------------------------------------------------------------------
// 一、Chat Completions
// ------------------------------------------------------------------------------------

// OpenAIMessage OpenAI 对话消息结构
// 与内部 provider.Message 对应，但增加 name 字段以对齐官方 schema
type OpenAIMessage struct {
	Role    string `json:"role"`             // 角色：system / user / assistant / tool
	Content string `json:"content"`          // 消息文本内容
	Name    string `json:"name,omitempty"`   // 参与者名称（可选，多角色区分时使用）
}

// OpenAIChatRequest OpenAI Chat Completions 请求体
// 严格对齐 https://platform.openai.com/docs/api-reference/chat/create
type OpenAIChatRequest struct {
	Model            string          `json:"model"`                       // 模型名称（必填）
	Messages         []OpenAIMessage `json:"messages"`                    // 对话消息列表（必填）
	Temperature      float64         `json:"temperature,omitempty"`      // 采样温度，0~2，默认 1
	TopP             float64         `json:"top_p,omitempty"`             // 核采样概率，默认 1
	N                int             `json:"n,omitempty"`                 // 生成候选数，默认 1
	MaxTokens        int             `json:"max_tokens,omitempty"`        // 最大生成 Token 数
	Stream           bool            `json:"stream,omitempty"`            // 是否流式输出（SSE），默认 false
	Stop             interface{}     `json:"stop,omitempty"`              // 停止词，可为字符串或字符串数组
	PresencePenalty  float64         `json:"presence_penalty,omitempty"`  // 存在惩罚，-2~2
	FrequencyPenalty float64         `json:"frequency_penalty,omitempty"` // 频率惩罚，-2~2
	User             string          `json:"user,omitempty"`             // 终端用户标识，用于风控/审计
}

// OpenAIChatResponse OpenAI Chat Completions 非流式响应体
// 严格对齐官方响应：object 固定为 "chat.completion"
type OpenAIChatResponse struct {
	ID      string         `json:"id"`       // 响应唯一 ID，格式 chatcmpl-{rand}
	Object  string         `json:"object"`   // 固定值 "chat.completion"
	Created int64          `json:"created"`  // 创建时间戳（Unix 秒）
	Model   string         `json:"model"`    // 实际使用的模型
	Choices []OpenAIChoice `json:"choices"`  // 候选结果列表
	Usage   OpenAIUsage    `json:"usage"`    // Token 用量统计
}

// OpenAIChoice 单个候选结果（非流式）
type OpenAIChoice struct {
	Index        int          `json:"index"`          // 候选索引，从 0 开始
	Message      OpenAIMessage `json:"message"`        // 完整的回复消息
	FinishReason string       `json:"finish_reason"`   // 结束原因：stop / length / content_filter / tool_calls
}

// OpenAIUsage Token 用量统计
type OpenAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`      // 输入 Token 数
	CompletionTokens int `json:"completion_tokens"`   // 输出 Token 数
	TotalTokens      int `json:"total_tokens"`        // 总 Token 数
}

// ------------------------------------------------------------------------------------
// 二、Chat Completions 流式（SSE）
// ------------------------------------------------------------------------------------

// OpenAIChatCompletionChunk 单个 SSE 流式分片
// object 固定为 "chat.completion.chunk"
type OpenAIChatCompletionChunk struct {
	ID      string              `json:"id"`       // 响应唯一 ID，同一流内保持一致
	Object  string              `json:"object"`   // 固定值 "chat.completion.chunk"
	Created int64               `json:"created"`  // 创建时间戳（Unix 秒）
	Model   string              `json:"model"`    // 模型名称
	Choices []OpenAIChunkChoice `json:"choices"`  // 流式候选分片列表
}

// OpenAIChunkChoice 流式候选分片
// 与非流式 OpenAIChoice 的区别：使用 delta（增量）替代 message
type OpenAIChunkChoice struct {
	Index        int          `json:"index"`           // 候选索引
	Delta        OpenAIDelta  `json:"delta"`           // 增量内容
	FinishReason *string      `json:"finish_reason"`   // 结束原因，未结束时为 null（用指针表达 null）
}

// OpenAIDelta 流式增量内容
// 首片通常仅含 role=assistant，后续片含 content 增量
type OpenAIDelta struct {
	Role    string `json:"role,omitempty"`    // 角色（仅首片携带）
	Content string `json:"content,omitempty"` // 增量文本内容
}

// ------------------------------------------------------------------------------------
// 三、Images Generations
// ------------------------------------------------------------------------------------

// OpenAIImageRequest OpenAI 图片生成请求体
// 严格对齐 https://platform.openai.com/docs/api-reference/images/create
type OpenAIImageRequest struct {
	Model          string `json:"model,omitempty"`            // 模型名称（如 dall-e-3）
	Prompt         string `json:"prompt"`                    // 提示词（必填）
	N              int    `json:"n,omitempty"`               // 生成数量，1~10，默认 1
	Size           string `json:"size,omitempty"`            // 尺寸：256x512/512x512/1024x1024...
	Quality        string `json:"quality,omitempty"`         // 质量：standard / hd
	ResponseFormat string `json:"response_format,omitempty"` // 返回格式：url / b64_json
	Style          string `json:"style,omitempty"`           // 风格：vivid / natural
	User           string `json:"user,omitempty"`            // 终端用户标识
}

// OpenAIImageResponse OpenAI 图片生成响应体
type OpenAIImageResponse struct {
	Created int64         `json:"created"` // 创建时间戳（Unix 秒）
	Data    []OpenAIImage `json:"data"`    // 图片数据列表
}

// OpenAIImage 单张图片数据
// URL 与 B64JSON 二选一：response_format=url 时返回 url，b64_json 时返回 b64_json
type OpenAIImage struct {
	URL           string `json:"url,omitempty"`            // 图片 URL
	B64JSON       string `json:"b64_json,omitempty"`       // Base64 编码图片
	RevisedPrompt string `json:"revised_prompt,omitempty"` // 厂商修正后的提示词
}

// ------------------------------------------------------------------------------------
// 四、Models 列表
// ------------------------------------------------------------------------------------

// OpenAIModel 单个模型信息
type OpenAIModel struct {
	ID      string `json:"id"`        // 模型 ID
	Object  string `json:"object"`    // 固定值 "model"
	Created int64  `json:"created"`   // 创建时间戳（Unix 秒）
	OwnedBy string `json:"owned_by"` // 归属方
}

// OpenAIModelList 模型列表响应体
type OpenAIModelList struct {
	Object string        `json:"object"` // 固定值 "list"
	Data   []OpenAIModel `json:"data"`   // 模型列表
}

// ------------------------------------------------------------------------------------
// 五、错误响应
// ------------------------------------------------------------------------------------

// OpenAIErrorResponse OpenAI 兼容错误响应体
// 严格对齐官方格式：{"error": {"message", "type", "param", "code"}}
type OpenAIErrorResponse struct {
	Error OpenAIError `json:"error"` // 错误对象
}

// OpenAIError 错误详情
type OpenAIError struct {
	Message string      `json:"message"`          // 错误描述
	Type    string      `json:"type"`              // 错误类型：invalid_request_error / authentication_error / rate_limit_error / server_error / api_error
	Param   interface{} `json:"param"`            // 出错的参数名，无则为 null
	Code    interface{} `json:"code"`              // 错误码（字符串或 null）
}

// ------------------------------------------------------------------------------------
// 六、构造辅助函数
// ------------------------------------------------------------------------------------

// 限流中间件专用的业务码（与 model 包既有码区段保持一致风格）
// 1002 用于限流场景，区别于既有 CodeRateLimited(42901)
const CodeRateLimitedMiddleware = 1002

// NewOpenAIChatResponse 构造一个非流式 Chat Completions 响应
// 自动补全 object、created 等字段
func NewOpenAIChatResponse(id, model string, choice OpenAIChoice, usage OpenAIUsage) *OpenAIChatResponse {
	return &OpenAIChatResponse{
		ID:      id,
		Object:  OpenAIObjectChatCompletion,
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []OpenAIChoice{choice},
		Usage:   usage,
	}
}

// NewOpenAIError 构造一个 OpenAI 兼容错误响应
func NewOpenAIError(message, errType string, code interface{}) *OpenAIErrorResponse {
	return &OpenAIErrorResponse{
		Error: OpenAIError{
			Message: message,
			Type:    errType,
			Param:   nil,
			Code:    code,
		},
	}
}

// OpenAI object 固定值常量集中定义，避免散落魔法字符串
const (
	OpenAIObjectChatCompletion = "chat.completion"        // 非流式响应 object
	OpenAIObjectChatChunk      = "chat.completion.chunk"  // 流式分片 object
	OpenAIObjectModel          = "model"                  // 单个模型 object
	OpenAIObjectList           = "list"                   // 列表 object

	// 错误类型常量
	OpenAIErrTypeInvalidRequest  = "invalid_request_error"  // 请求参数错误
	OpenAIErrTypeAuthentication  = "authentication_error"  // 鉴权失败
	OpenAIErrTypeRateLimit       = "rate_limit_error"      // 触发限流
	OpenAIErrTypeServerError     = "server_error"           // 服务端内部错误
	OpenAIErrTypeAPIError        = "api_error"              // 厂商调用错误

	// 错误码常量（字符串形式，对齐 OpenAI 习惯）
	OpenAIErrCodeInvalidAPIKey   = "invalid_api_key"        // API Key 无效
	OpenAIErrCodeMissingAPIKey   = "missing_api_key"        // 缺少 API Key
	OpenAIErrCodeRateLimitExceeded = "rate_limit_exceeded" // 超出限流
	OpenAIErrCodeQuotaExceeded   = "insufficient_quota"    // 额度不足
	OpenAIErrCodeModelNotFound   = "model_not_found"        // 模型不存在
)
