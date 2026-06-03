<script lang="ts" setup>
import { computed, onActivated, onDeactivated, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import {
  Badge,
  Button,
  Card,
  Collapse,
  CollapsePanel,
  Empty,
  message,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';
import {
  ArrowUp10,
  FolderOpen,
  GitCompareArrows,
  Hammer,
  Monitor,
  Package,
  ServerCrash,
} from 'lucide-vue-next';

import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import {
  deployByTask,
  deployByVersion,
  deployByVersionIncremental,
  getEnvironmentVersion,
} from '#/api/package-deploy-management/deploy';
import { getBuildTaskList } from '#/api/package-deploy-management/project-package';
import {
  getDeployEnvironmentList,
  getEnvironmentProjectVersions,
} from '#/api/project-management/deploy-environment';
import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';
import { copyToClipboard } from '#/utils/clipboard';

function getProjectTypeIcon(type: string) {
  const iconMap: Record<string, any> = {
    backend: ServerCrash,
    frontend: Monitor,
    submodule: Package,
  };
  return iconMap[type] || FolderOpen;
}

const businessStore = useBusinessStore();
const wsStore = useWebSocketStore();

// 筛选条件
const selectedBusinessLineId = ref<number | undefined>();
const selectedBranchId = ref<string | undefined>();

// 发布环境列表
const deployEnvironments = ref<any[]>([]);
const selectedEnvironmentId = ref<string>();

// 所有分支数据（按业务线分组）
const allBranchesMap = ref<Map<number, any[]>>(new Map());

// 版本列表
const versionList = ref<any[]>([]);
const loading = ref(false);
const activeKeys = ref<string[]>([]); // 展开的版本面板

// 排序模式：version=版本内项目按类型排序，name=版本内项目按名称升序（版本列表本身始终按版本号降序）
const sortMode = ref<'name' | 'version'>('version');
const showImageName = ref(false);

// 版本列表始终按语义化版本号降序，排序模式只影响版本内的项目顺序
const sortedVersionList = computed(() => {
  return [...versionList.value].sort((a, b) => {
    const parts1 = (a.version || '').split('.').map(Number);
    const parts2 = (b.version || '').split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
      const n1 = parts1[i] ?? 0;
      const n2 = parts2[i] ?? 0;
      if (n1 !== n2) return n2 - n1;
    }
    return 0;
  });
});

// 当前环境正在使用的版本ID
const currentEnvironmentVersionId = ref<null | string>(null);

// 组件是否已激活的标记
const isComponentActive = ref(true);
// 是否已经初始化过
const isInitialized = ref(false);
// 是否正在初始化中（防止重复初始化）
const isInitializing = ref(false);

// 版本模态框状态
const versionModalOpen = ref(false);
const versionModalLoading = ref(false);
const deployedVersions = ref<any[]>([]);

// 是否是超级管理员
const isSuperAdmin = computed(
  () => businessStore.currentRole?.isSuper === true,
);

// 业务线选项
const businessLineOptions = computed(() => {
  return businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));
});

// 当前业务线的分支选项
const currentBranchOptions = computed(() => {
  const businessLineId = selectedBusinessLineId.value;
  if (!businessLineId) return [];

  const branches = allBranchesMap.value.get(businessLineId) || [];
  return branches.map((item) => ({
    label: item.name,
    value: item.id,
  }));
});

// 发布环境选项
const environmentOptions = computed(() => {
  return deployEnvironments.value.map((env) => ({
    label: env.name,
    value: env.id,
  }));
});

// 当前环境名称
const currentEnvironmentName = computed(() => {
  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  return environment?.name || '';
});

// 版本模态框表格列定义
const versionColumns = computed(() => [
  {
    dataIndex: 'projectName',
    key: 'projectName',
    title: $t(
      'deploy.packageDeployManagement.environmentConfig.versionModal.projectName',
    ),
    width: 200,
  },
  {
    dataIndex: 'projectType',
    key: 'projectType',
    title: $t(
      'deploy.packageDeployManagement.environmentConfig.versionModal.projectType',
    ),
    width: 120,
  },
  {
    dataIndex: 'version',
    key: 'version',
    title: $t(
      'deploy.packageDeployManagement.environmentConfig.versionModal.version',
    ),
    width: 150,
  },
  {
    dataIndex: 'deployedAt',
    key: 'deployedAt',
    title: $t(
      'deploy.packageDeployManagement.environmentConfig.versionModal.deployedAt',
    ),
    width: 180,
  },
]);

// 加载发布环境列表
async function loadDeployEnvironments(force: boolean = false) {
  // 如果已经加载过且不是强制刷新，直接返回
  if (!force && deployEnvironments.value.length > 0) {
    return;
  }

  try {
    const res = await getDeployEnvironmentList({
      page: 1,
      pageSize: 1000,
      excludeAgent: true, // 排除Agent环境，只显示Web界面可发布的环境
    });
    deployEnvironments.value = res.items || [];

    // 默认选择第一个环境
    if (deployEnvironments.value.length > 0 && !selectedEnvironmentId.value) {
      selectedEnvironmentId.value = deployEnvironments.value[0].id;
    }
  } catch (error) {
    console.error('加载发布环境失败:', error);
  }
}

// 加载指定业务线的分支数据（懒加载）
async function loadBranchesForBusinessLine(
  businessLineId: number,
  force: boolean = false,
) {
  if (!businessLineId) {
    return;
  }

  // 如果该业务线的分支已加载且不是强制刷新，直接返回
  if (!force && allBranchesMap.value.has(businessLineId)) {
    return;
  }

  try {
    const res = await getBranchManagementList({
      page: 1,
      pageSize: 1000,
      businessLineId,
      onlyEnabled: true, // 只查询启用的分支
    });
    allBranchesMap.value.set(businessLineId, res.items || []);
  } catch (error) {
    console.error(`加载业务线 ${businessLineId} 的分支失败:`, error);
    // 即使失败也设置空数组，避免重复请求
    allBranchesMap.value.set(businessLineId, []);
  }
}

