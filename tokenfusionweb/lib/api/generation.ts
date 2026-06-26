import { GATEWAY_BASE_URL } from '@/lib/constants';
import { api, ApiError } from './request';

/**
 * 生成类接口封装
 * 对接网关 /gateway/v1/* 接口
 *
 * 说明：
 * - chat（对话）支持 SSE 流式返回，需手动 fetch 读取 ReadableStream；
 * - 其余接口（图片/视频/代码）为标准 JSON 请求，复用通用 api 方法。
 */

/* ============================================================
 * 通用类型定义
 * ============================================================ */

/** 对话消息（OpenAI 风格） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 对话请求参数 */
export interface ChatParams {
  messages: ChatMessage[];
  model: string;
  /** 是否启用流式返回，默认 true */
  stream?: boolean;
  /** 采样温度，0~2，控制随机性 */
  temperature?: number;
}

/** 对话返回的流式响应文本片段回调 */
export type ChatOnChunk = (chunk: string) => void;

/** 图片生成请求参数 */
export interface GenerateImageParams {
  prompt: string;
  model: string;
  /** 生成数量 */
  n?: number;
  /** 图片尺寸，如 "1024x1024" */
  size?: string;
}

/** 单张生成图片结果 */
export interface GeneratedImage {
  /** 图片地址或 base64（data:image/...） */
  url: string;
  /** 可选的修订提示 */
  revisedPrompt?: string;
}

/** 图片生成响应 */
export interface ImageGenerationResult {
  images: GeneratedImage[];
  /** 本次消耗的 token 数 */
  tokensUsed?: number;
}

/** 视频生成请求参数 */
export interface GenerateVideoParams {
  prompt: string;
  model: string;
  /** 视频时长（秒） */
  duration?: number;
}

/** 视频任务状态 */
export type VideoTaskStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

/** 视频任务详情 */
export interface VideoTask {
  taskId: string;
  status: VideoTaskStatus;
  /** 进度百分比 0-100 */
  progress?: number;
  /** 生成完成后的视频地址 */
  videoUrl?: string;
  /** 失败时的错误信息 */
  error?: string;
  /** 封面图 */
  coverUrl?: string;
}

/** 代码生成请求参数 */
export interface GenerateCodeParams {
  prompt: string;
  model: string;
  /** 目标编程语言 */
  language: string;
}

/** 代码生成响应 */
export interface CodeGenerationResult {
  /** 生成的代码内容 */
  code: string;
  /** 代码语言标识（用于高亮） */
  language: string;
  /** 可选的说明文本 */
  explanation?: string;
  /** 本次消耗的 token 数 */
  tokensUsed?: number;
}

/* ============================================================
 * 内部：流式请求头构建（复用鉴权与设备指纹）
 * ============================================================ */

/**
 * 获取设备指纹 ID
 * 与 request.ts 保持一致，用于风控
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

/**
 * 构建通用请求头（鉴权 + 设备指纹 + Content-Type）
 * 用于流式请求（需手动 fetch）
 */
function buildStreamHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };

  // 注入登录态 token
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // 注入设备指纹
  const deviceId = getDeviceId();
  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
  }

  return { ...headers, ...extra };
}

/**
 * 拼接网关完整地址
 */
function gatewayUrl(path: string): string {
  return `${GATEWAY_BASE_URL}${path}`;
}

/* ============================================================
 * chat：对话接口（支持 SSE 流式）
 * ============================================================ */

/**
 * 对话接口
 *
 * 始终返回原始 Response 对象：
 * - 当 stream=true（默认）：Response.body 为 SSE 流，调用方配合
 *   parseSSEStream 解析，实现打字机效果。
 * - 当 stream=false：Response 为标准 JSON，调用方可直接 response.json()。
 *
 * @param params 对话参数（messages / model / stream / temperature）
 * @param signal 可选的中断信号，用于"停止生成"
 * @returns fetch 返回的原始 Response 对象
 */
export async function chat(params: ChatParams, signal?: AbortSignal): Promise<Response> {
  const { stream = true } = params;

  const fullUrl = gatewayUrl('/gateway/v1/chat');

  // 流式时 Accept 设为 text/event-stream，便于网关识别
  const headers = buildStreamHeaders(
    stream ? { Accept: 'text/event-stream' } : { Accept: 'application/json' },
  );

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      signal,
    });
  } catch (err) {
    // 网络错误（无法连接服务器）
    throw new ApiError(
      err instanceof Error ? err.message : 'Network error',
      0,
      'NETWORK_ERROR',
    );
  }

  // 非 2xx 响应统一抛出 ApiError
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode: string | undefined;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code;
    } catch {
      // 响应体非 JSON，使用默认错误消息
    }
    throw new ApiError(errorMessage, response.status, errorCode);
  }

  // 返回原始 Response，交由调用方决定如何解析
  return response;
}

