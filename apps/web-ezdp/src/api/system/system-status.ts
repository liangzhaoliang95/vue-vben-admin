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

  /** 获取系统状态响应 */
  export interface GetSystemStatusResponse {
    dependencies: Record<string, BinaryDependency>;
    lastCheckAt: number;
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
