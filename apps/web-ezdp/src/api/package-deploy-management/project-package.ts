import { requestClient } from '#/api/request';

export namespace ProjectPackageApi {
  export interface BuildTask {
    id: string;
    businessLineId: number;
    projectConfigId: string;
    projectName?: string; // 项目名称
    projectType?: string; // 项目类型：backend, frontend, submodule
    branchId: string;
    version: string;
    status: 'cancelled' | 'failed' | 'pending' | 'running' | 'success';
    imageName: string;
    imageTag: string;
    startTime?: number;
    endTime?: number;
    duration?: number; // 构建耗时（毫秒）
    errorMessage: string;
    createdAt: number;
    updatedAt: number;
    artifactListFileContent?: string; // 构建产物列表文件内容
  }

  export interface VersionGroupItem {
    id: string; // 版本ID
    version: string; // 版本号
    status: 'building' | 'failed' | 'success'; // 构建状态
    buildTime: number; // 构建时间
    businessLineId?: number; // 业务线ID
    description?: string; // 版本描述
    children: BuildTask[]; // 子项目列表
  }

  export interface BuildTaskListParams {
    pageIndex: number;
    pageSize: number;
    projectConfigId?: string;
    branchId?: string;
    businessLineId?: number;
    showAll?: boolean;
  }

  export interface BuildTaskListResult {
    items: VersionGroupItem[];
    total: number;
  }

  export interface StartBuildTaskParams {
    branchId: string;
    businessLineId?: number;
    forceRebuild?: boolean; // 强制构建（跳过 tag 和镜像检查）
    projectIds?: string[]; // 指定构建项目ID列表（为空则构建全部）
    installDependency?: boolean; // 是否安装依赖
    androidConfig?: {
      buildType: 'debug' | 'release'; // 构建类型
      // Android 构建配置（仅当有 Android 项目时需要）
      webviewDownloadUrl: string; // WebView 下载地址
    };
  }

  export interface PreBuildCheckParams {
    branchId: string;
  }

  export interface PreBuildCheckResult {
    message: string;
  }

  export interface GetProjectChangelogParams {
    projectRecordId: string; // 项目记录ID（BuildVersionProject.id）
  }

  export interface ProjectChangelogInfo {
    projectConfigId: string; // 项目配置ID
    projectName: string; // 项目名称
    version: string; // 项目版本号
    changelog: string; // 变更日志（JSON格式）
  }
}

/**
 * 获取打包版本列表
 */
export async function getBuildTaskList(
  params: ProjectPackageApi.BuildTaskListParams,
) {
  return requestClient.post<ProjectPackageApi.BuildTaskListResult>(
    '/packageDeployManagement/projectPackage/list',
    params,
  );
}

/**
 * 启动打包任务
 */
export async function startBuildTask(
  params: ProjectPackageApi.StartBuildTaskParams,
) {
  return requestClient.post<ProjectPackageApi.BuildTask>(
    '/packageDeployManagement/projectPackage/build',
    params,
  );
}

/**
 * 触发预构建检查
 */
export async function triggerPreBuildCheck(
  params: ProjectPackageApi.PreBuildCheckParams,
) {
  return requestClient.post<ProjectPackageApi.PreBuildCheckResult>(
    '/packageDeployManagement/projectPackage/preBuildCheck',
    params,
  );
}

/**
 * 获取项目的 changelog
 */
export async function getProjectChangelog(
  params: ProjectPackageApi.GetProjectChangelogParams,
) {
  return requestClient.post<ProjectPackageApi.ProjectChangelogInfo>(
    '/packageDeployManagement/projectPackage/changelog',
    params,
  );
}
