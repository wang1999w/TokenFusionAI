package sse

import (
	"fmt"
	"net/http"

	"tokenfusiongateway/pkg/logger"

	"go.uber.org/zap"
)

// SSEWriter 封装 Server-Sent Events（SSE）流式响应写入器
// 用于将 AI 厂商返回的数据以 SSE 协议格式透传给客户端
//
// SSE 协议格式（每条事件以两个换行符结尾）：
//   event: <事件类型>
//   data: <数据>
//   \n\n
type SSEWriter struct {
	w       http.ResponseWriter // 底层 HTTP 响应写
	flusher http.Flusher        // 用于立即将缓冲数据推送到客户端
}

// New 创建一个 SSEWriter，并写入必要的响应头
// 若底层 ResponseWriter 不支持 Flush，则返回错误
func New(w http.ResponseWriter) (*SSEWriter, error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf("response writer does not support flushing")
	}

	// 设置 SSE 必需的响应头
	w.Header().Set("Content-Type", "text/event-stream") // SSE 内容类型
	w.Header().Set("Cache-Control", "no-cache")        // 禁用缓存，保证实时推送
	w.Header().Set("Connection", "keep-alive")        // 保持长连接
	w.Header().Set("X-Accel-Buffering", "no")         // 禁用 Nginx 缓冲，保证数据即时透传
	w.WriteHeader(http.StatusOK)

	return &SSEWriter{
		w:       w,
		flusher: flusher,
	}, nil
}

// writeEvent 写入一条完整的 SSE 事件并立即刷新
// event 为事件类型，data 为事件数据（可包含多行）
func (s *SSEWriter) writeEvent(event, data string) error {
	// event 行（非空时才写）
	if event != "" {
		if _, err := fmt.Fprintf(s.w, "event: %s\n", event); err != nil {
			return err
		}
	}
	// data 行，支持多行（每行以 "data: " 前缀）
	if _, err := fmt.Fprintf(s.w, "data: %s\n\n", data); err != nil {
		return err
	}
	// 立即将数据推送到客户端
	s.flusher.Flush()
	return nil
}

// WriteData 写入一条 data 事件，用于透传 AI 生成的增量内容
func (s *SSEWriter) WriteData(data string) error {
	if err := s.writeEvent("data", data); err != nil {
		logger.Error("SSE 写入 data 事件失败", zap.Error(err))
		return err
	}
	return nil
}

// WriteDone 写入 done 事件，表示流式生成结束
// 客户端据此关闭连接
func (s *SSEWriter) WriteDone() error {
	if err := s.writeEvent("done", "[DONE]"); err != nil {
		logger.Error("SSE 写入 done 事件失败", zap.Error(err))
		return err
	}
	return nil
}

// WriteError 写入一条 error 事件，表示流式过程中发生错误
func (s *SSEWriter) WriteError(message string) error {
	if err := s.writeEvent("error", message); err != nil {
		logger.Error("SSE 写入 error 事件失败", zap.Error(err))
		return err
	}
	return nil
}

// Flush 手动刷新缓冲，将已写入的数据立即推送到客户端
func (s *SSEWriter) Flush() {
	s.flusher.Flush()
}

// Passthrough 透传底层 SSE 原始字节流
// 用于将上游厂商返回的 SSE 数据原样转发给客户端，不做任何解析和修改
// line 为一行原始 SSE 数据（不含结尾换行）
func (s *SSEWriter) Passthrough(line string) error {
	if _, err := fmt.Fprintf(s.w, "%s\n", line); err != nil {
		return err
	}
	// 检测到事件结束标记（空行）时刷新
	if line == "" {
		s.flusher.Flush()
	}
	return nil
}
