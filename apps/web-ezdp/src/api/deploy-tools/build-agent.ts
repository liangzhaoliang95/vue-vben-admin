import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace BuildAgentApi {
  export interface BuildAgent {
    id: string;
    businessLineId: number;
    businessLineName?: string;
    name: string;
    description: string;
    status: 0 | 1; // 0=离线, 1=在线
    ipAddress: string;
    hostname: string;
    os: string;
    arch: string;
    version: string;
    maxConcurrentTasks: number;
    currentTasks: number;
    totalTasks: number;
    successTasks: number;
    failedTasks: number;
    lastHeartbeatAt: number | null;
    registeredAt: number | null;
    enabled: boolean;
    tags: Record<string, string>;
    createdAt: number;
    updatedAt: number;
  }

  export interface CreateAgentResponse {
    id: string;
    name: string;
    token: string; // Token 仅在创建时返回
    description: string;
    createdAt: number;
  }

  export interface DispatchTaskParams {
    agentId: string;
    taskId: string;
    taskType: string;
    branch: string;
    tagPrefix: string;
    devopsPath?: string;
    projectDefine: Record<string, any>;
    gitlabConfig?: Record<string, any>;
    dockerConfig?: Record<string, any>;
  }
}

/**
 * 获取 Build Agent 列表数据
 */
async function getBuildAgentList(params: Recordable<any>) {
  return requestClient.post<{
    items: BuildAgentApi.BuildAgent[];
    total: number;
  }>('/buildAgent/list', params);
}

/**
 * 创建 Build Agent
 * @param data Build Agent 数据
 */
async function createBuildAgent(
  data: Omit<
    BuildAgentApi.BuildAgent,
    | 'arch'
    | 'createdAt'
    | 'currentTasks'
    | 'failedTasks'
    | 'hostname'
    | 'id'
    | 'ipAddress'
    | 'lastHeartbeatAt'
    | 'os'
    | 'registeredAt'
    | 'status'
    | 'successTasks'
    | 'totalTasks'
    | 'updatedAt'
    | 'version'
  >,
) {
  return requestClient.post<BuildAgentApi.CreateAgentResponse>(
    '/buildAgent/create',
    data,
  );
}

/**
 * 更新 Build Agent
 *
 * @param id Build Agent ID
 * @param data Build Agent 数据
 */
async function updateBuildAgent(
  id: number | string,
  data: Partial<
    Pick<
      BuildAgentApi.BuildAgent,
      'description' | 'enabled' | 'maxConcurrentTasks' | 'name' | 'tags'
    >
  >,
) {
  return requestClient.post('/buildAgent/update', {
    agentId: String(id),
    ...data,
  });
}

/**
 * 删除 Build Agent
 *
 * @param id Build Agent ID
 */
async function deleteBuildAgent(id: number | string) {
  return requestClient.post('/buildAgent/delete', {
    agentId: String(id),
  });
}

/**
 * 获取 Build Agent 详情
 *
 * @param id Build Agent ID
 */
async function getBuildAgentDetail(id: number | string) {
  return requestClient.post<BuildAgentApi.BuildAgent>(
    '/buildAgent/detail',
    { agentId: String(id) },
  );
}

/**
 * 下发任务到 Agent
 *
 * @param params 任务参数
 */
async function dispatchTaskToAgent(params: BuildAgentApi.DispatchTaskParams) {
  return requestClient.post('/buildAgent/dispatchTask', params);
}

export {
  createBuildAgent,
  deleteBuildAgent,
  dispatchTaskToAgent,
  getBuildAgentDetail,
  getBuildAgentList,
  updateBuildAgent,
};
