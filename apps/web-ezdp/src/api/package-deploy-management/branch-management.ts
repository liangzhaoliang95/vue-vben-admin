import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace BranchManagementApi {
  export interface BranchManagement {
    id: string;
    businessLineId: number;
    name: string;
    description: string;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取分支管理列表数据
 */
async function getBranchManagementList(params: Recordable<any>) {
  return requestClient.post<{
    items: BranchManagementApi.BranchManagement[];
    total: number;
  }>('/packageDeployManagement/branchManagement/list', params);
}

/**
 * 创建分支
 * @param data 分支数据
 */
async function createBranchManagement(
  data: Omit<
    BranchManagementApi.BranchManagement,
    'createdAt' | 'id' | 'updatedAt'
  >,
) {
  return requestClient.post(
    '/packageDeployManagement/branchManagement/create',
    data,
  );
}

/**
 * 更新分支
 *
 * @param id 分支ID
 * @param data 分支数据
 */
async function updateBranchManagement(
  id: number | string,
  data: Partial<
    Omit<
      BranchManagementApi.BranchManagement,
      'createdAt' | 'id' | 'updatedAt'
    >
  >,
) {
  return requestClient.post('/packageDeployManagement/branchManagement/update', {
    id: String(id),
    ...data,
  });
}

/**
 * 删除分支
 *
 * @param id 分支ID
 */
async function deleteBranchManagement(id: number | string) {
  return requestClient.post('/packageDeployManagement/branchManagement/delete', {
    id: String(id),
  });
}

/**
 * 获取分支详情
 *
 * @param id 分支ID
 */
async function getBranchManagementDetail(id: number | string) {
  return requestClient.post<BranchManagementApi.BranchManagement>(
    '/packageDeployManagement/branchManagement/detail',
    { id: String(id) },
  );
}

export {
  createBranchManagement,
  deleteBranchManagement,
  getBranchManagementDetail,
  getBranchManagementList,
  updateBranchManagement,
};
