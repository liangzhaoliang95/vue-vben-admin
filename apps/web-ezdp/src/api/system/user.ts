import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export interface User {
    id: string;
    loginName: string;
    userName: string;
    phone: string;
    email: string;
    avatar: string;
    status: 0 | 1;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取用户列表数据
 */
async function getUserList(params: Recordable<any>) {
  return requestClient.post<{
    items: SystemUserApi.User[];
    total: number;
  }>('/user/list', params);
}

/**
 * 创建用户
 * @param data 用户数据
 */
async function createUser(
  data: Omit<SystemUserApi.User, 'createdAt' | 'id' | 'updatedAt'> & {
    password: string;
  },
) {
  return requestClient.post('/user', data);
}

/**
 * 更新用户
 *
 * @param id 用户 ID
 * @param data 用户数据
 */
async function updateUser(
  id: number | string,
  data: Partial<Omit<SystemUserApi.User, 'createdAt' | 'id' | 'updatedAt'>> & {
    password?: string;
  },
) {
  return requestClient.put(`/user/${id}`, data);
}

/**
 * 删除用户
 * @param id 用户 ID
 */
async function deleteUser(id: number | string) {
  return requestClient.delete(`/user/${id}`);
}

/**
 * 获取用户权限（业务线和角色）
 * @param id 用户 ID
 */
async function getUserPermissions(id: number | string) {
  return requestClient.post<{
    items: Array<{
      businessLineId: number;
      businessLineName: string;
      roleId: number;
      roleName: string;
    }>;
  }>(`/user/permissions`, { userId: id });
}

/**
 * 保存用户权限（业务线和角色）
 * @param id 用户 ID
 * @param permissions 权限列表
 */
async function saveUserPermissions(
  id: number | string,
  permissions: Array<{
    businessLineId: number;
    roleId: number;
  }>,
) {
  return requestClient.post(`/user/permissions/save`, {
    userId: id,
    permissions,
  });
}

/**
 * 删除用户业务线
 * @param id 用户 ID
 * @param businessLineId 业务线 ID
 */
async function deleteUserBusinessLine(
  id: number | string,
  businessLineId: number,
) {
  return requestClient.delete(`/user/${id}/business-line/${businessLineId}`);
}

export {
  createUser,
  deleteUser,
  deleteUserBusinessLine,
  getUserList,
  getUserPermissions,
  saveUserPermissions,
  updateUser,
};
