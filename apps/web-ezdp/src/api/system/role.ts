import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemRoleApi {
  export interface Role {
    id: number;
    businessLineId: number;
    businessLineName?: string;
    code: string;
    name: string;
    description?: string;
    status: 0 | 1;
    sortOrder: number;
    isSystem: number;
    isSuper: number;
    createdAt: number;
    updatedAt: number;
  }

  export interface MenuTreeNode {
    id: number;
    parentId: number;
    code: string;
    name: string;
    title: string;
    icon?: string;
    path: string;
    component?: string;
    link?: string;
    type: number;
    visible: number;
    status: number;
    sortOrder: number;
    keepAlive: number;
    alwaysShow: number;
    permissions?: string;
    children?: MenuTreeNode[];
  }
}

/**
 * 获取角色列表数据
 */
async function getRoleList(params: Recordable<any>) {
  return requestClient.post<{
    items: SystemRoleApi.Role[];
    total: number;
  }>('/role/list', params);
}

/**
 * 获取所有菜单（用于权限配置）
 */
async function getAllMenus() {
  return requestClient.get<SystemRoleApi.MenuTreeNode[]>('/role/menus');
}

/**
 * 创建角色
 * @param data 角色数据
 */
async function createRole(
  data: Omit<
    SystemRoleApi.Role,
    'businessLineName' | 'createdAt' | 'id' | 'updatedAt'
  > & {
    menuIds?: number[];
  },
) {
  return requestClient.post('/role', data);
}

/**
 * 更新角色权限
 *
 * @param id 角色 ID
 * @param data 角色权限数据
 */
async function updateRolePermissions(
  id: number | string,
  data: Partial<Omit<SystemRoleApi.Role, 'createdAt' | 'id' | 'updatedAt'>> & {
    menuIds?: number[];
  },
) {
  return requestClient.post('/role/permissions', {
    roleId: id,
    ...data,
  });
}

/**
 * 删除角色
 * @param id 角色 ID
 */
async function deleteRole(id: number | string) {
  return requestClient.delete(`/role/${id}`);
}

export {
  createRole,
  deleteRole,
  getAllMenus,
  getRoleList,
  updateRolePermissions,
};
