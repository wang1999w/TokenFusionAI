'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  chat as chatApi,
  generateImage as generateImageApi,
  generateVideo as generateVideoApi,
  getVideoTask as getVideoTaskApi,
  generateCode as generateCodeApi,
  type ChatMessage,
  type GenerateImageParams,
  type GenerateVideoParams,
  type VideoTask,
  type VideoTaskStatus,
  type CodeGenerationResult,
} from '@/lib/api/generation';
import { parseSSEStream } from '@/lib/utils/sse';
import { ApiError } from '@/lib/api/request';

/* ============================================================
 * 通用类型
 * ============================================================ */

/** 对话消息（带 id，便于渲染） */
export interface UIMessage extends ChatMessage {
  id: string;
  /** 流式生成中标识 */
  streaming?: boolean;
  /** 错误信息 */
  error?: string;
}

/** 图片结果项 */
export interface UIImageItem {
  id: string;
  url: string;
  prompt: string;
  createdAt: number;
}

/** 视频结果项 */
export interface UIVideoItem extends VideoTask {
  prompt: string;
  createdAt: number;
}

/** 生成状态 */
type GenStatus = 'idle' | 'loading' | 'success' | 'error';

/** 生成器通用返回结构 */
interface GenState<T> {
  data: T | null;
  status: GenStatus;
  error: string | null;
}

/** 生成唯一 id（用于消息/结果列表 key） */
function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 判断错误是否为额度不足（402 / TOKEN_INSUFFICIENT）
 */
function isQuotaError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 402 || err.code === 'TOKEN_INSUFFICIENT';
  }
  return false;
}

/* ============================================================
 * useChat：对话生成 Hook
 * ============================================================ */

export interface UseChatOptions {
  /** 默认模型 */
  defaultModel?: string;
  /** 默认温度 */
  defaultTemperature?: number;
}

export interface UseChatReturn {
  /** 对话消息列表（含用户与 AI 消息） */
  messages: UIMessage[];
  /** 是否正在生成 */
  isStreaming: boolean;
  /** 错误信息 */
  error: string | null;
  /** 额度是否耗尽（用于触发弹窗） */
  quotaExhausted: boolean;
  /** 当前选中的模型 */
  model: string;
  /** 当前温度 */
  temperature: number;
  /** 设置模型 */
  setModel: (m: string) => void;
  /** 设置温度 */
  setTemperature: (t: number) => void;
  /** 发送消息（含上下文），自动追加 AI 占位并流式填充 */
  sendMessage: (content: string) => Promise<void>;
  /** 停止当前生成 */
  stopGeneration: () => void;
  /** 清空对话 */
  clearChat: () => void;
  /** 重置额度耗尽标记 */
  resetQuota: () => void;
}

/**
 * useChat
 *
 * 管理：
 * - 对话列表（多轮上下文）
 * - 发送消息：追加用户消息 -> 请求流式接口 -> 追加 AI 占位 -> SSE 逐字填充
 * - 停止生成：中断 fetch 的 AbortController
 * - 额度耗尽检测
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    defaultModel = 'gpt-4o-mini',
    defaultTemperature = 0.7,
  } = options;

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const [temperature, setTemperature] = useState(defaultTemperature);

  // AbortController 引用，用于停止生成
  const abortRef = useRef<AbortController | null>(null);
  // 流式状态标记（与 isStreaming 解耦，避免闭包陷阱）
  const streamingRef = useRef(false);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || streamingRef.current) return;

      setError(null);

      // 1. 追加用户消息
      const userMsg: UIMessage = {
        id: uid('msg'),
        role: 'user',
        content: text,
      };
      // 2. 追加 AI 占位消息（流式填充）
      const aiMsg: UIMessage = {
        id: uid('msg'),
        role: 'assistant',
        content: '',
        streaming: true,
      };

      // 构造发送给后端的消息上下文（包含本轮用户消息）
      const history: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      setMessages((prev) => [...prev, userMsg, aiMsg]);

      // 3. 创建 AbortController，支持停止生成
      const controller = new AbortController();
      abortRef.current = controller;
      streamingRef.current = true;
      setIsStreaming(true);

      try {
        // 调用流式接口（传入中断信号，支持停止生成）
        const response = await chatApi(
          {
            messages: history,
            model,
            stream: true,
            temperature,
          },
          controller.signal,
        );

        // 解析 SSE 流，逐字追加到 AI 占位消息
        await parseSSEStream(
          response,
          (chunk: string) => {
            // 逐字追加内容
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m,
              ),
            );
          },
          // 流结束
          () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsg.id ? { ...m, streaming: false } : m,
              ),
            );
          },
          // 错误
          (err: Error) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsg.id
                  ? { ...m, streaming: false, error: err.message }
                  : m,
              ),
            );
            setError(err.message);
          },
        );
      } catch (err) {
        // fetch 被 abort 时 err.name === 'AbortError'，属正常停止，不报错
        if (err instanceof Error && err.name === 'AbortError') {
          // 正常停止：仅结束 streaming 标记
        } else {
          const message = err instanceof Error ? err.message : '生成失败';
          setError(message);
          // 标记 AI 消息错误
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsg.id
                ? { ...m, streaming: false, error: message }
                : m,
            ),
          );
          // 检测额度耗尽
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
          }
        }
      } finally {
        streamingRef.current = false;
        setIsStreaming(false);
        abortRef.current = null;
        // 确保 streaming 标记被清除
        setMessages((prev) =>
          prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
        );
      }
    },
    [messages, model, temperature],
  );

  /**
   * 停止生成
   */
  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    streamingRef.current = false;
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

  /**
   * 清空对话
   */
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  /** 重置额度耗尽标记 */
  const resetQuota = useCallback(() => setQuotaExhausted(false), []);

  return {
    messages,
    isStreaming,
    error,
    quotaExhausted,
    model,
    temperature,
    setModel,
    setTemperature,
    sendMessage,
    stopGeneration,
    clearChat,
    resetQuota,
  };
}

