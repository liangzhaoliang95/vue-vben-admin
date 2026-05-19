import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace BuildAgentApi {
  export interface BuildAgent {
    id: string;
    businessLineId: number;
    businessLineName?: string;
    name: string;
    description: string;
    status: 0 | 1 | 2 | 3; // 0=离线, 1=在线, 2=忙碌, 3=已禁用
    ipAddress: string;
    hostname: string;
    os: string;
    arch: string;
    version: string;
    osVersion: string;
    cpuCores: number;
    cpuModel: string;
    memoryTotal: number;
    diskTotal: number;
    publicIp: string;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    maxConcurrentTasks: number;
    currentTasks: number;
    totalTasks: number;
    successTasks: number;
    failedTasks: number;
    lastHeartbeatAt: number | null;
    registeredAt: number | null;
    enabled: boolean;
    sharedEnabled: boolean; // 是否开启跨业务线共享
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
      'description' | 'enabled' | 'maxConcurrentTasks' | 'name' | 'sharedEnabled' | 'tags'
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

export {
  createBuildAgent,
  deleteBuildAgent,
  getBuildAgentDetail,
  getBuildAgentList,
  updateBuildAgent,
};