// 加载当前环境的版本
async function loadCurrentEnvironmentVersion() {
  if (!selectedEnvironmentId.value) {
    currentEnvironmentVersionId.value = null;
    return;
  }

  try {
    const res = await getEnvironmentVersion({
      deployEnvironmentId: selectedEnvironmentId.value,
    });
    // 如果返回的versionId为空，说明环境还没有部署过版本
    currentEnvironmentVersionId.value = res.versionId || null;
  } catch (error: any) {
    // 其他错误情况
    console.error('获取环境版本失败:', error?.message || error);
    currentEnvironmentVersionId.value = null;
  }
}

// 加载版本列表
async function loadVersionList() {
  // 检查组件是否仍然激活
  if (!isComponentActive.value) {
    return;
  }

  if (!selectedBranchId.value) {
    versionList.value = [];
    loading.value = false;
    return;
  }

  // 注意：这里不设置 loading.value = true，由调用方控制
  // 这样可以避免在 init() 中出现 loading 闪烁

  try {
    const queryParams: any = {
      pageIndex: 1,
      pageSize: 1000,
      branchId: selectedBranchId.value,
    };

    // 超级管理员可以传业务线ID
    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    const res = await getBuildTaskList(queryParams);
    versionList.value = res.items || [];

    // 加载当前环境的版本
    await loadCurrentEnvironmentVersion();
  } catch (error) {
    console.error('加载版本列表失败:', error);
    message.error('加载版本列表失败');
  }
}

// 初始化
async function init() {
  // 如果正在初始化中，直接返回，避免重复调用
  if (isInitializing.value) {
    return;
  }

  // 如果已经初始化过，只刷新版本列表即可
  if (isInitialized.value) {
    loading.value = true;
    try {
      await loadVersionList();
    } finally {
      loading.value = false;
    }
    return;
  }

  try {
    // 设置初始化锁和加载状态
    isInitializing.value = true;
    loading.value = true;

    // 步骤1: 加载发布环境列表
    await loadDeployEnvironments();

    // 步骤2: 设置默认业务线（仅首次）
    if (!selectedBusinessLineId.value) {
      if (isSuperAdmin.value) {
        const businessLines = businessStore.businessLines;
        if (businessLines && businessLines.length > 0) {
          selectedBusinessLineId.value = businessLines[0]?.businessLine.id;
        }
      } else {
        selectedBusinessLineId.value =
          businessStore.currentBusinessLineId ?? undefined;
      }
    }

    // 步骤3: 加载当前业务线的分支数据（懒加载策略）
    if (selectedBusinessLineId.value) {
      await loadBranchesForBusinessLine(selectedBusinessLineId.value);
    }

    // 步骤4: 设置默认分支（仅首次）
    if (!selectedBranchId.value && selectedBusinessLineId.value) {
      const branches =
        allBranchesMap.value.get(selectedBusinessLineId.value) || [];
      selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
    }

    // 步骤5: 只有在分支列表和环境列表都准备好后，才加载版本列表
    await loadVersionList();

    // 订阅当前业务线的 WebSocket 日志
    if (selectedBusinessLineId.value) {
      wsStore.subscribeBusinessLine(selectedBusinessLineId.value);
    }

    // 标记为已初始化
    isInitialized.value = true;
  } finally {
    // 释放初始化锁和加载状态
    isInitializing.value = false;
    loading.value = false;
  }
}

// 业务线变化处理
async function handleBusinessLineChange(newId: number) {
  loading.value = true;
  try {
    // 加载新业务线的分支数据（如果未加载）
    await loadBranchesForBusinessLine(newId);

    const branches = allBranchesMap.value.get(newId) || [];
    selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
    await loadVersionList();

    // 订阅新业务线的 WebSocket 日志
    wsStore.subscribeBusinessLine(newId);
  } finally {
    loading.value = false;
  }
}

// 分支变化处理
async function handleBranchChange() {
  loading.value = true;
  try {
    await loadVersionList();
  } finally {
    loading.value = false;
  }
}

// 环境变化处理
async function handleEnvironmentChange(_newId: string) {
  // 加载当前环境的版本
  await loadCurrentEnvironmentVersion();
}

// 刷新
async function handleRefresh() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }
  loading.value = true;
  try {
    await loadVersionList();
    message.success('刷新成功');
  } finally {
    loading.value = false;
  }
}

// 全量获取（showAll=true，沿继承链追溯所有祖先分支的项目版本）
async function handleShowAll() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }
  loading.value = true;
  try {
    const queryParams: any = {
      pageIndex: 1,
      pageSize: 1000,
      branchId: selectedBranchId.value,
      showAll: true,
    };

    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    const res = await getBuildTaskList(queryParams);
    versionList.value = res.items || [];

    await loadCurrentEnvironmentVersion();
    message.success('全量获取成功');
  } catch (error) {
    console.error('全量获取失败:', error);
    message.error('全量获取失败');
  } finally {
    loading.value = false;
  }
}

// 排序部署版本列表
function sortDeployedVersions(versions: any[]) {
  if (!versions || !Array.isArray(versions)) {
    return [];
  }

  return [...versions].sort((a, b) => {
    // 1. 先按项目类型排序: backend -> frontend -> 其他
    const typeOrder: Record<string, number> = {
      backend: 1,
      frontend: 2,
    };

    const orderA = typeOrder[a.projectType] || 999;
    const orderB = typeOrder[b.projectType] || 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 2. 同类型按项目ID排序
    return (a.projectConfigId || '').localeCompare(b.projectConfigId || '');
  });
}

// 显示部署版本模态框
async function handleShowDeployedVersions() {
  if (!selectedEnvironmentId.value) {
    message.warning(
      $t('deploy.projectManagement.projectRelease.selectEnvironmentFirst'),
    );
    return;
  }

  versionModalOpen.value = true;
  versionModalLoading.value = true;

  try {
    const res = await getEnvironmentProjectVersions(
      selectedEnvironmentId.value,
    );
    // 对版本列表进行排序
    deployedVersions.value = sortDeployedVersions(res.list || []);
  } catch (error: any) {
    console.error('获取环境项目版本失败:', error);
    message.error(error.message || '获取环境项目版本失败');
    deployedVersions.value = [];
  } finally {
    versionModalLoading.value = false;
  }
}

