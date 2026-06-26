package provider

import "context"

// ChatChunk 流式对话的分片数据
// 支持流式输出的厂商通过 ChatStream 接口按片返回生成内容
type ChatChunk struct {
	ID           string `json:"id,omitempty"`            // 响应唯一ID（通常首片携带）
	Model        string `json:"model,omitempty"`         // 模型名称
	Role         string `json:"role,omitempty"`          // 角色（首片通常为 assistant）
	Delta        string `json:"delta"`                   // 增量内容（核心字段）
	FinishReason string `json:"finish_reason,omitempty"` // 结束原因：stop/length 等
	Done         bool   `json:"done"`                    // 是否为最后一片
	Usage        *Usage `json:"usage,omitempty"`          // Token 用量（最后一片携带）
	Err          error  `json:"-"`                        // 流式过程中的错误（内部使用，不序列化）
}

// ChatStreamProvider 流式对话能力接口
// 支持流式输出的厂商可选实现此接口（不强制，未实现时网关将退化为整体返回）
// 网关据此透传底层 SSE 流，实现真正的边生成边推送
type ChatStreamProvider interface {
	// ChatStream 启动流式对话，返回一个分片通道
	// 通道关闭表示流式结束；若过程中出错，最后一片的 Err 字段携带错误
	ChatStream(ctx context.Context, req *ChatRequest) (<-chan ChatChunk, error)
}
