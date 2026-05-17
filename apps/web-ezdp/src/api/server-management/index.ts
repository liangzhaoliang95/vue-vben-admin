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
    id: string;
    serverId: string;
    serverName: string;
    businessLineId: number;
    serverAgentEnvironmentId: string;
    environmentName: string;
    hostname: string;
    os: string;
    arch: string;
    version: string;
    status: string;
    lastSeenAt: number;
    createdAt: number;
    updatedAt: number;
  }

  export interface ServerListParams {
    businessLineId?: number;
  }

  export interface ServerListResult {
    servers: Server[];
    count: number;
  }

  export function getServerList(params?: ServerListParams) {
    return requestClient.post<ServerListResult>(
      '/serverAgent/getServerList',
      params || {},
    );
  }

  export function updateServer(params: { id: string; serverName: string }) {
    return requestClient.post('/serverAgent/updateServer', params);
  }

  export function deleteServer(params: { id: string }) {
    return requestClient.post('/serverAgent/deleteServer', params);
  }

  // ---- 状态监控 ----

  export interface CPUStats {
    usagePercent: number;
    coreCount: number;
  }

  export interface MemStats {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  }

  export interface DiskStats {
    path: string;
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  }

  export interface NetStats {
    bytesSent: number;
    bytesRecv: number;
    packetsSent: number;
    packetsRecv: number;
  }

  export interface LoadStats {
    load1: number;
    load5: number;
    load15: number;
  }

  export interface ServerStats {
    timestamp: number;
    cpu: CPUStats;
    memory: MemStats;
    disk: DiskStats[];
    network: NetStats;
    loadAvg: LoadStats;
    uptime: number;
    processCount: number;
  }

  export function getServerStats(params: { serverId: string }) {
    return requestClient.post<{ stats: ServerStats | null; source?: string }>('/serverAgent/getServerStats', params);
  }

  export interface ServerStatsRecord {
    id: string;
    serverId: string;
    timestamp: number;
    cpuUsage: number;
    cpuCores: number;
    memTotal: number;
    memUsed: number;
    memUsedPct: number;
    diskJson: string;
    netBytesSent: number;
    netBytesRecv: number;
    load1: number;
    load5: number;
    load15: number;
    uptime: number;
    processCount: number;
  }

  export function getServerStatsHistory(params: {
    serverId: string;
    limit?: number;
    startMs?: number;
    endMs?: number;
  }) {
    return requestClient.post<{ list: ServerStatsRecord[]; count: number }>(
      '/serverAgent/getServerStatsHistory',
      params,
    );
  }

  // ---- 文件传输 ----

  export function uploadFile(serverId: string, remotePath: string, file: File) {
    const form = new FormData();
    form.append('serverId', serverId);
    form.append('remotePath', remotePath);
    form.append('file', file);
    return requestClient.post<{ message: string; remotePath: string }>(
      '/serverAgent/uploadFile',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  }

  export function downloadFile(params: { serverId: string; remotePath: string }) {
    return requestClient.post<Blob>('/serverAgent/downloadFile', params, {
      responseType: 'blob',
    });
  }

  // ---- 端口代理 ----

  export interface ProxyInfo {
    proxyId: string;
    serverId: string;
    localPort: string;
    remoteAddr: string;
    connCount: number;
  }

  export function createProxy(params: {
    serverId: string;
    localPort: string;
    remoteAddr: string;
  }) {
    return requestClient.post<{ proxyId: string; localPort: string; remoteAddr: string }>(
      '/serverAgent/createProxy',
      params,
    );
  }

  export function closeProxy(params: { proxyId: string }) {
    return requestClient.post('/serverAgent/closeProxy', params);
  }

  export function getProxyList(params?: { serverId?: string }) {
    return requestClient.post<{ proxies: ProxyInfo[] }>(
      '/serverAgent/getProxyList',
      params || {},
    );
  }
}
