import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace DeployConfigApi {
  export interface DeployConfig {
    id: string;
    projectConfigId: string;
    deployType: 'k8s' | 'ossutil' | 'script';
    k8sType?: 'cronjob' | 'deployment';
    k8sName?: string;
    containerName?: string;
    ossName?: string;
    scriptContent?: string;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取发布配置列表数据
 */
async function getDeployConfigList(params: Recordable<any>) {
  return requestClient.post<{
    items: DeployConfigApi.DeployConfig[];
    total: number;
  }>('/projectManagement/deployConfig/list', params);
}

/**
 * 根据项目配置ID获取发布配置
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
 * 创建或更新发布配置
 * @param data 发布配置数据
 */
async function createOrUpdateDeployConfig(
  data: Partial<
    Omit<DeployConfigApi.DeployConfig, 'createdAt' | 'id' | 'updatedAt'>
  > & {
    projectConfigId: number | string;
  },
) {
  return requestClient.post<DeployConfigApi.DeployConfig>(
    '/projectManagement/deployConfig/createOrUpdate',
    {
      ...data,
      projectConfigId: String(data.projectConfigId),
    },
  );
}

/**
 * 删除发布配置
 *
 * @param id 发布配置 ID
 */
async function deleteDeployConfig(id: number | string) {
  return requestClient.post('/projectManagement/deployConfig/delete', {
    id: String(id),
  });
}

/**
 * 获取发布配置详情
 *
 * @param id 发布配置 ID
 */
async function getDeployConfigDetail(id: number | string) {
  return requestClient.post<DeployConfigApi.DeployConfig>(
    '/projectManagement/deployConfig/detail',
    { id: String(id) },
  );
}

export {
  createOrUpdateDeployConfig,
  deleteDeployConfig,
  getDeployConfigByProjectConfigId,
  getDeployConfigDetail,
  getDeployConfigList,
};
