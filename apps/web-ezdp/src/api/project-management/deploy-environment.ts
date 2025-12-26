import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace DeployEnvironmentApi {
  export interface DeployEnvironment {
    id: string;
    businessLineId: number;
    name: string;
    description?: string;
    frontendStorageId?: string;
    frontendBaseUrl?: string;
    backendSecretId?: string;
    backendNamespace?: string;
    isAgentDeploy: boolean;
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
  }

  export interface OrderItem {
    id: string;
    sortOrder: number;
  }
}

/**
 * 获取发布环境配置列表数据
 */
async function getDeployEnvironmentList(params: Recordable<any>) {
  return requestClient.post<{
    items: DeployEnvironmentApi.DeployEnvironment[];
    total: number;
  }>('/projectManagement/deployEnvironment/list', params);
}

/**
 * 创建发布环境配置
 * @param data 发布环境配置数据
 */
async function createDeployEnvironment(
  data: Omit<
    DeployEnvironmentApi.DeployEnvironment,
    'createdAt' | 'id' | 'updatedAt'
  >,
) {
  return requestClient.post(
    '/projectManagement/deployEnvironment/create',
    data,
  );
}

/**
 * 更新发布环境配置
 *
 * @param id 发布环境配置 ID
 * @param data 发布环境配置数据
 */
async function updateDeployEnvironment(
  id: number | string,
  data: Partial<
    Omit<
      DeployEnvironmentApi.DeployEnvironment,
      'createdAt' | 'id' | 'updatedAt'
    >
  >,
) {
  return requestClient.post('/projectManagement/deployEnvironment/update', {
    id: String(id),
    ...data,
  });
}

/**
 * 删除发布环境配置
 *
 * @param id 发布环境配置 ID
 */
async function deleteDeployEnvironment(id: number | string) {
  return requestClient.post('/projectManagement/deployEnvironment/delete', {
    id: String(id),
  });
}

/**
 * 获取发布环境配置详情
 *
 * @param id 发布环境配置 ID
 */
async function getDeployEnvironmentDetail(id: number | string) {
  return requestClient.post<DeployEnvironmentApi.DeployEnvironment>(
    '/projectManagement/deployEnvironment/detail',
    { id: String(id) },
  );
}

/**
 * 更新发布环境配置排序
 *
 * @param orders 排序列表
 */
async function updateDeployEnvironmentOrder(
  orders: DeployEnvironmentApi.OrderItem[],
) {
  return requestClient.post('/projectManagement/deployEnvironment/updateOrder', {
    orders,
  });
}

export {
  createDeployEnvironment,
  deleteDeployEnvironment,
  getDeployEnvironmentDetail,
  getDeployEnvironmentList,
  updateDeployEnvironment,
  updateDeployEnvironmentOrder,
};