/* ============================================================
 * useImageGeneration：图片生成 Hook
 * ============================================================ */

export interface UseImageGenerationReturn {
  /** 生成结果列表 */
  results: UIImageItem[];
  /** 生成状态 */
  status: GenStatus;
  /** 是否生成中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 额度耗尽 */
  quotaExhausted: boolean;
  /** 生成图片 */
  generate: (params: GenerateImageParams) => Promise<void>;
  /** 清空结果 */
  clear: () => void;
  /** 重置额度标记 */
  resetQuota: () => void;
}

/**
 * useImageGeneration
 *
 * 管理图片生成状态与结果列表
 */
export function useImageGeneration(): UseImageGenerationReturn {
  const [results, setResults] = useState<UIImageItem[]>([]);
  const [status, setStatus] = useState<GenStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const generate = useCallback(async (params: GenerateImageParams) => {
    setStatus('loading');
    setError(null);
    try {
      const res = await generateImageApi(params);
      const items: UIImageItem[] = res.images.map((img) => ({
        id: uid('img'),
        url: img.url,
        prompt: params.prompt,
        createdAt: Date.now(),
      }));
      // 新结果前置
      setResults((prev) => [...items, ...prev]);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '图片生成失败';
      setError(message);
      setStatus('error');
      if (isQuotaError(err)) setQuotaExhausted(true);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setStatus('idle');
    setError(null);
  }, []);

  const resetQuota = useCallback(() => setQuotaExhausted(false), []);

  return {
    results,
    status,
    isLoading: status === 'loading',
    error,
    quotaExhausted,
    generate,
    clear,
    resetQuota,
  };
}

/* ============================================================
 * useVideoGeneration：视频生成 Hook（异步轮询）
 * ============================================================ */

export interface UseVideoGenerationReturn {
  /** 当前任务 */
  task: UIVideoItem | null;
  /** 历史任务列表 */
  history: UIVideoItem[];
  /** 是否提交中 */
  isSubmitting: boolean;
  /** 是否轮询中 */
  isPolling: boolean;
  /** 错误信息 */
  error: string | null;
  /** 额度耗尽 */
  quotaExhausted: boolean;
  /** 生成进度（0-100） */
  progress: number;
  /** 发起生成 */
  generate: (params: GenerateVideoParams) => Promise<void>;
  /** 取消轮询 */
  cancelPolling: () => void;
  /** 重置额度标记 */
  resetQuota: () => void;
}

/** 轮询间隔（毫秒） */
const POLL_INTERVAL = 3000;
/** 最大轮询次数（约 5 分钟） */
const MAX_POLL_COUNT = 100;

/**
 * useVideoGeneration
 *
 * 视频生成为异步任务：
 * 1. 发起 generateVideo 拿到 taskId
 * 2. 轮询 getVideoTask 直到状态为 succeeded / failed
 */
export function useVideoGeneration(): UseVideoGenerationReturn {
  const [task, setTask] = useState<UIVideoItem | null>(null);
  const [history, setHistory] = useState<UIVideoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [progress, setProgress] = useState(0);

  // 轮询定时器与计数引用
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const currentTaskIdRef = useRef<string | null>(null);

  /**
   * 停止轮询定时器
   */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * 轮询单次查询
   */
  const pollOnce = useCallback(
    async (taskId: string, prompt: string) => {
      try {
        const detail = await getVideoTaskApi(taskId);
        const next: UIVideoItem = {
          ...detail,
          prompt,
          createdAt: Date.now(),
        };
        setTask(next);
        setProgress(detail.progress ?? 0);

        // 终态：停止轮询
        if (detail.status === 'succeeded' || detail.status === 'failed') {
          setIsPolling(false);
          // 成功则进入历史
          if (detail.status === 'succeeded') {
            setHistory((prev) => [next, ...prev]);
          }
          if (detail.status === 'failed') {
            setError(detail.error ?? '视频生成失败');
          }
          return;
        }

        // 继续轮询（未达最大次数）
        pollCountRef.current += 1;
        if (pollCountRef.current >= MAX_POLL_COUNT) {
          setIsPolling(false);
          setError('视频生成超时');
          return;
        }

        timerRef.current = setTimeout(() => {
          void pollOnce(taskId, prompt);
        }, POLL_INTERVAL);
      } catch (err) {
        setIsPolling(false);
        const message = err instanceof Error ? err.message : '查询任务失败';
        setError(message);
      }
    },
    [],
  );

  /**
   * 发起生成
   */
  const generate = useCallback(
    async (params: GenerateVideoParams) => {
      setError(null);
      setProgress(0);
      setIsSubmitting(true);
      try {
        const res = await generateVideoApi(params);
        setIsSubmitting(false);

        const initial: UIVideoItem = {
          taskId: res.taskId,
          status: res.status,
          progress: 0,
          prompt: params.prompt,
          createdAt: Date.now(),
        };
        setTask(initial);
        currentTaskIdRef.current = res.taskId;

        // 进入轮询
        setIsPolling(true);
        pollCountRef.current = 0;
        void pollOnce(res.taskId, params.prompt);
      } catch (err) {
        setIsSubmitting(false);
        const message = err instanceof Error ? err.message : '视频生成失败';
        setError(message);
        if (isQuotaError(err)) setQuotaExhausted(true);
      }
    },
    [pollOnce],
  );

  /**
   * 取消轮询
   */
  const cancelPolling = useCallback(() => {
    stopTimer();
    setIsPolling(false);
  }, [stopTimer]);

  /** 重置额度标记 */
  const resetQuota = useCallback(() => setQuotaExhausted(false), []);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    task,
    history,
    isSubmitting,
    isPolling,
    error,
    quotaExhausted,
    progress,
    generate,
    cancelPolling,
    resetQuota,
  };
}

