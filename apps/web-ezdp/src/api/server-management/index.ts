import { requestClient } from '#/api/request';

export namespace ServerManagementApi {
  // 环境代理相关接口
  export interface EnvironmentAgent {
    id: string;
    businessLineId: number;
    name: string;
    token: string;
    description: string;
    createdAt: number;
    updatedAt: number;
  }

  export interface EnvironmentAgentListParams {
    pageIndex: number;
    pageSize: number;
    businessLineId?: number;
  }

  export interface EnvironmentAgentListResult {
    list: EnvironmentAgent[];
    total: number;
  }

  export function getEnvironmentAgentList(params: EnvironmentAgentListParams) {
    return requestClient.post<EnvironmentAgentListResult>(
      '/serverAgent/environment/getList',
      params,
    );
  }

  export function createEnvironmentAgent(params: {
    name: string;
    description?: string;
  }) {
    return requestClient.post<EnvironmentAgent>(
      '/serverAgent/environment/create',
      params,
    );
  }

  export function updateEnvironmentAgent(params: {
    id: string;
    name: string;
    description?: string;
  }) {
    return requestClient.post<EnvironmentAgent>(
      '/serverAgent/environment/update',
      params,
    );
  }

  export function deleteEnvironmentAgent(params: { id: string }) {
    return requestClient.post('/serverAgent/environment/delete', params);
  }

  export function regenerateToken(params: { id: string }) {
    return requestClient.post<EnvironmentAgent>(
      '/serverAgent/environment/regenerateToken',
      params,
    );
  }

  // 服务器相关接口
  export interface Server {
    serverId: string;
    serverName: string;
    lastSeen: string;
  }

  export interface ServerListResult {
    servers: Server[];
    count: number;
  }

  export function getServerList() {
    return requestClient.post<ServerListResult>(
      '/serverAgent/getOnlineServers',
      {},
    );
  }
}
