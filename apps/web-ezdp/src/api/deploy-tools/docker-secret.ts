import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace DockerSecretApi {
  export interface DockerSecret {
    id: number;
    name: string;
    host: string;
    username?: string;
    status: 0 | 1;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取 Docker 秘钥列表数据
 */
async function getDockerSecretList(params: Recordable<any>) {
  return requestClient.post<{
    items: DockerSecretApi.DockerSecret[];
    total: number;
  }>('/deployTools/dockerSecret/list', params);
}

/**
 * 创建 Docker 秘钥
 * @param data Docker 秘钥数据
 */
async function createDockerSecret(
  data: Omit<DockerSecretApi.DockerSecret, 'createdAt' | 'id' | 'updatedAt'> & {
    password?: string;
  },
) {
  return requestClient.post('/deployTools/dockerSecret/create', data);
}

/**
 * 更新 Docker 秘钥
 *
 * @param id Docker 秘钥 ID
 * @param data Docker 秘钥数据
 */
async function updateDockerSecret(
  id: number | string,
  data: Partial<
    Omit<DockerSecretApi.DockerSecret, 'createdAt' | 'id' | 'updatedAt'>
  > & {
    password?: string;
  },
) {
  return requestClient.post('/deployTools/dockerSecret/update', {
    id: String(id),
    ...data,
  });
}

/**
 * 删除 Docker 秘钥
 *
 * @param id Docker 秘钥 ID
 */
async function deleteDockerSecret(id: number | string) {
  return requestClient.post('/deployTools/dockerSecret/delete', {
    id: String(id),
  });
}

/**
 * 测试 Docker 连接
 *
 * @param data 测试连接参数
 * @param data.host Docker 主机地址
 * @param data.username Docker 用户名（可选）
 * @param data.password Docker 密码（可选）
 */
async function testDockerConnection(data: {
  host: string;
  password?: string;
  username?: string;
}) {
  return requestClient.post<{ message: string }>(
    '/deployTools/dockerSecret/test',
    data,
  );
}

/**
 * 获取 Docker 秘钥详情（包含 password）
 *
 * @param id Docker 秘钥 ID
 */
async function getDockerSecretDetail(id: number | string) {
  return requestClient.post<
    DockerSecretApi.DockerSecret & { password?: string }
  >('/deployTools/dockerSecret/detail', { id: String(id) });
}

export {
  createDockerSecret,
  deleteDockerSecret,
  getDockerSecretDetail,
  getDockerSecretList,
  testDockerConnection,
  updateDockerSecret,
};
