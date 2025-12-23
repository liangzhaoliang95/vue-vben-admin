import type { PageResult } from '#/api/core';
import { requestClient } from '#/api/request';

export interface DeployEnvironment {
  id: string;
  businessLineId: number;
  name: string;
  description: string;
  frontendStorageId: string;
  frontendBaseUrl: string;
  backendSecretId: string;
  backendNamespace: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDeployEnvironmentParams {
  businessLineId?: number;
  name: string;
  description?: string;
  frontendStorageId?: string;
  frontendBaseUrl?: string;
  backendSecretId?: string;
  backendNamespace?: string;
  sortOrder?: number;
}

export interface UpdateDeployEnvironmentParams {
  id: string;
  name?: string;
  description?: string;
  frontendStorageId?: string;
  frontendBaseUrl?: string;
  backendSecretId?: string;
  backendNamespace?: string;
  sortOrder?: number;
}

export function getDeployEnvironmentList(params: any) {
  return requestClient.post<PageResult<DeployEnvironment>>(
    '/projectManagement/deployEnvironment/list',
    params,
  );
}

export function createDeployEnvironment(data: CreateDeployEnvironmentParams) {
  return requestClient.post<DeployEnvironment>(
    '/projectManagement/deployEnvironment/create',
    data,
  );
}

export function updateDeployEnvironment(data: UpdateDeployEnvironmentParams) {
  return requestClient.post<DeployEnvironment>(
    '/projectManagement/deployEnvironment/update',
    data,
  );
}

export function deleteDeployEnvironment(id: string) {
  return requestClient.post('/projectManagement/deployEnvironment/delete', {
    id,
  });
}

export function getDeployEnvironmentDetail(id: string) {
  return requestClient.post<DeployEnvironment>(
    '/projectManagement/deployEnvironment/detail',
    { id },
  );
}

export interface UpdateOrderItem {
  id: string;
  sortOrder: number;
}

export function updateDeployEnvironmentOrder(orders: UpdateOrderItem[]) {
  return requestClient.post('/projectManagement/deployEnvironment/updateOrder', {
    orders,
  });
}
