import { requestClient } from '#/api/request';

export namespace DeployApi {
  /**
   * 部署历史项
   */
  export interface DeployHistoryItem {
    id: string;
    projectName: string;
    projectType: string;
    deployType: string;
    version: string;
    status: 'cancelled' | 'failed' | 'pending' | 'running' | 'success';
    startedAt?: number;
    finishedAt?: number;
    duration: number;
    errorMessage: string;
    deployLogs: string;
  }

  /**
   * 部署任务结果
   */
  export interface DeployTaskResult {
    deployTaskId: string;
    status: string;
  }

  /**
   * 部署任务状态结果
   */
  export interface DeployTaskStatusResult {
    deployTaskId: string;
    status: string;
    startedAt?: number;
    finishedAt?: number;
    errorMessage: string;
    histories: DeployHistoryItem[];
  }

  /**
   * 环境版本结果
   */
  export interface EnvironmentVersionResult {
    environmentId: string;
    environmentName: string;
    versionId: string;
    version: string;
    deployedAt: number;
    deployedBy: string;
  }

  /**
   * 按大版本发布参数
   */
  export interface DeployByVersionParams {
    buildVersionId: string;
    deployEnvironmentId: string;
  }

  /**
   * 按单个构建任务发布参数
   */
  export interface DeployByTaskParams {
    buildTaskId: string;
    deployEnvironmentId: string;
  }

  /**
   * 获取部署任务状态参数
   */
  export interface GetDeployTaskStatusParams {
    deployTaskId: string;
  }

  /**
   * 获取环境版本参数
   */
  export interface GetEnvironmentVersionParams {
    deployEnvironmentId: string;
  }

  /**
   * 部署历史列表参数
   */
  export interface ListDeployHistoryParams {
    pageIndex: number;
    pageSize: number;
    businessLineId?: number;
    deployEnvironmentId?: string;
    projectConfigId?: string;
  }

  /**
   * 部署历史列表结果
   */
  export interface ListDeployHistoryResult {
    items: DeployHistoryItem[];
    total: number;
  }
}

/**
 * 按大版本发布（全量）
 */
export async function deployByVersion(params: DeployApi.DeployByVersionParams) {
  return requestClient.post<DeployApi.DeployTaskResult>(
    '/deploy/deployByVersion',
    params,
  );
}

/**
 * 按大版本增量发布（对比上一次发布，只部署变更的项目）
 */
export async function deployByVersionIncremental(params: DeployApi.DeployByVersionParams) {
  return requestClient.post<DeployApi.DeployTaskResult>(
    '/deploy/deployByVersionIncremental',
    params,
  );
}

/**
 * 按单个构建任务发布
 */
export async function deployByTask(params: DeployApi.DeployByTaskParams) {
  return requestClient.post<DeployApi.DeployTaskResult>(
    '/deploy/deployByTask',
    params,
  );
}

/**
 * 获取部署任务状态
 */
export async function getDeployTaskStatus(
  params: DeployApi.GetDeployTaskStatusParams,
) {
  return requestClient.post<DeployApi.DeployTaskStatusResult>(
    '/deploy/getDeployTaskStatus',
    params,
  );
}

/**
 * 获取环境当前版本
 */
export async function getEnvironmentVersion(
  params: DeployApi.GetEnvironmentVersionParams,
) {
  return requestClient.post<DeployApi.EnvironmentVersionResult>(
    '/deploy/getEnvironmentVersion',
    params,
  );
}

/**
 * 获取部署历史列表
 */
export async function listDeployHistory(
  params: DeployApi.ListDeployHistoryParams,
) {
  return requestClient.post<DeployApi.ListDeployHistoryResult>(
    '/deploy/listDeployHistory',
    params,
  );
}
