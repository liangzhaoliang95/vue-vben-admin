import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace DeployConfigApi {
  export interface DeployConfig {
    id: number;
    projectConfigId: number;
    k8sName?: string;
    ossName?: string;
    dockerfilePath?: string;
    upimeDeployName?: string;
    k8sType?: 'cronjob' | 'deployment';
    dockerRepo?: string;
    dockerRepoPath?: string;
    hasBuildConfig: boolean;
    hasDeployConfig: boolean;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取打包发布配置列表数据
 */
async function getDeployConfigList(params: Recordable<any>) {
  return requestClient.post<{
    items: DeployConfigApi.DeployConfig[];
    total: number;
  }>('/projectManagement/deployConfig/list', params);
}

/**
 * 根据项目配置ID获取打包发布配置
 */
async function getDeployConfigByProjectConfigId(
  projectConfigId: number | string,
) {
  return requestClient.post<DeployConfigApi.DeployConfig | null>(
    '/projectManagement/deployConfig/getByProjectConfigId',
    { projectConfigId: String(projectConfigId) },
  );
}

/**
 * 创建打包发布配置
 * @param data 打包发布配置数据
 */
async function createDeployConfig(
  data: Omit<
    DeployConfigApi.DeployConfig,
    'createdAt' | 'hasBuildConfig' | 'hasDeployConfig' | 'id' | 'updatedAt'
  >,
) {
  return requestClient.post('/projectManagement/deployConfig/create', data);
}

/**
 * 更新打包发布配置
 *
 * @param id 打包发布配置 ID
 * @param data 打包发布配置数据
 */
async function updateDeployConfig(
  id: number | string,
  data: Partial<
    Omit<
      DeployConfigApi.DeployConfig,
      'createdAt' | 'hasBuildConfig' | 'hasDeployConfig' | 'id' | 'updatedAt'
    >
  >,
) {
  return requestClient.post('/projectManagement/deployConfig/update', {
    id: String(id),
    ...data,
  });
}

/**
 * 删除打包发布配置
 *
 * @param id 打包发布配置 ID
 */
async function deleteDeployConfig(id: number | string) {
  return requestClient.post('/projectManagement/deployConfig/delete', {
    id: String(id),
  });
}

/**
 * 获取打包发布配置详情
 *
 * @param id 打包发布配置 ID
 */
async function getDeployConfigDetail(id: number | string) {
  return requestClient.post<DeployConfigApi.DeployConfig>(
    '/projectManagement/deployConfig/detail',
    { id: String(id) },
  );
}

export {
  createDeployConfig,
  deleteDeployConfig,
  getDeployConfigByProjectConfigId,
  getDeployConfigDetail,
  getDeployConfigList,
  updateDeployConfig,
};
