import type { BusinessLineRoles, RolePowerResponse } from '@vben/stores';

import { requestClient } from '../request';

export function getBusinessLinesApi() {
  return requestClient.get<BusinessLineRoles[]>('/tk/role/businessLines');
}

export function getRolePowerApi(roleId: number) {
  return requestClient.post<RolePowerResponse>('/tk/role/getRolePower', {
    roleId,
  });
}
