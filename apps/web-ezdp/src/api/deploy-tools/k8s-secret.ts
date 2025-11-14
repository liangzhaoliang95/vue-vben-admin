import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace K8sSecretApi {
  export interface K8sSecret {
    id: number;
    name: string;
    server?: string;
    namespaces: string[];
    status: 0 | 1;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取 K8s 秘钥列表数据
 */
async function getK8sSecretList(params: Recordable<any>) {
  return requestClient.post<{
    items: K8sSecretApi.K8sSecret[];
    total: number;
  }>('/deployTools/k8sSecret/list', params);
}

/**
 * 创建 K8s 秘钥
 * @param data K8s 秘钥数据
 */
async function createK8sSecret(
  data: Omit<K8sSecretApi.K8sSecret, 'createdAt' | 'id' | 'updatedAt'> & {
    kubeconfig: string;
    server?: string;
  },
) {
  return requestClient.post('/deployTools/k8sSecret/create', data);
}

/**
 * 更新 K8s 秘钥
 *
 * @param id K8s 秘钥 ID
 * @param data K8s 秘钥数据
 */
async function updateK8sSecret(
  id: number | string,
  data: Partial<
    Omit<K8sSecretApi.K8sSecret, 'createdAt' | 'id' | 'updatedAt'>
  > & {
    kubeconfig?: string;
    server?: string;
  },
) {
  return requestClient.post('/deployTools/k8sSecret/update', {
    id: String(id),
    ...data,
  });
}

/**
 * 删除 K8s 秘钥
 *
 * @param id K8s 秘钥 ID
 */
async function deleteK8sSecret(id: number | string) {
  return requestClient.post('/deployTools/k8sSecret/delete', {
    id: String(id),
  });
}

/**
 * 测试 K8s 连接
 *
 * @param data 测试连接参数
 * @param data.kubeconfig K8s 配置文件内容
 * @param data.namespaces 命名空间列表
 */
async function testK8sConnection(data: {
  kubeconfig: string;
  namespaces: string[];
}) {
  return requestClient.post<{ message: string }>(
    '/deployTools/k8sSecret/test',
    data,
  );
}

/**
 * 获取 K8s 秘钥详情（包含 kubeconfig）
 *
 * @param id K8s 秘钥 ID
 */
async function getK8sSecretDetail(id: number | string) {
  return requestClient.post<K8sSecretApi.K8sSecret & { kubeconfig: string }>(
    '/deployTools/k8sSecret/detail',
    { id: String(id) },
  );
}

export {
  createK8sSecret,
  deleteK8sSecret,
  getK8sSecretDetail,
  getK8sSecretList,
  testK8sConnection,
  updateK8sSecret,
};
