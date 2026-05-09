import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace GitRepoConfigApi {
  export interface GitRepoConfig {
    id: string;
    name: string;
    type: 'gitlab';
    baseUrl: string;
    committerName: string;
    committerEmail: string;
    businessLineId: number;
    createdAt: number;
    updatedAt: number;
  }

  export interface GitRepoConfigDetail extends GitRepoConfig {
    apiToken: string;
  }

  export interface TestConnectionResult {
    success: boolean;
    message: string;
  }
}

async function getGitRepoConfigList(params: Recordable<any>) {
  return requestClient.post<{
    items: GitRepoConfigApi.GitRepoConfig[];
    total: number;
  }>('/projectManagement/gitRepoConfig/list', params);
}

async function createGitRepoConfig(
  data: Omit<
    GitRepoConfigApi.GitRepoConfigDetail,
    'createdAt' | 'id' | 'updatedAt'
  >,
) {
  return requestClient.post('/projectManagement/gitRepoConfig/create', data);
}

async function updateGitRepoConfig(
  id: string,
  data: Partial<
    Omit<
      GitRepoConfigApi.GitRepoConfigDetail,
      'createdAt' | 'id' | 'updatedAt'
    >
  >,
) {
  return requestClient.post('/projectManagement/gitRepoConfig/update', {
    id,
    ...data,
  });
}

async function deleteGitRepoConfig(id: string) {
  return requestClient.post('/projectManagement/gitRepoConfig/delete', { id });
}

async function getGitRepoConfigDetail(id: string) {
  return requestClient.post<GitRepoConfigApi.GitRepoConfigDetail>(
    '/projectManagement/gitRepoConfig/detail',
    { id },
  );
}

async function testGitRepoConnection(data: {
  baseUrl: string;
  apiToken: string;
}) {
  return requestClient.post<GitRepoConfigApi.TestConnectionResult>(
    '/projectManagement/gitRepoConfig/testConnection',
    data,
  );
}

export {
  createGitRepoConfig,
  deleteGitRepoConfig,
  getGitRepoConfigDetail,
  getGitRepoConfigList,
  testGitRepoConnection,
  updateGitRepoConfig,
};