/**
 * 非流式对话便捷方法：直接返回完整文本
 *
 * @param params 对话参数（stream 会被强制设为 false）
 * @returns AI 回复的完整文本
 */
export async function chatComplete(params: ChatParams): Promise<string> {
  const res = await fetch(gatewayUrl('/gateway/v1/chat'), {
    method: 'POST',
    headers: buildStreamHeaders({ Accept: 'application/json' }),
    body: JSON.stringify({ ...params, stream: false }),
  });

  if (!res.ok) {
    throw new ApiError(`Chat failed with status ${res.status}`, res.status);
  }

  const data = await res.json();
  const choices = data?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    return choices[0]?.message?.content ?? '';
  }
  return data?.content ?? '';
}

/* ============================================================
 * generateImage：图片生成
 * ============================================================ */

/**
 * 生成图片
 * 调用 /gateway/v1/images/generations
 *
 * @param params 提示词、模型、数量、尺寸
 * @returns 图片结果列表
 */
export async function generateImage(
  params: GenerateImageParams,
): Promise<ImageGenerationResult> {
  // 网关返回结构兼容：{ data: [{ url }] } 或 { images: [...] }
  const raw = await api.post<Record<string, unknown>>(
    '/gateway/v1/images/generations',
    params,
  );

  // 兼容 OpenAI 风格 data 数组
  const dataArray = raw.data as Array<Record<string, unknown>> | undefined;
  const images: GeneratedImage[] = [];

  if (Array.isArray(dataArray)) {
    for (const item of dataArray) {
      const url = (item.url as string) ?? (item.b64_json as string);
      if (url) {
        images.push({
          url,
          revisedPrompt: item.revised_prompt as string | undefined,
        });
      }
    }
  }

  // 兼容简化风格 images 数组
  const rawImages = raw.images as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(rawImages)) {
    for (const item of rawImages) {
      const url = (item.url as string) ?? (item.b64_json as string);
      if (url) images.push({ url, revisedPrompt: item.revised_prompt as string | undefined });
    }
  }

  return {
    images,
    tokensUsed: raw.tokensUsed as number | undefined,
  };
}

/* ============================================================
 * generateVideo：视频生成（异步任务）
 * ============================================================ */

/**
 * 发起视频生成任务
 * 调用 /gateway/v1/videos/generations
 *
 * @param params 提示词、模型、时长
 * @returns 任务 ID 及初始状态
 */
export async function generateVideo(
  params: GenerateVideoParams,
): Promise<{ taskId: string; status: VideoTaskStatus }> {
  const raw = await api.post<Record<string, unknown>>(
    '/gateway/v1/videos/generations',
    params,
  );

  // 兼容不同返回字段：taskId / task_id / id
  const taskId =
    (raw.taskId as string) ??
    (raw.task_id as string) ??
    (raw.id as string) ??
    '';

  const status = (raw.status as VideoTaskStatus) ?? 'pending';

  return { taskId, status };
}

/**
 * 查询视频任务状态
 * 调用 /gateway/v1/videos/tasks/:id
 *
 * @param taskId 任务 ID
 * @returns 任务详情（状态、进度、视频地址等）
 */
export async function getVideoTask(taskId: string): Promise<VideoTask> {
  return api.get<VideoTask>(`/gateway/v1/videos/tasks/${taskId}`);
}

/* ============================================================
 * generateCode：代码生成
 * ============================================================ */

/**
 * 生成代码
 * 调用 /gateway/v1/code/generations
 *
 * @param params 需求描述、模型、语言
 * @returns 代码内容、语言、说明
 */
export async function generateCode(
  params: GenerateCodeParams,
): Promise<CodeGenerationResult> {
  const raw = await api.post<Record<string, unknown>>(
    '/gateway/v1/code/generations',
    params,
  );

  // 兼容多种返回字段
  const code =
    (raw.code as string) ??
    (raw.content as string) ??
    (raw.output as string) ??
    '';

  const language =
    (raw.language as string) ?? params.language ?? 'text';

  const explanation =
    (raw.explanation as string) ??
    (raw.description as string) ??
    (raw.summary as string) ??
    undefined;

  return {
    code,
    language,
    explanation,
    tokensUsed: raw.tokensUsed as number | undefined,
  };
}
