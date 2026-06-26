import { api } from './request';

/**
 * Dashboard 控制台 API 封装
 *
 * 对接后端 /api/v1/* 接口，面向已登录的普通用户。
 * 涵盖：API 密钥管理、账单流水、生成历史三大模块。
 */

/* ============================================================
 * 通用类型
 * ============================================================ */

/** 分页响应结构（与 admin 模块保持一致） */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页查询参数 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
  /** 类型筛选（用于历史记录） */
  type?: string;
}

/* ============================================================
 * API 密钥管理模块
 * ============================================================ */

/** API 密钥状态 */
export type ApiKeyStatus = 'active' | 'disabled';

/** API 密钥列表项（列表只返回前缀，不含明文） */
export interface ApiKey {
  /** 密钥 ID */
  id: number;
  /** 密钥名称（用户自定义） */
  name: string;
  /** 密钥前缀（仅展示前 8 位，如 tf-xxxx） */
  keyPrefix: string;
  /** 状态：active 启用 / disabled 禁用 */
  status: ApiKeyStatus;
  /** 创建时间 ISO 字符串 */
  createdAt: string;
  /** 最后使用时间 */
  lastUsedAt?: string;
}

/** 创建密钥返回结果（含明文，仅此一次展示） */
export interface CreatedApiKey extends ApiKey {
  /** 完整密钥明文（仅在创建时返回一次，前端需提示用户保存） */
  plainKey: string;
}

/** 创建密钥参数 */
export interface CreateApiKeyParams {
  /** 密钥名称 */
  name: string;
}

/**
 * 获取当前用户的 API 密钥列表
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  return api.get('/api-keys');
}

/**
 * 创建 API 密钥
 * 注意：返回结果中的 plainKey 为明文，仅此一次返回，需提示用户妥善保存。
 *
 * @param params 密钥名称
 */
export async function createApiKey(
  params: CreateApiKeyParams,
): Promise<CreatedApiKey> {
  return api.post('/api-keys', params);
}

/**
 * 禁用 / 启用 API 密钥
 * @param id 密钥 ID
 * @param status 目标状态
 */
export async function updateApiKeyStatus(
  id: number,
  status: ApiKeyStatus,
): Promise<{ message: string }> {
  return api.patch(`/api-keys/${id}`, { status });
}

/**
 * 删除 API 密钥（不可恢复）
 * @param id 密钥 ID
 */
export async function deleteApiKey(
  id: number,
): Promise<{ message: string }> {
  return api.delete(`/api-keys/${id}`);
}

/* ============================================================
 * 账单模块
 * ============================================================ */

/** 流水类型 */
export type TransactionType =
  | 'recharge'    // 充值
  | 'consumption' // 消耗
  | 'refund'      // 退款
  | 'adjustment'; // 调整

/** 账单流水项 */
export interface BillingTransaction {
  /** 流水 ID */
  id: number;
  /** 流水类型 */
  type: TransactionType;
  /** 变动数量（正为增加，负为扣减） */
  amount: number;
  /** 变动后余额 */
  balanceAfter: number;
  /** 关联订单号（充值 / 退款时存在） */
  orderNo?: string;
  /** 功能类型（消耗时存在：chat / image / video / code） */
  feature?: string;
  /** 备注 */
  remark?: string;
  /** 时间 ISO 字符串 */
  createdAt: string;
}

/** 账单概览（余额 + 统计） */
export interface BillingOverview {
  /** 当前 Token 余额 */
  tokenBalance: number;
  /** 总消耗 */
  totalConsumed: number;
  /** 总充值 */
  totalRecharged: number;
  /** 近 14 天消耗趋势 */
  trend: Array<{ date: string; tokens: number }>;
}

/**
 * 获取账单概览（余额、统计、趋势）
 */
export async function getBillingOverview(): Promise<BillingOverview> {
  return api.get('/billing/overview');
}

/**
 * 获取账单流水列表（分页）
 */
export async function getBillingTransactions(
  query: PageQuery = {},
): Promise<PaginatedResponse<BillingTransaction>> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  return api.get(`/billing/transactions?${params.toString()}`);
}

/* ============================================================
 * 生成历史模块
 * ============================================================ */

/** 生成类型 */
export type GenerationType = 'chat' | 'image' | 'video' | 'code';

/** 生成历史项 */
export interface GenerationHistoryItem {
  /** 记录 ID */
  id: number;
  /** 生成类型 */
  type: GenerationType;
  /** 使用的模型 */
  model: string;
  /** 输入提示词（截断展示） */
  prompt: string;
  /** 结果预览（图片 URL / 视频封面 / 文本片段） */
  resultPreview?: string;
  /** 消耗 Token 数 */
  tokensUsed: number;
  /** 状态：success / failed */
  status: 'success' | 'failed';
  /** 生成时间 ISO 字符串 */
  createdAt: string;
}

/**
 * 获取生成历史列表（分页 + 类型筛选）
 */
export async function getGenerationHistory(
  query: PageQuery = {},
): Promise<PaginatedResponse<GenerationHistoryItem>> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.type) params.set('type', query.type);
  return api.get(`/generation/history?${params.toString()}`);
}

/**
 * 删除生成历史记录
 * @param id 记录 ID
 */
export async function deleteGenerationHistory(
  id: number,
): Promise<{ message: string }> {
  return api.delete(`/generation/history/${id}`);
}
