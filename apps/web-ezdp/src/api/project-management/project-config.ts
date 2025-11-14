import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace ProjectConfigApi {
  export interface ProjectConfig {
    id: number;
    name: string;
    projectId?: number;
    projectUrl: string;
    type: 'backend' | 'frontend' | 'submodule';
    group: string;
    hasBuildConfig?: boolean;
    hasDeployConfig?: boolean;
    createdAt: number;
    updatedAt: number;
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

export {
  createProjectConfig,
  deleteProjectConfig,
  getProjectConfigDetail,
  getProjectConfigList,
  updateProjectConfig,
};