/* ============================================================
 * useCodeGeneration：代码生成 Hook
 * ============================================================ */

export interface UseCodeGenerationReturn {
  /** 生成结果 */
  result: GenState<CodeGenerationResult>;
  /** 是否生成中 */
  isLoading: boolean;
  /** 额度耗尽 */
  quotaExhausted: boolean;
  /** 生成代码 */
  generate: (params: {
    prompt: string;
    model: string;
    language: string;
  }) => Promise<void>;
  /** 清空结果 */
  clear: () => void;
  /** 重置额度标记 */
  resetQuota: () => void;
}

/**
 * useCodeGeneration
 *
 * 管理代码生成状态
 */
export function useCodeGeneration(): UseCodeGenerationReturn {
  const [result, setResult] = useState<GenState<CodeGenerationResult>>({
    data: null,
    status: 'idle',
    error: null,
  });
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const generate = useCallback(
    async (params: { prompt: string; model: string; language: string }) => {
      setResult({ data: null, status: 'loading', error: null });
      try {
        const res = await generateCodeApi(params);
        setResult({ data: res, status: 'success', error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : '代码生成失败';
        setResult({ data: null, status: 'error', error: message });
        // 检测额度耗尽
        if (isQuotaError(err)) setQuotaExhausted(true);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setResult({ data: null, status: 'idle', error: null });
  }, []);

  const resetQuota = useCallback(() => {
    setQuotaExhausted(false);
    setResult((prev) => ({ ...prev, status: prev.status === 'error' ? 'idle' : prev.status }));
  }, []);

  return {
    result,
    isLoading: result.status === 'loading',
    quotaExhausted,
    generate,
    clear,
    resetQuota,
  };
}
