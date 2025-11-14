import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace ObjectStorageApi {
  export interface ObjectStorage {
    id: number;
    name: string;
    provider: 'ali' | 'ecloudObs' | 'minio';
    bucket: string;
    endpoint: string;
    region?: string;
    status: 0 | 1;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取对象存储列表数据
 */
async function getObjectStorageList(params: Recordable<any>) {
  return requestClient.post<{
    items: ObjectStorageApi.ObjectStorage[];
    total: number;
  }>('/deployTools/objectStorage/list', params);
}

/**
 * 创建对象存储
 * @param data 对象存储数据
 */
async function createObjectStorage(
  data: Omit<
    ObjectStorageApi.ObjectStorage,
    'createdAt' | 'id' | 'updatedAt'
  > & {
    accessKey: string;
    accessSecret: string;
  },
) {
  return requestClient.post('/deployTools/objectStorage/create', data);
}

/**
 * 更新对象存储
 *
 * @param id 对象存储 ID
 * @param data 对象存储数据
 */
async function updateObjectStorage(
  id: number | string,
  data: Partial<
    Omit<ObjectStorageApi.ObjectStorage, 'createdAt' | 'id' | 'updatedAt'>
  > & {
    accessKey?: string;
    accessSecret?: string;
  },
) {
  return requestClient.post('/deployTools/objectStorage/update', {
    id: String(id),
    ...data,
  });
}

/**
 * 删除对象存储
 *
 * @param id 对象存储 ID
 */
async function deleteObjectStorage(id: number | string) {
  return requestClient.post('/deployTools/objectStorage/delete', {
    id: String(id),
  });
}

/**
 * 测试对象存储连接
 *
 * @param data 测试连接参数
 * @param data.provider 存储提供商类型
 * @param data.accessKey 访问密钥
 * @param data.accessSecret 访问密钥密码
 * @param data.bucket 存储桶名称
 * @param data.endpoint 端点地址
 * @param data.region 区域（可选）
 */
async function testObjectStorageConnection(data: {
  accessKey: string;
  accessSecret: string;
  bucket: string;
  endpoint: string;
  provider: 'ali' | 'huawei' | 'minio';
  region?: string;
}) {
  return requestClient.post<{ message: string }>(
    '/deployTools/objectStorage/test',
    data,
  );
}

/**
 * 获取对象存储详情（包含 accessKey 和 accessSecret）
 *
 * @param id 对象存储 ID
 */
async function getObjectStorageDetail(id: number | string) {
  return requestClient.post<
    ObjectStorageApi.ObjectStorage & {
      accessKey: string;
      accessSecret: string;
    }
  >('/deployTools/objectStorage/detail', { id: String(id) });
}

export {
  createObjectStorage,
  deleteObjectStorage,
  getObjectStorageDetail,
  getObjectStorageList,
  testObjectStorageConnection,
  updateObjectStorage,
};
