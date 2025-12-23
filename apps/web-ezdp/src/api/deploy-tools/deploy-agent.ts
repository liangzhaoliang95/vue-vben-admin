import type { PageResult } from '#/api/core';
import { requestClient } from '#/api/request';

export interface EnvironmentInfo {
  id: string;
  name: string;
  backendSecretName: string;
  backendNamespace: string;
  frontendStorageName: string;
  frontendBaseUrl: string;
}

export interface DeployAgent {
  id: string;
  businessLineId: number;
  businessLineName: string;
  name: string;
  description: string;
  status: number; // 0-未激活, 1-已激活, 2-已禁用
  environmentCount: number;
  environments: EnvironmentInfo[];
  lastActiveAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDeployAgentParams {
  businessLineId: number;
  name: string;
  description?: string;
  deployEnvironmentIds: string[];
}

export interface CreateDeployAgentResult {
  id: string;
  name: string;
  token: string;
  deployEnvironmentIds: string[];
  createdAt: number;
}

export interface UpdateDeployAgentParams {
  id: string;
  name: string;
  description?: string;
  deployEnvironmentIds: string[];
}

export function getDeployAgentList(params: any) {
  return requestClient.post<PageResult<DeployAgent>>('/deployAgent/list', params);
}

export function createDeployAgent(data: CreateDeployAgentParams) {
  return requestClient.post<CreateDeployAgentResult>('/deployAgent/create', data);
}

export function updateDeployAgent(data: UpdateDeployAgentParams) {
  return requestClient.post('/deployAgent/update', data);
}

export function deleteDeployAgent(id: string) {
  return requestClient.post('/deployAgent/delete', { id });
}

export function getDeployAgentDetail(id: string) {
  return requestClient.post('/deployAgent/detail', { id });
}
