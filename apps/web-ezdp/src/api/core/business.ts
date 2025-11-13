import type { BusinessLineRoles, MenuTreeNode } from '@vben/stores';

import { requestClient } from '../request';

export function getBusinessLinesApi() {
  return requestClient.get<BusinessLineRoles[]>('/role/businessLines');
}

export function getRoleMenuApi(roleId: number) {
  return requestClient.post<MenuTreeNode[]>('/role/getRoleMenu', {
    roleId,
  });
}

export function getRolePowerCodesApi(roleId: number) {
  return requestClient.post<string[]>('/role/getRolePowerCodes', {
    roleId,
  });
}
