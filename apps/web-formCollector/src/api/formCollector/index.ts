/**
 * 表单采集器 API
 */

import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

export namespace FormCollectorApi {
  /** 任务信息 */
  export interface TaskInfo {
    taskId: string;
    taskName: string;
    taskDesc: string;
    status: number;
    permission: number; // 权限配置(位运算)
    submitCount: number; // 提交数量
    createdAt: number;
  }

  /** 表单数据信息 */
  export interface FormDataInfo {
    dataId: string;
    taskId: string;
    formData: Record<string, any>;
    submitIp: string;
    submitRegion: string;
    submitAt: number;
  }

  /** 创建任务参数 */
  export interface CreateTaskParams {
    taskName: string;
    taskDesc?: string;
    permission?: number; // 权限配置(位运算)
  }

  /** 创建任务响应 */
  export interface CreateTaskResponse {
    taskId: string;
  }

  /** 更新任务参数 */
  export interface UpdateTaskParams {
    taskId: string;
    taskName: string;
    taskDesc?: string;
    status: number;
    permission?: number; // 权限配置(位运算)
  }

  /** 获取任务列表参数 */
  export interface GetTaskListParams {
    pageIndex: number;
    pageSize: number;
  }

  /** 获取任务列表响应 */
  export interface GetTaskListResponse {
    total: number;
    list: TaskInfo[];
  }

  /** 获取表单数据列表参数 */
  export interface GetFormDataListParams {
    taskId: string;
    pageIndex: number;
    pageSize: number;
  }

  /** 获取表单数据列表响应 */
  export interface GetFormDataListResponse {
    total: number;
    list: FormDataInfo[];
  }

  /** 获取统计数据响应 */
  export interface GetStatisticsResponse {
    totalTasks: number;        // 总任务数
    activeTasks: number;       // 活跃任务数
    totalSubmissions: number;  // 总提交数
  }
}

/**
 * 创建任务
 */
export async function createTaskApi(params: FormCollectorApi.CreateTaskParams) {
  return requestClient.post<FormCollectorApi.CreateTaskResponse>(
    '/tk/formTask/createTask',
    params,
  );
}

/**
 * 更新任务
 */
export async function updateTaskApi(params: FormCollectorApi.UpdateTaskParams) {
  return requestClient.post<void>('/tk/formTask/updateTask', params);
}

/**
 * 删除任务
 */
export async function deleteTaskApi(taskId: string) {
  return requestClient.post<void>('/tk/formTask/deleteTask', { taskId });
}

/**
 * 获取任务列表
 */
export async function getTaskListApi(
  params: FormCollectorApi.GetTaskListParams,
) {
  return requestClient.post<FormCollectorApi.GetTaskListResponse>(
    '/tk/formTask/getTaskList',
    params,
  );
}

/**
 * 获取表单数据列表
 */
export async function getFormDataListApi(
  params: FormCollectorApi.GetFormDataListParams,
) {
  return requestClient.post<FormCollectorApi.GetFormDataListResponse>(
    '/tk/formSubmit/getFormDataList',
    params,
  );
}

/**
 * 删除表单数据
 */
export async function deleteFormDataApi(taskId: string, dataId: string) {
  return requestClient.post<void>('/tk/formSubmit/deleteFormData', {
    taskId,
    dataId,
  });
}

/**
 * 删除所有表单数据
 */
export async function deleteAllFormDataApi(taskId: string) {
  return requestClient.post<void>('/tk/formSubmit/deleteAllFormData', {
    taskId,
  });
}

/**
 * 导出任务数据为 Excel
 */
export async function exportTaskDataApi(taskId: string) {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;

  // 获取 API 基础路径
  const apiURL = import.meta.env.VITE_GLOB_API_URL || '/api';

  // 使用原生 fetch API 来下载文件
  const response = await fetch(`${apiURL}/tk/formTask/exportTaskData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ taskId }),
  });

  if (!response.ok) {
    // 尝试解析错误信息
    let errorMessage = `HTTP ${response.status}`;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
    } catch (e) {
      // 忽略解析错误
    }
    throw new Error(errorMessage);
  }

  return await response.blob();
}

/**
 * 获取统计数据
 */
export async function getStatisticsApi() {
  return requestClient.post<FormCollectorApi.GetStatisticsResponse>(
    '/tk/formTask/getStatistics',
    {},
  );
}