// 关闭版本模态框
function handleCloseVersionModal() {
  versionModalOpen.value = false;
}

// 确认对话框
function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

// 全量部署版本（原逻辑）
async function handleFullDeploy(version: any) {
  if (!selectedEnvironmentId.value) {
    message.warning(
      $t('deploy.packageDeployManagement.projectDeploy.selectEnvironmentFirst'),
    );
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectDeploy.fullDeployConfirm', [
        version.version,
        environmentName,
      ]),
      $t('deploy.packageDeployManagement.projectDeploy.fullDeploy'),
    );

    message.loading({
      content: $t('deploy.packageDeployManagement.projectDeploy.deploying'),
      duration: 0,
      key: 'deploying',
    });

    await deployByVersion({
      buildVersionId: version.id,
      deployEnvironmentId: selectedEnvironmentId.value,
    });

    message.destroy('deploying');
    message.success(
      $t('deploy.packageDeployManagement.projectDeploy.deploySuccess'),
    );

    // 打开全局日志查看器（taskType=2 表示部署日志）
    wsStore.openGlobalLogViewer(2);

    // 延迟刷新列表和当前环境版本
    setTimeout(() => {
      if (isComponentActive.value) {
        loadVersionList();
        loadCurrentEnvironmentVersion();
      }
    }, 2000);
  } catch (error) {
    message.destroy('deploying');
    if (error instanceof Error && error.message !== '已取消') {
      console.error('发布失败:', error);
      message.error('发布失败');
    }
  }
}

// 增量部署版本（对比上一次发布，只部署变更的项目）
async function handleIncrementalDeploy(version: any) {
  if (!selectedEnvironmentId.value) {
    message.warning(
      $t('deploy.packageDeployManagement.projectDeploy.selectEnvironmentFirst'),
    );
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    await confirm(
      $t(
        'deploy.packageDeployManagement.projectDeploy.incrementalDeployConfirm',
        [version.version, environmentName],
      ),
      $t('deploy.packageDeployManagement.projectDeploy.incrementalDeploy'),
    );

    message.loading({
      content: $t('deploy.packageDeployManagement.projectDeploy.deploying'),
      duration: 0,
      key: 'deploying',
    });

    await deployByVersionIncremental({
      buildVersionId: version.id,
      deployEnvironmentId: selectedEnvironmentId.value,
    });

    message.destroy('deploying');
    message.success(
      $t('deploy.packageDeployManagement.projectDeploy.deploySuccess'),
    );

    // 打开全局日志查看器（taskType=2 表示部署日志）
    wsStore.openGlobalLogViewer(2);

    // 延迟刷新列表和当前环境版本
    setTimeout(() => {
      if (isComponentActive.value) {
        loadVersionList();
        loadCurrentEnvironmentVersion();
      }
    }, 2000);
  } catch (error) {
    message.destroy('deploying');
    if (error instanceof Error && error.message !== '已取消') {
      console.error('发布失败:', error);
      message.error('发布失败');
    }
  }
}

// 部署单个项目
async function handleDeployProject(project: any) {
  if (!selectedEnvironmentId.value) {
    message.warning(
      $t('deploy.packageDeployManagement.projectDeploy.selectEnvironmentFirst'),
    );
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectDeploy.deployConfirm', [
        project.version,
        environmentName,
      ]),
      $t('deploy.packageDeployManagement.projectDeploy.deploy'),
    );

    message.loading({
      content: $t('deploy.packageDeployManagement.projectDeploy.deploying'),
      duration: 0,
      key: 'deploying',
    });

    await deployByTask({
      buildTaskId: project.id,
      deployEnvironmentId: selectedEnvironmentId.value,
    });

    message.destroy('deploying');
    message.success(
      $t('deploy.packageDeployManagement.projectDeploy.deploySuccess'),
    );

    // 打开全局日志查看器（taskType=2 表示部署日志）
    wsStore.openGlobalLogViewer(2);

    // 延迟刷新列表和当前环境版本（单个项目部署不会改变大版本，只刷新列表）
    setTimeout(() => {
      if (isComponentActive.value) {
        loadVersionList();
      }
    }, 2000);
  } catch (error) {
    message.destroy('deploying');
    if (error instanceof Error && error.message !== '已取消') {
      console.error('发布失败:', error);
      message.error('发布失败');
    }
  }
}

// 格式化时间
function formatTime(timestamp: number) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 格式化部署时间(模态框使用)
function formatDeployedAt(timestamp: number) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 获取项目类型名称
function getProjectTypeName(type: string) {
  const keyMap: Record<string, string> = {
    backend: 'deploy.packageDeployManagement.projectDeploy.projectTypeBackend',
    frontend:
      'deploy.packageDeployManagement.projectDeploy.projectTypeFrontend',
    submodule:
      'deploy.packageDeployManagement.projectDeploy.projectTypeSubmodule',
  };
  const key = keyMap[type];
  return key
    ? $t(key)
    : type ||
        $t('deploy.packageDeployManagement.projectDeploy.projectTypeDefault');
}

// 获取项目类型标签颜色(模态框使用)
function getProjectTypeColor(type: string) {
  if (type === 'frontend') return 'blue';
  if (type === 'backend') return 'green';
  return 'default';
}

// 获取项目类型文本(模态框使用)
function getProjectTypeText(type: string) {
  if (type === 'frontend') {
    return $t(
      'deploy.packageDeployManagement.environmentConfig.versionModal.frontend',
    );
  }
  if (type === 'backend') {
    return $t(
      'deploy.packageDeployManagement.environmentConfig.versionModal.backend',
    );
  }
  return type;
}

