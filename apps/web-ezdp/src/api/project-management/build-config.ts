import { requestClient } from '#/api/request';

export namespace BuildConfigApi {
  export interface BuildConfig {
    id: string;
    projectConfigId: string;
    dockerfile: string;
    buildContext: string;
    buildArgs?: string;
    imageName: string;
    createdAt: number;
    updatedAt: number;
  }
}

/**
 * 根据项目配置ID获取打包配置
 * @param projectConfigId 项目配置ID
 */
async function getBuildConfigByProjectConfigId(
  projectConfigId: number | string,
) {
  return requestClient.post<BuildConfigApi.BuildConfig | null>(
    '/projectManagement/buildConfig/getByProjectConfigId',
    {
      projectConfigId: String(projectConfigId),
    },
  );
}

/**
 * 创建或更新打包配置
 * @param data 打包配置数据
 */
async function createOrUpdateBuildConfig(
  data: Partial<
    Omit<BuildConfigApi.BuildConfig, 'createdAt' | 'id' | 'updatedAt'>
  > & {
    projectConfigId: number | string;
  },
) {
  return requestClient.post<BuildConfigApi.BuildConfig>(
    '/projectManagement/buildConfig/createOrUpdate',
    {
      ...data,
      projectConfigId: String(data.projectConfigId),
    },
  );
}

export { createOrUpdateBuildConfig, getBuildConfigByProjectConfigId };
