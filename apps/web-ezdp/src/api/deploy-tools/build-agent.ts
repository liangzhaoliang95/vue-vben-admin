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
    privateIps: string; // 逗号分隔的内网IP
    cpuUsage: number;
    cpuUsagePercent: number;
    memoryUsage: number;
    memoryUsagePercent: number;
    diskUsage: number;
    diskUsagePercent: number;
    networkBytesSent: number;
    networkBytesRecv: number;
    loadAvg1: number;
    loadAvg5: number;
    loadAvg15: number;
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

  export interface UpgradeAgentResult {
    status: 'success' | 'upgrading';
    message: string;
    stdout?: string;
  }
}

export interface BuildAgentStats {
  id: string;
  agentId: string;
  timestamp: number;
  cpuUsage: number;
  cpuCores: number;
  cpuUsagePercent: number;
  memTotal: number;
  memUsed: number;
  memUsedPct: number;
  diskJson: string; // JSON 序列化的磁盘列表
  netBytesSent: number;
  netBytesRecv: number;
  load1: number;
  load5: number;
  load15: number;
  currentTasks: number;
  maxConcurrent: number;
  createdAt: number;
}

  // 磁盘分区信息
  export interface DiskInfo {
    path: string;
    total: number;
    used: number;
    free: number;
    usedPercent: number;
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

/**
 * 升级 Build Agent
 *
 * @param agentId Build Agent ID
 */
async function upgradeBuildAgent(agentId: string) {
  return requestClient.post<BuildAgentApi.UpgradeAgentResult>(
    '/buildAgent/upgradeAgent',
    { agentId },
  );
}

/**
 * 获取 Build Agent 最新状态
 *
 * @param agentId Build Agent ID
 */
async function getBuildAgentStats(agentId: string) {
  return requestClient.post<BuildAgentApi.BuildAgentStats>(
    '/buildAgent/getStats',
    { agentId },
  );
}

/**
 * 获取 Build Agent 状态历史趋势
 *
 * @param params 查询参数
 */
async function getBuildAgentStatsHistory(params: {
  agentId: string;
  startMs?: number;
  endMs?: number;
  limit?: number;
}) {
  return requestClient.post<BuildAgentApi.BuildAgentStats[]>(
    '/buildAgent/getStatsHistory',
    params,
  );
}

export {
  createBuildAgent,
  deleteBuildAgent,
  getBuildAgentDetail,
  getBuildAgentList,
  getBuildAgentStats,
  getBuildAgentStatsHistory,
  upgradeBuildAgent,
  updateBuildAgent,
};