// 排序项目列表
function getSortedProjects(projects: any[]) {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }

  if (sortMode.value === 'name') {
    return [...projects].sort((a, b) =>
      (a.projectName || '').localeCompare(b.projectName || ''),
    );
  }

  return [...projects].sort((a, b) => {
    const typeOrder: Record<string, number> = {
      backend: 1,
      submodule: 2,
      frontend: 3,
    };

    const orderA = typeOrder[a.projectType] || 999;
    const orderB = typeOrder[b.projectType] || 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 同类型内按版本号降序（语义化版本比较）
    const versionCompare = (v1: string, v2: string) => {
      const parts1 = (v1 || '').split('.').map(Number);
      const parts2 = (v2 || '').split('.').map(Number);
      const len = Math.max(parts1.length, parts2.length);
      for (let i = 0; i < len; i++) {
        const n1 = parts1[i] ?? 0;
        const n2 = parts2[i] ?? 0;
        if (n1 !== n2) return n2 - n1;
      }
      return 0;
    };
    const versionDiff = versionCompare(a.version, b.version);
    if (versionDiff !== 0) return versionDiff;

    return (a.projectName || '').localeCompare(b.projectName || '');
  });
}

// 获取状态标签配置
function getStatusConfig(status: string) {
  const statusConfig: Record<string, { color: string; text: string }> = {
    pending: {
      color: 'default',
      text: $t('deploy.packageDeployManagement.projectDeploy.status.pending'),
    },
    building: {
      color: 'processing',
      text: $t('deploy.packageDeployManagement.projectDeploy.status.building'),
    },
    running: {
      color: 'processing',
      text: $t('deploy.packageDeployManagement.projectDeploy.status.running'),
    },
    success: {
      color: 'success',
      text: $t('deploy.packageDeployManagement.projectDeploy.status.success'),
    },
    failed: {
      color: 'error',
      text: $t('deploy.packageDeployManagement.projectDeploy.status.failed'),
    },
    skipped: {
      color: 'warning',
      text: $t('deploy.packageDeployManagement.projectDeploy.status.skipped'),
    },
  };
  return statusConfig[status] || statusConfig.pending;
}

// 获取大版本状态标签配置
function getVersionStatusConfig(status: string) {
  const statusConfig: Record<string, { color: string; text: string }> = {
    building: {
      color: 'processing',
      text: $t(
        'deploy.packageDeployManagement.projectDeploy.versionStatus.building',
      ),
    },
    success: {
      color: 'success',
      text: $t(
        'deploy.packageDeployManagement.projectDeploy.versionStatus.success',
      ),
    },
    failed: {
      color: 'error',
      text: $t(
        'deploy.packageDeployManagement.projectDeploy.versionStatus.failed',
      ),
    },
  };
  return statusConfig[status] || statusConfig.building;
}

// WebSocket 消息处理器
function handleWebSocketMessage(message: any) {
  // 只处理事件类型的消息
  if (message.commandType === 'event' && message.commandId === 1) {
    const { eventType } = message.data;

    // 处理构建完成事件（刷新版本列表）
    if (eventType === 'build_completed' && isComponentActive.value) {
      loadVersionList();
      message.success('构建已完成，版本列表已更新');
    }

    // 处理部署完成事件（刷新版本列表）
    if (eventType === 'deploy_completed' && isComponentActive.value) {
      loadVersionList();
      message.success(`部署已完成: ${message.data.version || ''}`);
    }
  }
}

// 路由激活时初始化
onActivated(async () => {
  // 标记组件为激活状态
  isComponentActive.value = true;

  try {
    await init();

    // 订阅 WebSocket 事件消息（用于接收构建完成等事件）
    await wsStore.subscribe('deploy-event-listener', handleWebSocketMessage);
  } catch (error) {
    console.error('onActivated 初始化失败:', error);
  }
});

// changelog modal 状态
const changelogModalOpen = ref(false);
const changelogVersion = ref<any>(null);

// 解析 changelog JSON
const changelogCommits = computed(() => {
  if (!changelogVersion.value?.changelog) return [];
  try {
    return JSON.parse(changelogVersion.value.changelog);
  } catch {
    return [];
  }
});

// 打开 changelog modal
function openChangelog(version: any) {
  changelogVersion.value = version;
  changelogModalOpen.value = true;
}

