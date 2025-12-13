import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace ProjectPackageApi {
  export interface BuildTask {
    id: string;
    businessLineId: number;
    projectConfigId: string;
    projectName?: string; // 项目名称
    projectType?: string; // 项目类型：backend, frontend, submodule
    branchId: string;
    version: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
    imageName: string;
    imageTag: string;
    startedAt?: number;
    finishedAt?: number;
    errorMessage: string;
    createdAt: number;
    updatedAt: number;
  }

  export interface VersionGroupItem {
    id: string; // 版本ID
    version: string; // 版本号
    status: 'building' | 'success' | 'failed'; // 构建状态
    buildTime: number; // 构建时间
    businessLineId?: number; // 业务线ID
    description?: string; // 版本描述
    children: BuildTask[]; // 子项目列表
  }

  export interface BuildTaskListParams {
    pageIndex: number;
    pageSize: number;
    projectConfigId?: string;
    branchId?: string;
    businessLineId?: number;
  }

  export interface BuildTaskListResult {
    items: VersionGroupItem[];
    total: number;
  }

  export interface StartBuildTaskParams {
    branchId: string;
    businessLineId?: number;
  }
}

/**
 * 获取打包版本列表
 */
export async function getBuildTaskList(
  params: ProjectPackageApi.BuildTaskListParams,
) {
  return requestClient.post<ProjectPackageApi.BuildTaskListResult>(
    '/packageDeployManagement/projectPackage/list',
    params,
  );
}

/**
 * 启动打包任务
 */
export async function startBuildTask(
  params: ProjectPackageApi.StartBuildTaskParams,
) {
  return requestClient.post<ProjectPackageApi.BuildTask>(
    '/packageDeployManagement/projectPackage/build',
    params,
  );
}

