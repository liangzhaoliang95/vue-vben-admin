/**
 * 计划任务API
 */

import { requestClient } from '#/api/request';

// requestClient 已统一拼接 VITE_GLOB_API_URL（即 /server/ezdp）前缀，
// 这里只需传业务路径。注意：这里不能加 /tk 段——那只是 CLAUDE.md 文档和
// router_example.go 示例文件中描述的命名约定，从未真正挂载到路由上；
// 实际生效的路由（见 backend/application/controller/router.go 的
// rbacRouter）直接是 {prefix}/buildManagement/scheduledTask/*，
// 参照 branch-management.ts 等现有 API 文件的写法同理。
const BASE_URL = '/buildManagement/scheduledTask';

/**
 * 获取计划任务列表
 */
export async function getScheduledTaskListApi(params: {
  businessLineId?: number;
  enabled?: boolean;
  keyword?: string;
  pageIndex: number;
  pageSize: number;
}) {
  return requestClient.post<{
    items: ScheduledTaskItem[];
    total: number;
  }>(`${BASE_URL}/list`, params);
}

/**
 * 创建计划任务
 */
export async function createScheduledTaskApi(data: {
  branchId: string;
  businessLineId?: number;
  cronExpression: string;
  enabled: boolean;
  name: string;
  taskType: number;
}) {
  return requestClient.post<ScheduledTask>(`${BASE_URL}/create`, data);
}

/**
 * 更新计划任务
 */
export async function updateScheduledTaskApi(data: {
  branchId?: string;
  cronExpression?: string;
  id: string;
  name?: string;
  taskType?: number;
}) {
  return requestClient.post<ScheduledTask>(`${BASE_URL}/update`, data);
}

/**
 * 删除计划任务
 */
export async function deleteScheduledTaskApi(id: string) {
  return requestClient.post(`${BASE_URL}/delete`, { id });
}

/**
 * 启用/禁用计划任务
 */
export async function toggleScheduledTaskApi(id: string, enabled: boolean) {
  return requestClient.post<ScheduledTask>(`${BASE_URL}/toggle`, {
    id,
    enabled,
  });
}

/**
 * 立即执行计划任务
 */
export async function executeScheduledTaskNowApi(id: string) {
  return requestClient.post<{ message: string }>(`${BASE_URL}/executeNow`, {
    id,
  });
}

/**
 * 获取计划任务详情
 */
export async function getScheduledTaskDetailApi(id: string) {
  return requestClient.post<ScheduledTask>(`${BASE_URL}/getDetail`, { id });
}

/**
 * 计划任务类型定义
 */
export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  taskType: number;
  branchId: string;
  branch: string;
  enabled: boolean;
  lastExecuteTime?: number;
  nextExecuteTime?: number;
  lastExecuteStatus: string;
  lastExecuteError?: string;
  businessLineId: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 计划任务列表项（包含关联信息）
 */
export interface ScheduledTaskItem extends ScheduledTask {
  taskTypeName: string;
  createdByName: string;
}
