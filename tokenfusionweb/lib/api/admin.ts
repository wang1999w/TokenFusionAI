import { api } from './request';

/**
 * 管理后台 API 封装
 *
 * 对接后端 /api/v1/admin/* 接口，仅 admin 角色可调用。
 * 涵盖：用户管理、订单管理、数据看板统计三大模块。
 *
 * 设计说明：
 * - 所有接口返回的数据结构均做了 TypeScript 类型约束，便于页面层推断；
 * - 列表接口统一支持分页参数（page / pageSize）与关键字搜索（keyword）；
 * - 分页响应统一为 { list, total, page, pageSize } 结构，便于前端表格渲染。
 */

/* ============================================================
 * 通用类型
 * ============================================================ */

/** 统一分页响应结构 */
export interface PaginatedResponse<T> {
  /** 当前页数据列表 */
  list: T[];
  /** 总记录数（用于分页器计算总页数） */
  total: number;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** 分页查询参数（所有列表接口通用） */
export interface PageQuery {
  /** 页码，默认 1 */
  page?: number;
  /** 每页条数，默认 20 */
  pageSize?: number;
  /** 搜索关键字（邮箱 / 订单号等） */
  keyword?: string;
}

/* ============================================================
 * 用户管理模块类型
 * ============================================================ */

/** 用户状态：active 正常 / banned 封禁 */
export type UserStatus = 'active' | 'banned';

/** 用户角色：admin 管理员 / user 普通用户 */
export type UserRole = 'admin' | 'user';

/** 后台用户列表项（与前台 UserProfile 区分，包含管理所需字段） */
export interface AdminUser {
  /** 用户主键 ID */
  id: number;
  /** 用户 UUID */
  uuid: string;
  /** 邮箱地址 */
  email: string;
  /** 昵称 */
  nickname: string | null;
  /** 角色 */
  role: UserRole;
  /** 账户状态 */
  status: UserStatus;
  /** Token 余额（通用令牌） */
  tokenBalance: number;
  /** 注册时间 ISO 字符串 */
  createdAt: string;
}

/** 调整 Token 额度参数 */
export interface AdjustTokenParams {
  /** 调整数量，正数为增加，负数为扣减 */
  amount: number;
  /** 调整原因（用于审计日志） */
  reason?: string;
}

/* ============================================================
 * 订单管理模块类型
 * ============================================================ */

/** 订单状态 */
export type OrderStatus =
  | 'pending'    // 待支付
  | 'paid'       // 已支付
  | 'refunded'   // 已退款
  | 'failed';    // 支付失败

/** 订单列表项 */
export interface AdminOrder {
  /** 订单号 */
  orderNo: string;
  /** 用户 ID */
  userId: number;
  /** 用户邮箱（便于后台展示） */
  userEmail: string;
  /** 套餐名称 */
  planName: string;
  /** 订单金额（单位：元，浮点） */
  amount: number;
  /** 支付币种 */
  currency: string;
  /** 订单状态 */
  status: OrderStatus;
  /** 支付方式 */
  paymentMethod?: string;
  /** 下单时间 ISO 字符串 */
  createdAt: string;
}

/** 退款参数 */
export interface RefundParams {
  /** 退款原因 */
  reason?: string;
}

/* ============================================================
 * 数据看板模块类型
 * ============================================================ */

/** 看板顶部统计卡片数据 */
export interface DashboardStats {
  /** 日活用户数（DAU） */
  dau: number;
  /** 新注册用户数（当日） */
  newRegistrations: number;
  /** 当日充值总额（单位：元） */
  rechargeAmount: number;
  /** 当日 API 调用总量 */
  apiCalls: number;
}

/** 消耗趋势数据点（按日聚合） */
export interface ConsumptionTrendPoint {
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 当日消耗的 Token 数 */
  tokens: number;
  /** 当日消耗金额 */
  amount: number;
}

/** 各功能占比统计项 */
export interface FeatureUsageItem {
  /** 功能名称：chat / image / video / code */
  name: string;
  /** 调用次数 */
  count: number;
}

/** 看板聚合数据 */
export interface DashboardOverview {
  /** 顶部统计卡片 */
  stats: DashboardStats;
  /** 近 14 天消耗趋势 */
  trend: ConsumptionTrendPoint[];
  /** 各功能调用占比 */
  featureUsage: FeatureUsageItem[];
}

/* ============================================================
 * 用户管理 API
 * ============================================================ */

/**
 * 获取用户列表（分页 + 搜索）
 *
 * @param query 分页与搜索参数
 */
export async function getAdminUsers(
  query: PageQuery = {},
): Promise<PaginatedResponse<AdminUser>> {
  // 将 query 拼接到 URL 上，后端按 query string 解析
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.keyword) params.set('keyword', query.keyword);

  return api.get(`/admin/users?${params.toString()}`);
}

/**
 * 封禁用户
 * @param userId 用户 ID
 */
export async function banUser(
  userId: number,
): Promise<{ message: string }> {
  return api.post(`/admin/users/${userId}/ban`);
}

/**
 * 解封用户
 * @param userId 用户 ID
 */
export async function unbanUser(
  userId: number,
): Promise<{ message: string }> {
  return api.post(`/admin/users/${userId}/unban`);
}

/**
 * 调整用户 Token 额度
 * @param userId 用户 ID
 * @param params 调整数量与原因
 */
export async function adjustUserTokens(
  userId: number,
  params: AdjustTokenParams,
): Promise<{ message: string; tokenBalance: number }> {
  return api.post(`/admin/users/${userId}/adjust-tokens`, params);
}

/* ============================================================
 * 订单管理 API
 * ============================================================ */

/**
 * 获取订单列表（分页 + 搜索）
 *
 * @param query 分页与搜索参数
 */
export async function getAdminOrders(
  query: PageQuery = {},
): Promise<PaginatedResponse<AdminOrder>> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.keyword) params.set('keyword', query.keyword);

  return api.get(`/admin/orders?${params.toString()}`);
}

/**
 * 订单退款
 * @param orderNo 订单号
 * @param params 退款原因
 */
export async function refundOrder(
  orderNo: string,
  params: RefundParams = {},
): Promise<{ message: string }> {
  return api.post(`/admin/orders/${orderNo}/refund`, params);
}

/* ============================================================
 * 数据看板 API
 * ============================================================ */

/**
 * 获取数据看板聚合数据
 * 包含：统计卡片、消耗趋势、功能占比
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  return api.get('/admin/dashboard/overview');
}
