import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace CdnConfigApi {
  export interface CdnConfig {
    id: string;
    businessLineId: number;
    name: string;
    provider: 'ali' | 'ecloud';
    aliAccessKey?: string;
    aliAccessSecret?: string;
    ecloudDomain?: string;
    ecloudId?: string;
    ecloudKey?: string;
    cdnDomains?: string;
    createdAt: number;
    updatedAt: number;
  }
}

export function getCdnConfigList(params: Recordable<any>) {
  return requestClient.post<{
    items: CdnConfigApi.CdnConfig[];
    total: number;
  }>('/deployTools/cdnConfig/list', params);
}

export function createCdnConfig(data: Omit<CdnConfigApi.CdnConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  return requestClient.post<CdnConfigApi.CdnConfig>('/deployTools/cdnConfig/create', data);
}

export function updateCdnConfig(id: string, data: Partial<Omit<CdnConfigApi.CdnConfig, 'id' | 'createdAt' | 'updatedAt'>>) {
  return requestClient.post<CdnConfigApi.CdnConfig>('/deployTools/cdnConfig/update', { id, ...data });
}

export function deleteCdnConfig(id: string) {
  return requestClient.post('/deployTools/cdnConfig/delete', { id });
}

export function getCdnConfigDetail(id: string) {
  return requestClient.post<CdnConfigApi.CdnConfig>('/deployTools/cdnConfig/detail', { id });
}
