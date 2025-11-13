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

export { createUser, deleteUser, getUserList, updateUser };
