import type { Recordable } from '@vben/types';

import type { PageResult } from '#/api/core';

import { requestClient } from '#/api/request';

export namespace SystemBusinessLineApi {
  export interface BusinessLine {
    id: number;
    code: string;
    name: string;
    description?: string;
    logoUrl?: string;
    isInternal: number;
    status: 0 | 1;
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 获取业务线列表数据
 */
async function getBusinessLineList(params?: Recordable<any>) {
  return requestClient.post<PageResult<SystemBusinessLineApi.BusinessLine>>(
    '/businessLine/list',
    params || {},
  );
}

/**
 * 创建业务线
 * @param data 业务线数据
 */
async function createBusinessLine(
  data: Omit<
    SystemBusinessLineApi.BusinessLine,
    'createdAt' | 'id' | 'updatedAt'
  >,
) {
  return requestClient.post('/businessLine', data);
}

/**
 * 更新业务线
 *
 * @param id 业务线 ID
 * @param data 业务线数据
 */
async function updateBusinessLine(
  id: number | string,
  data: Partial<
    Omit<SystemBusinessLineApi.BusinessLine, 'createdAt' | 'id' | 'updatedAt'>
  >,
) {
  return requestClient.put(`/businessLine/${id}`, data);
}

/**
 * 切换当前用户的业务线
 * @param businessLineId 业务线ID
 */
async function switchBusinessLine(businessLineId: number) {
  return requestClient.post('/businessLine/switch', {
    businessLineId,
  });
}

export {
  createBusinessLine,
  getBusinessLineList,
  switchBusinessLine,
  updateBusinessLine,
};
