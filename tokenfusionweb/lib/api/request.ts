import { API_BASE_URL, GATEWAY_BASE_URL } from '@/lib/constants';

/**
 * 请求选项，扩展标准 RequestInit
 * auth: 是否自动注入鉴权头（默认 true）
 */
interface RequestOptions extends RequestInit {
  auth?: boolean;
}

/**
 * 获取设备指纹 ID
 * 首次调用时生成 UUID 并持久化到 localStorage
 * 用于免登用户的设备维度风控
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
 * 获取已登录用户的 access_token
 * 从 localStorage 读取（Zustand 状态持久化）
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * ApiError 统一 API 错误类
 * 包含 HTTP 状态码和业务错误码
 */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 根据 URL 前缀解析基础地址
 * /gateway 开头 → 网关地址（GATEWAY_BASE_URL）
 * 其他 → 业务后端地址（API_BASE_URL）
 */
function resolveBaseUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/gateway')) {
    return `${GATEWAY_BASE_URL}${url}`;
  }
  return `${API_BASE_URL}${url}`;
}

/**
 * 统一请求函数
 * 职责：
 * 1. 自动注入 Content-Type 和 Accept 头
 * 2. 自动注入 Authorization: Bearer <token>（需登录的请求）
 * 3. 自动注入 X-Device-Id（设备指纹）
 * 4. 统一错误处理，抛出 ApiError
 */
async function request<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, headers = {}, ...rest } = options;

  // 构建请求头
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  // 注入鉴权头（已登录用户）
  if (auth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // 注入设备指纹（所有请求携带，用于风控）
  const deviceId = getDeviceId();
  if (deviceId) {
    finalHeaders['X-Device-Id'] = deviceId;
  }

  const fullUrl = resolveBaseUrl(url);

  // 发起请求
  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...rest,
      headers: finalHeaders,
    });
  } catch (err) {
    // 网络错误（无法连接服务器）
    throw new ApiError(
      err instanceof Error ? err.message : 'Network error',
      0,
      'NETWORK_ERROR'
    );
  }

  // 处理非 2xx 响应
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode: string | undefined;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code;
    } catch {
      // 响应体非 JSON 格式，使用默认错误消息
    }

    throw new ApiError(errorMessage, response.status, errorCode);
  }

  // 根据 Content-Type 解析响应
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as Promise<T>;
}

/**
 * API 便捷方法集合
 * 支持 get / post / put / patch / delete
 */
export const api = {
  get<T = unknown>(url: string, options?: RequestOptions) {
    return request<T>(url, { ...options, method: 'GET' });
  },

  post<T = unknown>(url: string, data?: unknown, options?: RequestOptions) {
    return request<T>(url, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  put<T = unknown>(url: string, data?: unknown, options?: RequestOptions) {
    return request<T>(url, {
      ...options,
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  patch<T = unknown>(url: string, data?: unknown, options?: RequestOptions) {
    return request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  delete<T = unknown>(url: string, options?: RequestOptions) {
    return request<T>(url, { ...options, method: 'DELETE' });
  },
};

export { request };
export type { RequestOptions };
