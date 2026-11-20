/**
 * 系统状态 API
 */

import { requestClient } from '#/api/request';

export namespace SystemStatusApi {
  /** 二进制依赖信息 */
  export interface BinaryDependency {
    name: string;
    description: string;
    required: boolean;
    available: boolean;
    version: string;
    path: string;
    checkedAt: number;
  }

  /** 系统监控指标 */
  export interface SystemMetrics {
    os: string;           // 操作系统
    arch: string;         // CPU架构
    numCPU: number;       // CPU核数
    goVersion: string;    // Go版本
    startTime: number;    // 启动时间（毫秒时间戳）
    uptimeMs: number;     // 运行时长（毫秒）
    restartCount: number; // 重启次数
    alloc: number;        // 当前分配内存（字节）
    totalAlloc: number;   // 累计分配内存（字节）
    sys: number;          // 从系统获取的内存（字节）
    numGoroutine: number; // goroutine数量
    appVersion: string;   // 应用版本
    buildTime: string;    // 编译时间
  }

  /** 获取系统状态响应 */
  export interface GetSystemStatusResponse {
    dependencies: Record<string, BinaryDependency>;
    lastCheckAt: number;
    systemMetrics?: SystemMetrics;
  }

  /** 检查依赖响应 */
  export interface CheckDependenciesResponse {
    dependencies: Record<string, BinaryDependency>;
    checkedAt: number;
  }
}

/**
 * 获取系统状态
 */
export async function getSystemStatus() {
  return requestClient.post<SystemStatusApi.GetSystemStatusResponse>(
    '/internal/systemStatus/getSystemStatus',
    {},
  );
}

/**
 * 立即检查依赖
 */
export async function checkDependencies() {
  return requestClient.post<SystemStatusApi.CheckDependenciesResponse>(
    '/internal/systemStatus/checkDependencies',
    {},
  );
}
