import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace ProjectReleaseApi {
  export interface ExecuteReleaseParams {
    projectId: string;
    branch: string;
  }

  export interface ExecuteReleaseResult {
    message: string;
    releaseId: string;
  }
}

/**
 * 执行Release
 */
async function executeRelease(params: ProjectReleaseApi.ExecuteReleaseParams) {
  return requestClient.post<ProjectReleaseApi.ExecuteReleaseResult>(
    '/projectRelease/execute',
    params,
  );
}

export { executeRelease };
