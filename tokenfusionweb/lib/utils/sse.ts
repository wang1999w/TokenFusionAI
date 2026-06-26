/**
 * SSE（Server-Sent Events）流式解析工具
 *
 * 网关的流式接口（如 /gateway/v1/chat）会以标准 SSE 格式返回数据：
 *   data: {"choices":[{"delta":{"content":"你"}}]}\n\n
 *   data: {"choices":[{"delta":{"content":"好"}}]}\n\n
 *   data: [DONE]\n\n
 *
 * 本工具基于 fetch 的 ReadableStream 逐块读取并解析，适用于
 * 浏览器环境的流式打字机效果。
 */

/** 单个 SSE 数据块回调的类型：传入解析后的字符串内容 */
type SSEOnChunk = (chunk: string) => void;

/** 解析完成回调（正常结束或遇到 [DONE]） */
type SSEOnDone = () => void;

/** 错误回调 */
type SSEOnError = (error: Error) => void;

/**
 * 解析 SSE 流式响应
 *
 * 实现细节：
 * 1. 从 response.body 获取 ReadableStream
 * 2. 使用 TextDecoder 将字节流解码为文本
 * 3. 维护一个缓冲区 buffer，按 "\n\n" 分割出独立事件块
 * 4. 对每个事件块，提取 "data: " 后的内容
 * 5. 若内容为 "[DONE]" 表示结束；否则尝试解析 JSON 取出文本片段
 *
 * @param response fetch 返回的 Response 对象（需支持 body 可读流）
 * @param onChunk  每收到一个文本片段时的回调
 * @param onDone   流结束回调
 * @param onError  错误回调
 */
export async function parseSSEStream(
  response: Response,
  onChunk: SSEOnChunk,
  onDone?: SSEOnDone,
  onError?: SSEOnError,
): Promise<void> {
  // body 不存在时无法解析（SSR 或浏览器不支持时）
  if (!response.body) {
    const err = new Error('Response body is not readable');
    onError?.(err);
    throw err;
  }

  const reader = response.body.getReader();
  // TextDecoder 默认 UTF-8，stream:true 表示多段解码时保留未完成的多字节字符
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    // 循环读取流
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();

      // 流读取完毕
      if (done) {
        // 处理缓冲区中可能残留的最后一个事件块
        if (buffer.trim()) {
          processEventBlock(buffer, onChunk);
        }
        onDone?.();
        break;
      }

      // 将本次读取到的字节解码并追加到缓冲区
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件之间以空行（\n\n）分隔
      // 这里按 "\n\n" 切分，最后一个元素可能是不完整的块，保留在缓冲区
      const parts = buffer.split('\n\n');
      // 最后一段保留到下次循环继续拼接
      buffer = parts.pop() ?? '';

      // 处理本次完整的若干事件块
      for (const part of parts) {
        if (part.trim()) {
          processEventBlock(part, onChunk);
        }
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  } finally {
    // 释放读取器锁，避免流锁占用
    reader.releaseLock();
  }
}

/**
 * 处理单个 SSE 事件块
 *
 * 一个事件块可能包含多行，例如：
 *   event: message
 *   data: {"content":"hi"}
 *
 * 我们只关心 data: 开头的行，且 OpenAI 风格的网关通常只发 data 行。
 *
 * @param block   单个事件块文本
 * @param onChunk 文本片段回调
 */
function processEventBlock(block: string, onChunk: SSEOnChunk): void {
  const lines = block.split('\n');
  for (const line of lines) {
    // 去除行首可能的空白
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('data:')) continue;

    // 提取 "data: " 后面的内容
    const data = trimmedLine.slice(5).trim();

    // [DONE] 表示流结束（OpenAI 约定）
    if (data === '[DONE]') return;

    // 尝试解析 JSON，提取文本片段
    // 兼容 OpenAI 的 choices[0].delta.content 结构
    try {
      const json = JSON.parse(data);
      const content = extractContent(json);
      if (content) {
        onChunk(content);
      }
    } catch {
      // 非 JSON 格式时，直接把原始字符串当作文本片段返回
      if (data) {
        onChunk(data);
      }
    }
  }
}

/**
 * 从 SSE 数据对象中提取文本内容
 *
 * 兼容多种网关返回结构：
 * - OpenAI 风格：{ choices: [{ delta: { content } }] }
 * - 简化风格：{ content: "..." } / { text: "..." } / { message: "..." } / { delta: "..." }
 *
 * @param json 解析后的 JSON 对象
 * @returns 文本内容，无匹配则返回空字符串
 */
function extractContent(json: Record<string, unknown>): string {
  // OpenAI 风格：choices[0].delta.content
  if (Array.isArray(json.choices) && json.choices.length > 0) {
    const choice = json.choices[0] as Record<string, unknown>;
    const delta = choice.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta.content === 'string') {
      return delta.content;
    }
    // 部分 delta 直接是字符串
    if (typeof delta === 'string') return delta;
    // choices[0].message.content（非流式兜底）
    const message = choice.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') {
      return message.content;
    }
  }

  // 简化风格兼容
  if (typeof json.content === 'string') return json.content;
  if (typeof json.text === 'string') return json.text;
  if (typeof json.message === 'string') return json.message;
  if (typeof json.delta === 'string') return json.delta;

  return '';
}