// 格式化 commit 时间
function formatDuration(ms: number) {
  if (!ms || ms <= 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCommitTime(ms: number) {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 复制版本为 Markdown 表格
async function copyVersionAsMarkdown(version: any) {
  if (!version.children || version.children.length === 0) {
    message.warning(
      $t('deploy.packageDeployManagement.projectDeploy.noProjectData'),
    );
    return;
  }
  try {
    const versionHeader = `## 版本 ${version.version}\n\n`;
    const versionInfo = `**构建时间:** ${formatTime(version.buildTime)}\n\n`;
    const headers = ['项目名称', '项目类型', '版本号'];
    const separator = ['---', '---', '---'];
    const rows = getSortedProjects(version.children).map((project: any) => [
      project.projectName || '-',
      getProjectTypeName(project.projectType || ''),
      project.version || '-',
    ]);
    const markdownTable = [
      `| ${headers.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
    await copyToClipboard(versionHeader + versionInfo + markdownTable);
    message.success(
      $t('deploy.packageDeployManagement.projectDeploy.copyAsMarkdownSuccess'),
    );
  } catch {
    message.error(
      $t('deploy.packageDeployManagement.projectDeploy.copyFailed'),
    );
  }
}

// 复制版本为 JSON
async function copyVersionAsJson(version: any) {
  if (!version.children || version.children.length === 0) {
    message.warning(
      $t('deploy.packageDeployManagement.projectDeploy.noProjectData'),
    );
    return;
  }
  try {
    const obj: Record<string, string> = { version: version.version || '' };
    for (const project of getSortedProjects(version.children)) {
      if (project.projectName && project.version) {
        obj[project.projectName] = project.version;
      }
    }
    await copyToClipboard(JSON.stringify(obj, null, 4));
    message.success(
      $t('deploy.packageDeployManagement.projectDeploy.copyAsJsonSuccess'),
    );
  } catch {
    message.error(
      $t('deploy.packageDeployManagement.projectDeploy.copyFailed'),
    );
  }
}

// 复制版本为 YAML ConfigMap
async function copyVersionAsYaml(version: any) {
  if (!version.children || version.children.length === 0) {
    message.warning(
      $t('deploy.packageDeployManagement.projectDeploy.noProjectData'),
    );
    return;
  }
  try {
    const backendProjects = getSortedProjects(version.children).filter(
      (p) => p.projectType !== 'frontend',
    );
    const frontendProjects = getSortedProjects(version.children).filter(
      (p) => p.projectType === 'frontend',
    );
    const lines: string[] = [
      'apiVersion: v1',
      'kind: ConfigMap',
      'metadata:',
      '  name: plaso-version',
      'data:',
      `  version: "${version.version || ''}"`,
    ];
    if (backendProjects.length > 0) {
      lines.push('  # 后端项目');
      for (const p of backendProjects) {
        if (p.projectName && p.version) {
          lines.push(`  ${p.projectName}: "${p.version}"`);
        }
      }
    }
    if (frontendProjects.length > 0) {
      lines.push('  # 前端项目');
      for (const p of frontendProjects) {
        if (p.projectName && p.version) {
          lines.push(`  ${p.projectName}: "${p.version}"`);
        }
      }
    }
    await copyToClipboard(lines.join('\n'));
    message.success(
      $t('deploy.packageDeployManagement.projectDeploy.copyAsYamlSuccess'),
    );
  } catch {
    message.error(
      $t('deploy.packageDeployManagement.projectDeploy.copyFailed'),
    );
  }
}

// 路由切换时清理资源
onDeactivated(() => {
  try {
    // 标记组件为非激活状态
    isComponentActive.value = false;

    // 取消构建事件监听
    wsStore.unsubscribe('deploy-event-listener');

    // 注意：不要调用 unsubscribeBusinessLine()
    // WebSocket 连接是全局共享的，其他页面可能还在使用

    // 清空版本列表状态，但保留其他缓存数据（环境、分支等）
    versionList.value = [];
    activeKeys.value = [];

    // 保留 isInitialized 标记，避免重新初始化时重复加载环境和分支数据
  } catch (error) {
    console.error('onDeactivated 清理失败:', error);
  }
});
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full flex-col gap-4">
      <!-- 筛选条件区 -->
      <Card class="flex-shrink-0">
        <div class="flex w-full items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-4">
            <!-- 业务线筛选(仅超级管理员) -->
            <div v-if="isSuperAdmin" class="flex items-center gap-2">
              <span class="filter-label">
                {{ $t('system.businessLine.name') }}:
              </span>
              <Select
                v-model:value="selectedBusinessLineId"
                :options="businessLineOptions"
                :placeholder="$t('system.businessLine.name')"
                class="w-48"
                @change="handleBusinessLineChange"
              />
            </div>

            <!-- 分支筛选 -->
            <div class="flex items-center gap-2">
              <span class="filter-label">
                {{ $t('deploy.packageDeployManagement.projectDeploy.branch') }}:
              </span>
              <Select
                v-model:value="selectedBranchId"
                :options="currentBranchOptions"
                :placeholder="
                  $t(
                    'deploy.packageDeployManagement.projectDeploy.branchPlaceholder',
                  )
                "
                class="w-48"
                @change="handleBranchChange"
              />
            </div>

            <!-- 发布环境选择 -->
            <div class="flex items-center gap-2">
              <span class="filter-label">
                {{
                  $t(
                    'deploy.packageDeployManagement.projectDeploy.deployEnvironment',
                  )
                }}:
              </span>
              <Select
                v-model:value="selectedEnvironmentId"
                :options="environmentOptions"
                :placeholder="
                  $t(
                    'deploy.packageDeployManagement.projectDeploy.deployEnvironmentPlaceholder',
                  )
                "
                class="w-48"
                @change="handleEnvironmentChange"
              />
            </div>
          </div>

          <!-- 操作按钮组 -->
          <div class="flex flex-shrink-0 items-center gap-3">
            <Button type="primary" @click="handleShowDeployedVersions">
              <GitCompareArrows class="mr-1 size-4" />
              {{
                $t('deploy.projectManagement.projectRelease.deployedVersions')
              }}
            </Button>
            <Select
              v-model:value="sortMode"
              class="w-36"
              :options="[
                {
                  label: $t(
                    'deploy.packageDeployManagement.projectDeploy.sortOrderVersion',
                  ),
                  value: 'version',
                },
                {
                  label: $t(
                    'deploy.packageDeployManagement.projectDeploy.sortOrderName',
                  ),
                  value: 'name',
                },
              ]"
            />
            <Button @click="handleRefresh">
              {{ $t('deploy.packageDeployManagement.projectDeploy.refresh') }}
            </Button>
            <Button @click="handleShowAll">
              {{ $t('deploy.packageDeployManagement.projectPackage.showAll') }}
            </Button>
            <Button
              :type="showImageName ? 'primary' : 'default'"
              @click="showImageName = !showImageName"
            >
              {{
                $t('deploy.packageDeployManagement.projectDeploy.showImageName')
              }}
            </Button>
          </div>
        </div>
      </Card>

      <!-- 版本列表 -->
      <Card class="flex-1 overflow-y-auto">
        <Spin :spinning="loading">
          <div
            v-if="versionList.length === 0"
            class="flex items-center justify-center py-20"
          >
            <Empty :description="$t('common.noData')" />
          </div>

          <Collapse
            v-else
            v-model:active-key="activeKeys"
            :bordered="false"
            expand-icon-position="start"
            class="version-collapse"
          >
            <CollapsePanel
              v-for="version in sortedVersionList"
              :key="version.id"
            >
              <template #header>
                <div class="flex w-full items-center justify-between pr-4">
                  <div class="flex items-center gap-4">
                    <Badge
                      :count="version.children?.length || 0"
                      :overflow-count="99"
                      :number-style="{ backgroundColor: '#52c41a' }"
                    >
                      <div class="version-title">
                        {{ version.version }}
                      </div>
                    </Badge>
                    <Tag
                      :color="
                        getVersionStatusConfig(
                          (version && version.status) || 'building',
                        ).color
                      "
                      class="version-status-tag"
                    >
                      {{
                        getVersionStatusConfig(
                          (version && version.status) || 'building',
                        ).text
                      }}
                    </Tag>
                    <span class="version-time">
                      {{ formatTime(version.buildTime) }}
                    </span>
                    <!-- 当前版本标记 -->
                    <Tag
                      v-if="version.id === currentEnvironmentVersionId"
                      color="green"
                      class="current-version-tag"
                    >
                      ✓
                      {{
                        $t(
                          'deploy.packageDeployManagement.projectDeploy.currentVersion',
                        )
                      }}
                    </Tag>
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- 复制按钮组 -->
                    <div class="flex items-center gap-1">
                      <Tooltip
                        :title="
                          $t(
                            'deploy.packageDeployManagement.projectDeploy.copyAsMarkdown',
                          )
                        "
                      >
                        <Button
                          size="small"
                          type="text"
                          @click.stop="copyVersionAsMarkdown(version)"
                        >
                          <template #icon>
                            <!-- MD icon -->
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="8" y1="13" x2="10" y2="11" />
                              <polyline points="8 17 10 15 12 17 14 15 16 17" />
                              <line x1="16" y1="13" x2="14" y2="11" />
                            </svg>
                          </template>
                        </Button>
                      </Tooltip>
                      <Tooltip
                        :title="
                          $t(
                            'deploy.packageDeployManagement.projectDeploy.copyAsJson',
                          )
                        "
                      >
                        <Button
                          size="small"
                          type="text"
                          @click.stop="copyVersionAsJson(version)"
                        >
                          <template #icon>
                            <!-- JSON icon (curly braces) -->
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
                              <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
                            </svg>
                          </template>
                        </Button>
                      </Tooltip>
                      <Tooltip
                        :title="
                          $t(
                            'deploy.packageDeployManagement.projectDeploy.copyAsYaml',
                          )
                        "
                      >
                        <Button
                          size="small"
                          type="text"
                          @click.stop="copyVersionAsYaml(version)"
                        >
                          <template #icon>
                            <!-- YAML icon (indented lines) -->
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <line x1="4" y1="6" x2="20" y2="6" />
                              <line x1="8" y1="10" x2="20" y2="10" />
                              <line x1="8" y1="14" x2="20" y2="14" />
                              <line x1="4" y1="18" x2="20" y2="18" />
                            </svg>
                          </template>
                        </Button>
                      </Tooltip>
                    </div>
                    <!-- 变更日志按钮 -->
                    <span
                      v-if="version.changelog"
                      class="changelog-btn"
                      @click.stop="openChangelog(version)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="13"
                        height="13"
                        viewBox="0 0 92 92"
                        fill="currentColor"
                        style="flex-shrink: 0"
                      >
                        <path
                          d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.672 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66L49.73 33.516v27.085a7.03 7.03 0 0 1 1.86 1.297 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.04 7.04 0 0 1 0-9.957 7.074 7.074 0 0 1 2.304-1.539V33.035a7.07 7.07 0 0 1-2.304-1.535 7.047 7.047 0 0 1-1.516-7.7L29.945 13.234 1.734 41.445a5.918 5.918 0 0 0 0 8.371l40.12 40.121a5.918 5.918 0 0 0 8.372 0l39.93-39.934a5.925 5.925 0 0 0 0-8.038z"
                        />
                      </svg>
                      提交记录
                    </span>
                    <Button
                      type="primary"
                      size="large"
                      :disabled="version.status !== 'success'"
                      @click.stop="handleIncrementalDeploy(version)"
                    >
                      <ArrowUp10 />
                      {{
                        $t(
                          'deploy.packageDeployManagement.projectDeploy.incrementalDeploy',
                        )
                      }}
                    </Button>
                    <Button
                      danger
                      type="primary"
                      size="large"
                      :disabled="version.status !== 'success'"
                      @click.stop="handleFullDeploy(version)"
                    >
                      <Hammer />
                      {{
                        $t(
                          'deploy.packageDeployManagement.projectDeploy.fullDeploy',
                        )
                      }}
                    </Button>
                  </div>
                </div>
              </template>

              <!-- 项目列表两列布局 -->
              <div
                class="project-list-columns"
                :class="{
                  'project-list-columns--single':
                    getSortedProjects(version.children).filter(
                      (p) => p.projectType !== 'frontend',
                    ).length === 0 ||
                    getSortedProjects(version.children).filter(
                      (p) => p.projectType === 'frontend',
                    ).length === 0,
                }"
              >
                <!-- 服务端列 -->
                <div
                  v-if="
                    getSortedProjects(version.children).some(
                      (p) => p.projectType !== 'frontend',
                    )
                  "
                  class="project-column"
                >
                  <div class="project-column-body">
                    <template
                      v-for="project in getSortedProjects(version.children)"
                      :key="project.id"
                    >
                      <div
                        v-if="project.projectType !== 'frontend'"
                        class="project-item"
                        :class="[
                          `project-type-${project.projectType || 'default'}`,
                        ]"
                      >
                        <div class="project-name-col">
                          <div class="project-name-wrapper">
                            <span class="project-name">{{
                              project.projectName || '-'
                            }}</span>
                            <span
                              v-if="
                                !!(
                                  project.version &&
                                  project.version === version.version
                                )
                              "
                              class="new-badge"
                              >NEW</span>
                          </div>
                          <span
                            v-if="showImageName && project.imageName"
                            class="project-image-name"
                            >{{ project.imageName }}{{
                              project.imageTag ? `:${project.imageTag}` : ''
                            }}</span>
                        </div>
                        <span
                          v-if="project.duration && project.duration > 0"
                          class="duration-text"
                        >
                          ⏱️ {{ formatDuration(project.duration) }}
                        </span>
                        <span v-else class="duration-text"></span>
                        <Tag color="blue" class="project-type-tag">
                          <span class="project-type-tag-inner">
                            <component
                              :is="
                                getProjectTypeIcon(project.projectType || '')
                              "
                              :size="15"
                              class="project-type-icon"
                              :class="`project-type-icon--${project.projectType || 'default'}`"
                            />
                            {{ getProjectTypeName(project.projectType || '') }}
                          </span>
                        </Tag>
                        <Tag
                          color="red"
                          class="version-tag version-tag--copyable"
                          :title="
                            project.version ? '点击复制版本号' : undefined
                          "
                          @click.stop="
                            project.version &&
                            copyToClipboard(project.version).then(() =>
                              message.success(`已复制：${project.version}`),
                            )
                          "
                        >
                          {{ project.version || '-' }}
                        </Tag>
                        <span
                          class="changelog-btn"
                          :class="{
                            'changelog-btn--empty': !project.changelog,
                          }"
                          @click.stop="
                            project.changelog && openChangelog(project)
                          "
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="11"
                            height="11"
                            viewBox="0 0 92 92"
                            fill="currentColor"
                            style="flex-shrink: 0"
                          >
                            <path
                              d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.672 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66L49.73 33.516v27.085a7.03 7.03 0 0 1 1.86 1.297 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.04 7.04 0 0 1 0-9.957 7.074 7.074 0 0 1 2.304-1.539V33.035a7.07 7.07 0 0 1-2.304-1.535 7.047 7.047 0 0 1-1.516-7.7L29.945 13.234 1.734 41.445a5.918 5.918 0 0 0 0 8.371l40.12 40.121a5.918 5.918 0 0 0 8.372 0l39.93-39.934a5.925 5.925 0 0 0 0-8.038z"
                            />
                          </svg>
                          {{
                            $t(
                              'deploy.packageDeployManagement.projectDeploy.commitLog',
                            )
                          }}
                        </span>
                        <div class="project-actions">
                          <Tag
                            v-if="(project && project.status) !== 'success'"
                            :color="
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).color
                            "
                            class="status-tag"
                          >
                            {{
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).text
                            }}
                          </Tag>
                          <Button
                            type="primary"
                            size="small"
                            :disabled="project.status !== 'success'"
                            @click.stop="handleDeployProject(project)"
                          >
                            {{
                              $t(
                                'deploy.packageDeployManagement.projectDeploy.deploy',
                              )
                            }}
                          </Button>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
                <!-- 前端列 -->
                <div
                  v-if="
                    getSortedProjects(version.children).some(
                      (p) => p.projectType === 'frontend',
                    )
                  "
                  class="project-column"
                >
                  <div class="project-column-body">
                    <template
                      v-for="project in getSortedProjects(version.children)"
                      :key="project.id"
                    >
                      <div
                        v-if="project.projectType === 'frontend'"
                        class="project-item"
                        :class="[
                          `project-type-${project.projectType || 'default'}`,
                        ]"
                      >
                        <div class="project-name-col">
                          <div class="project-name-wrapper">
                            <span class="project-name">{{
                              project.projectName || '-'
                            }}</span>
                            <span
                              v-if="
                                !!(
                                  project.version &&
                                  project.version === version.version
                                )
                              "
                              class="new-badge"
                              >NEW</span>
                          </div>
                          <span
                            v-if="showImageName && project.imageName"
                            class="project-image-name"
                            >{{ project.imageName }}{{
                              project.imageTag ? `:${project.imageTag}` : ''
                            }}</span>
                        </div>
                        <span
                          v-if="project.duration && project.duration > 0"
                          class="duration-text"
                        >
                          ⏱️ {{ formatDuration(project.duration) }}
                        </span>
                        <span v-else class="duration-text"></span>
                        <Tag color="blue" class="project-type-tag">
                          <span class="project-type-tag-inner">
                            <component
                              :is="
                                getProjectTypeIcon(project.projectType || '')
                              "
                              :size="15"
                              class="project-type-icon"
                              :class="`project-type-icon--${project.projectType || 'default'}`"
                            />
                            {{ getProjectTypeName(project.projectType || '') }}
                          </span>
                        </Tag>
                        <Tag
                          color="red"
                          class="version-tag version-tag--copyable"
                          :title="
                            project.version ? '点击复制版本号' : undefined
                          "
                          @click.stop="
                            project.version &&
                            copyToClipboard(project.version).then(() =>
                              message.success(`已复制：${project.version}`),
                            )
                          "
                        >
                          {{ project.version || '-' }}
                        </Tag>
                        <span
                          class="changelog-btn"
                          :class="{
                            'changelog-btn--empty': !project.changelog,
                          }"
                          @click.stop="
                            project.changelog && openChangelog(project)
                          "
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="11"
                            height="11"
                            viewBox="0 0 92 92"
                            fill="currentColor"
                            style="flex-shrink: 0"
                          >
                            <path
                              d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.672 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66L49.73 33.516v27.085a7.03 7.03 0 0 1 1.86 1.297 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.04 7.04 0 0 1 0-9.957 7.074 7.074 0 0 1 2.304-1.539V33.035a7.07 7.07 0 0 1-2.304-1.535 7.047 7.047 0 0 1-1.516-7.7L29.945 13.234 1.734 41.445a5.918 5.918 0 0 0 0 8.371l40.12 40.121a5.918 5.918 0 0 0 8.372 0l39.93-39.934a5.925 5.925 0 0 0 0-8.038z"
                            />
                          </svg>
                          {{
                            $t(
                              'deploy.packageDeployManagement.projectDeploy.commitLog',
                            )
                          }}
                        </span>
                        <div class="project-actions">
                          <Tag
                            v-if="(project && project.status) !== 'success'"
                            :color="
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).color
                            "
                            class="status-tag"
                          >
                            {{
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).text
                            }}
                          </Tag>
                          <Button
                            type="primary"
                            size="small"
                            :disabled="project.status !== 'success'"
                            @click.stop="handleDeployProject(project)"
                          >
                            {{
                              $t(
                                'deploy.packageDeployManagement.projectDeploy.deploy',
                              )
                            }}
                          </Button>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </CollapsePanel>
          </Collapse>
        </Spin>
      </Card>
    </div>
    <!-- end flex container -->

    <!-- 部署版本模态框 -->
    <Modal
      v-model:open="versionModalOpen"
      :title="
        $t(
          'deploy.packageDeployManagement.environmentConfig.versionModal.title',
          [currentEnvironmentName],
        )
      "
      width="800px"
      :footer="null"
      @cancel="handleCloseVersionModal"
    >
      <Table
        :columns="versionColumns"
        :data-source="deployedVersions"
        :loading="versionModalLoading"
        :pagination="false"
        :scroll="{ y: 400 }"
        row-key="projectConfigId"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'projectType'">
            <Tag :color="getProjectTypeColor(record.projectType)">
              {{ getProjectTypeText(record.projectType) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'deployedAt'">
            {{ formatDeployedAt(record.deployedAt) }}
          </template>
        </template>
        <template #emptyText>
          <div style="padding: 40px 0; color: #999; text-align: center">
            {{
              $t(
                'deploy.packageDeployManagement.environmentConfig.versionModal.noData',
              )
            }}
          </div>
        </template>
      </Table>
    </Modal>

    <!-- Changelog Modal -->
    <Modal
      v-model:open="changelogModalOpen"
      :title="
        $t('deploy.packageDeployManagement.projectDeploy.changelogTitle', [
          changelogVersion?.version,
        ])
      "
      :footer="null"
      width="800px"
    >
      <div
        v-if="changelogCommits.length === 0"
        class="py-8 text-center text-gray-400"
      >
        {{ $t('deploy.packageDeployManagement.projectDeploy.changelogEmpty') }}
      </div>
      <div v-else class="changelog-list">
        <div
          v-for="commit in changelogCommits"
          :key="commit.id"
          class="changelog-item"
        >
          <span class="commit-title">{{ commit.title }}</span>
          <div class="commit-meta">
            <Tag color="warning" class="commit-id-tag">
              {{ commit.shortId }}
            </Tag>
            <Tag color="blue" class="commit-author-tag">
              {{ commit.authorName }}
            </Tag>
            <Tag class="commit-time-tag">
              {{ formatCommitTime(commit.committedAt) }}
            </Tag>
          </div>
        </div>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
@import '../project-list-shared.css';

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

/* project-deploy 独有：项目列表列宽 */
.project-item {
  grid-template-columns: repeat(6, 1fr);
  column-gap: 8px;
}

.project-item > * {
  justify-self: end;
}

.project-item > :first-child {
  justify-self: start;
}

.project-item .project-type-tag,
.project-item .version-tag,
.project-item .status-tag {
  justify-self: end;
}

.version-tag--copyable {
  cursor: pointer;
  user-select: none;
}

.version-tag--copyable:hover {
  opacity: 0.8;
}

.project-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
}

.project-item .duration-text {
  justify-self: end;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: default;
}

/* 发布按钮样式 */
.project-item :deep(.ant-btn-sm) {
  justify-self: end;
  height: 28px;
  padding: 0 12px;
  font-size: 13px;
}

.project-type-tag-inner {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

:deep(.project-type-icon--backend) {
  color: #69b1ff;
}

:deep(.project-type-icon--frontend) {
  color: #95de64;
}

:deep(.project-type-icon--submodule) {
  color: #ffd666;
}

:deep(.project-type-icon--default) {
  color: #d9d9d9;
}

.current-version-tag {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  animation: pulse 2s ease-in-out infinite;
}

/* 版本模态框表格样式 */
:deep(.ant-modal .ant-table) {
  font-size: 14px;
}

:deep(.ant-modal .ant-table-thead > tr > th) {
  font-weight: 600;
  color: rgb(0 0 0 / 85%);
  background-color: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

/* 深色模式 */
:deep(.dark .ant-modal .ant-table-thead > tr > th) {
  color: rgb(255 255 255 / 85%);
  background-color: rgb(255 255 255 / 8%);
  border-bottom: 1px solid rgb(255 255 255 / 12%);
}

:deep(.dark .ant-modal .ant-table) {
  color: rgb(255 255 255 / 85%);
}

:deep(.dark .ant-modal .ant-table-tbody > tr > td) {
  border-bottom: 1px solid rgb(255 255 255 / 6%);
}

:deep(.dark .ant-modal .ant-table-tbody > tr:hover > td) {
  background-color: rgb(255 255 255 / 4%);
}

.changelog-btn {
  display: inline-flex;
  flex-shrink: 0;
  gap: 4px;
  align-items: center;
  height: 22px;
  padding: 2px 7px;
  font-size: 12px;
  line-height: 1;
  vertical-align: middle;
  color: #f05033;
  cursor: pointer;
  border: 1px solid #f05033;
  border-radius: 4px;
  opacity: 0.85;
  transition:
    opacity 0.15s,
    background-color 0.15s;
}

.changelog-btn:hover {
  background-color: rgb(240 80 51 / 8%);
  opacity: 1;
}

.changelog-btn--empty {
  color: hsl(var(--muted-foreground));
  cursor: default;
  border-color: hsl(var(--border));
  opacity: 0.4;
}

.changelog-btn--empty:hover {
  background-color: transparent;
  opacity: 0.4;
}

.changelog-placeholder {
  display: block;
}

.project-name-wrapper {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.new-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 16px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  letter-spacing: 0.5px;
  background: #52c41a;
  border-radius: 3px;
}

.changelog-list {
  max-height: 60vh;
  overflow-y: auto;
}

.changelog-item {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid hsl(var(--border));
}

.changelog-item:last-child {
  border-bottom: none;
}

.commit-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.4;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.commit-meta {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 90px 110px 140px;
  gap: 6px;
  align-items: center;
}

.commit-id-tag,
.commit-author-tag,
.commit-time-tag {
  justify-self: start;
  font-size: 11px;
}
</style>
