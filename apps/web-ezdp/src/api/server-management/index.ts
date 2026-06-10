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
    description?: string;
    name: string;
  }) {
    return requestClient.post<EnvironmentAgent>(
      '/serverAgent/environment/create',
      params,
    );
  }

  export function updateEnvironmentAgent(params: {
    description?: string;
    id: string;
    name: string;
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
    remark: string;
    businessLineId: number;
    serverAgentEnvironmentId: string;
    environmentName: string;
    hostname: string;
    os: string;
    osVersion: string;
    arch: string;
    version: string;
    status: string;
    ipLocation: string;
    remoteIP: string;
    publicIp: string;
    privateIps: string;
    cpuModel: string;
    memTotal: number;
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

  export function updateServer(params: {
    id: string;
    remark?: string;
    serverName: string;
  }) {
    return requestClient.post('/serverAgent/updateServer', params);
  }

  export interface VNCProfile {
    enabled: boolean;
    username: string;
    password: string;
  }

  export function getVNCProfile() {
    return requestClient.post<VNCProfile>('/vncPreview/profile', {});
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
    return requestClient.post<{ source?: string; stats: null | ServerStats }>(
      '/serverAgent/getServerStats',
      params,
    );
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
    endMs?: number;
    limit?: number;
    serverId: string;
    startMs?: number;
  }) {
    return requestClient.post<{ count: number; list: ServerStatsRecord[] }>(
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

  export function downloadFile(params: {
    remotePath: string;
    serverId: string;
  }) {
    return requestClient.post<Blob>('/serverAgent/downloadFile', params, {
      responseType: 'blob',
      timeout: 5 * 60 * 1000, // 文件下载最多等待 5 分钟
    });
  }

  // ---- 文件管理 ----

  export interface FileEntry {
    name: string;
    path: string;
    isDir: boolean;
    size: number;
    modTime: number;
    mode: string;
  }

  export function listDir(params: { path?: string; serverId: string }) {
    return requestClient.post<{ entries: FileEntry[]; path: string }>(
      '/serverAgent/listDir',
      params,
    );
  }

  export function deleteFile(params: {
    path: string;
    recursive?: boolean;
    serverId: string;
  }) {
    return requestClient.post<{ message: string }>(
      '/serverAgent/deleteFile',
      params,
    );
  }

  export function mkdir(params: { path: string; serverId: string }) {
    return requestClient.post<{ message: string }>(
      '/serverAgent/mkdir',
      params,
    );
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
    localPort: string;
    remoteAddr: string;
    serverId: string;
  }) {
    return requestClient.post<{
      localPort: string;
      proxyId: string;
      remoteAddr: string;
    }>('/serverAgent/createProxy', params);
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

  // ---- 远程升级 ----

  export interface UpgradeAgentResult {
    status: 'success' | 'upgrading';
    message: string;
    stdout?: string;
  }

  export function upgradeAgent(params: { serverId: string }) {
    return requestClient.post<UpgradeAgentResult>(
      '/serverAgent/upgradeAgent',
      params,
    );
  }
}
