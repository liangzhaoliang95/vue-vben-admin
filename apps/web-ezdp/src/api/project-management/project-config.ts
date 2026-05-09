import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace ProjectConfigApi {
  export interface ProjectConfig {
    id: string;
    name: string;
    projectId?: number;
    projectUrl: string;
    type: 'backend' | 'frontend' | 'submodule';
    businessLineId: number;
    hasBuildConfig?: boolean;
    hasDeployConfig?: boolean;
    createdAt: number;
    updatedAt: number;
  }

  export interface GitlabProject {
    gitlabProjectId: number;
    name: string;
    path: string;
    pathWithNamespace: string;
    namespace: string;
    nsKind: string;
    sshUrlToRepo: string;
    httpUrlToRepo: string;
    webUrl: string;
    exists: boolean;
  }

  export interface FetchGitlabProjectsParams {
    baseUrl: string;
    token: string;
  }
}

/**
 * 获取项目配置列表数据
 */
async function getProjectConfigList(params: Recordable<any>) {
  return requestClient.post<{
    items: ProjectConfigApi.ProjectConfig[];
    total: number;
  }>('/projectManagement/projectConfig/list', params);
}

/**
 * 创建项目配置
 * @param data 项目配置数据
 */
async function createProjectConfig(
  data: Omit<ProjectConfigApi.ProjectConfig, 'createdAt' | 'id' | 'updatedAt'>,
) {
  return requestClient.post('/projectManagement/projectConfig/create', data);
}

/**
 * 更新项目配置
 *
 * @param id 项目配置 ID
 * @param data 项目配置数据
 */
async function updateProjectConfig(
  id: number | string,
  data: Partial<
    Omit<ProjectConfigApi.ProjectConfig, 'createdAt' | 'id' | 'updatedAt'>
  >,
) {
  return requestClient.post('/projectManagement/projectConfig/update', {
    id: String(id),
    ...data,
  });
}

/**
 * 删除项目配置
 *
 * @param id 项目配置 ID
 */
async function deleteProjectConfig(id: number | string) {
  return requestClient.post('/projectManagement/projectConfig/delete', {
    id: String(id),
  });
}

/**
 * 获取项目配置详情
 *
 * @param id 项目配置 ID
 */
async function getProjectConfigDetail(id: number | string) {
  return requestClient.post<ProjectConfigApi.ProjectConfig>(
    '/projectManagement/projectConfig/detail',
    { id: String(id) },
  );
}

/**
 * 获取 GitLab 项目列表
 */
async function fetchGitlabProjects(data: ProjectConfigApi.FetchGitlabProjectsParams) {
  return requestClient.post<ProjectConfigApi.GitlabProject[]>(
    '/projectManagement/projectConfig/fetchGitlabProjects',
    data,
  );
}

export {
  createProjectConfig,
  deleteProjectConfig,
  fetchGitlabProjects,
  getProjectConfigDetail,
  getProjectConfigList,
  updateProjectConfig,
};
