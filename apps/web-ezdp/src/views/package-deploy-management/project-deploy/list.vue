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

import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import {
  deployByTask,
  deployByVersion,
  deployByVersionIncremental,
  getEnvironmentVersion,
} from '#/api/package-deploy-management/deploy';
import {
  getBuildTaskList,
} from '#/api/package-deploy-management/project-package';
import { getDeployEnvironmentList, getEnvironmentProjectVersions } from '#/api/project-management/deploy-environment';
import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';

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

// 当前环境正在使用的版本ID
const currentEnvironmentVersionId = ref<string | null>(null);

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
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.projectName'),
    width: 200,
  },
  {
    dataIndex: 'projectType',
    key: 'projectType',
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.projectType'),
    width: 120,
  },
  {
    dataIndex: 'version',
    key: 'version',
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.version'),
    width: 150,
  },
  {
    dataIndex: 'deployedAt',
    key: 'deployedAt',
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.deployedAt'),
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
async function loadBranchesForBusinessLine(businessLineId: number, force: boolean = false) {
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

// 显示部署版本模态框
async function handleShowDeployedVersions() {
  if (!selectedEnvironmentId.value) {
    message.warning($t('deploy.projectManagement.projectRelease.selectEnvironmentFirst'));
    return;
  }

  versionModalOpen.value = true;
  versionModalLoading.value = true;

  try {
    const res = await getEnvironmentProjectVersions(selectedEnvironmentId.value);
    deployedVersions.value = res.list || [];
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
    message.warning($t('deploy.packageDeployManagement.projectDeploy.selectEnvironmentFirst'));
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectDeploy.fullDeployConfirm', [version.version, environmentName]),
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
    message.success($t('deploy.packageDeployManagement.projectDeploy.deploySuccess'));

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
    message.warning($t('deploy.packageDeployManagement.projectDeploy.selectEnvironmentFirst'));
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectDeploy.incrementalDeployConfirm', [version.version, environmentName]),
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
    message.success($t('deploy.packageDeployManagement.projectDeploy.deploySuccess'));

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
    message.warning($t('deploy.packageDeployManagement.projectDeploy.selectEnvironmentFirst'));
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectDeploy.deployConfirm', [project.version, environmentName]),
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
    message.success($t('deploy.packageDeployManagement.projectDeploy.deploySuccess'));

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
  const typeMap: Record<string, string> = {
    backend: '服务端',
    frontend: '前端',
    submodule: '子模块',
  };
  return typeMap[type] || type || '-';
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
    return $t('deploy.packageDeployManagement.environmentConfig.versionModal.frontend');
  }
  if (type === 'backend') {
    return $t('deploy.packageDeployManagement.environmentConfig.versionModal.backend');
  }
  return type;
}

// 获取项目类型图标
function getProjectTypeIcon(type: string) {
  const iconMap: Record<string, string> = {
    backend: '⚙️',
    frontend: '🎨',
    submodule: '📦',
  };
  return iconMap[type] || '📁';
}

// 排序项目列表
function getSortedProjects(projects: any[]) {
  if (!projects || !Array.isArray(projects)) {
    return [];
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
    if (
      eventType === 'build_completed' &&
      isComponentActive.value
    ) {
      loadVersionList();
      message.success('构建已完成，版本列表已更新');
    }

    // 处理部署完成事件（刷新部署列表）
    if (
      eventType === 'deploy_completed' &&
      isComponentActive.value
    ) {
      loadDeployTasks();
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
    <!-- 筛选条件区 -->
    <Card>
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
          <Button @click="handleShowDeployedVersions">
            {{ $t('deploy.projectManagement.projectRelease.deployedVersions') }}
          </Button>
          <Button @click="handleRefresh">刷新</Button>
        </div>
      </div>
    </Card>

    <!-- 版本列表 -->
    <Card class="mt-4">
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
          <CollapsePanel v-for="version in versionList" :key="version.id">
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
                    ✓ 当前版本
                  </Tag>
                </div>

                <div class="flex items-center gap-2">
                  <Button
                    type="primary"
                    size="large"
                    :disabled="version.status !== 'success'"
                    @click.stop="handleIncrementalDeploy(version)"
                  >
                    📦 {{ $t('deploy.packageDeployManagement.projectDeploy.incrementalDeploy') }}
                  </Button>
                  <Button
                    danger
                    type="primary"
                    size="large"
                    :disabled="version.status !== 'success'"
                    @click.stop="handleFullDeploy(version)"
                  >
                    🚀 {{ $t('deploy.packageDeployManagement.projectDeploy.fullDeploy') }}
                  </Button>
                </div>
              </div>
            </template>

            <!-- 项目列表 -->
            <div class="project-list">
              <div
                v-for="project in getSortedProjects(version.children)"
                :key="project.id"
                class="project-item"
                :class="[`project-type-${project.projectType || 'default'}`]"
              >
                <span class="project-name">{{
                  project.projectName || '-'
                }}</span>
                <Tag color="blue" class="project-type-tag">
                  {{ getProjectTypeIcon(project.projectType || '') }}
                  {{ getProjectTypeName(project.projectType || '') }}
                </Tag>
                <Tag color="red" class="version-tag">
                  {{ project.version || '-' }}
                </Tag>
                <Tag
                  :color="
                    getStatusConfig((project && project.status) || 'pending')
                      .color
                  "
                  class="status-tag"
                >
                  {{
                    getStatusConfig((project && project.status) || 'pending')
                      .text
                  }}
                </Tag>
                <div></div>
                <Button
                  type="primary"
                  size="small"
                  :disabled="project.status !== 'success'"
                  @click.stop="handleDeployProject(project)"
                >
                  {{ $t('deploy.packageDeployManagement.projectDeploy.deploy') }}
                </Button>
              </div>
            </div>
          </CollapsePanel>
        </Collapse>
      </Spin>
    </Card>

    <!-- 部署版本模态框 -->
    <Modal
      v-model:open="versionModalOpen"
      :title="$t('deploy.packageDeployManagement.environmentConfig.versionModal.title', [currentEnvironmentName])"
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
          <div style="padding: 40px 0; text-align: center; color: #999;">
            {{ $t('deploy.packageDeployManagement.environmentConfig.versionModal.noData') }}
          </div>
        </template>
      </Table>
    </Modal>
  </Page>
</template>

<style scoped>
.filter-label {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

/* 版本折叠面板样式 */
.version-collapse {
  background: transparent;
}

:deep(.ant-collapse) {
  background: transparent;
  border: none;
}

:deep(.ant-collapse > .ant-collapse-item) {
  margin-bottom: 16px;
  overflow: hidden;
  background: hsl(var(--card));
  border: none;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius) !important;
  box-shadow: 0 1px 2px hsl(0deg 0% 0% / 3%);
}

:deep(.ant-collapse > .ant-collapse-item:last-child) {
  margin-bottom: 0;
}

:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header) {
  display: flex !important;
  align-items: center !important;
  padding: 16px 20px;
  font-weight: 600;
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
  border-bottom: 1px solid hsl(var(--border));
  border-radius: var(--radius) var(--radius) 0 0 !important;
}

:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header:hover) {
  background: hsl(var(--accent));
}

:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-content) {
  background: hsl(var(--accent-lighter));
  border-top: none;
}

:deep(
  .ant-collapse
    > .ant-collapse-item
    > .ant-collapse-content
    > .ant-collapse-content-box
) {
  padding: 0;
}

:deep(
  .ant-collapse
    > .ant-collapse-item
    > .ant-collapse-header
    .ant-collapse-expand-icon
) {
  display: inline-flex !important;
  align-items: center !important;
  align-self: center !important;
  justify-content: center !important;
  color: hsl(var(--muted-foreground)) !important;
}

:deep(
  .ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow
) {
  display: inline-flex !important;
  align-items: center !important;
  align-self: center !important;
}

:deep(
  .ant-collapse
    > .ant-collapse-item
    > .ant-collapse-header
    .ant-collapse-header-text
) {
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
}

:deep(
  .ant-collapse
    > .ant-collapse-item.ant-collapse-item-active
    > .ant-collapse-header
) {
  border-radius: var(--radius) var(--radius) 0 0 !important;
}

.version-title {
  padding: 8px 16px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: calc(var(--radius) - 2px);
}

.version-time {
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.version-status-tag {
  flex-shrink: 0;
  font-weight: 500;
}

.current-version-tag {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 14px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

/* 项目列表样式 */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.project-item {
  position: relative;
  display: grid;
  grid-template-columns: 200px 90px 100px 110px 1fr 80px;
  column-gap: 16px;
  align-items: center;
  padding: 16px 20px;
  cursor: default;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-left: 4px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 2px 4px rgb(0 0 0 / 5%);
  transition: all 0.2s ease;
}

/* 服务端项目 */
.project-item.project-type-backend {
  background: linear-gradient(
    to right,
    rgb(24 144 255 / 4%),
    hsl(var(--card)) 180px
  );
  border-left-color: #1890ff;
}

.project-item.project-type-backend:hover {
  background: linear-gradient(
    to right,
    rgb(24 144 255 / 8%),
    hsl(var(--card)) 180px
  );
  border-color: rgb(24 144 255 / 30%);
  box-shadow: 0 4px 12px rgb(24 144 255 / 20%);
  transform: translateX(4px);
}

/* 前端项目 */
.project-item.project-type-frontend {
  background: linear-gradient(
    to right,
    rgb(235 47 150 / 4%),
    hsl(var(--card)) 180px
  );
  border-left-color: #eb2f96;
}

.project-item.project-type-frontend:hover {
  background: linear-gradient(
    to right,
    rgb(235 47 150 / 8%),
    hsl(var(--card)) 180px
  );
  border-color: rgb(235 47 150 / 30%);
  box-shadow: 0 4px 12px rgb(235 47 150 / 20%);
  transform: translateX(4px);
}

/* 子模块项目 */
.project-item.project-type-submodule {
  background: linear-gradient(
    to right,
    rgb(114 46 209 / 4%),
    hsl(var(--card)) 180px
  );
  border-left-color: #722ed1;
}

.project-item.project-type-submodule:hover {
  background: linear-gradient(
    to right,
    rgb(114 46 209 / 8%),
    hsl(var(--card)) 180px
  );
  border-color: rgb(114 46 209 / 30%);
  box-shadow: 0 4px 12px rgb(114 46 209 / 20%);
  transform: translateX(4px);
}

/* 默认项目样式 */
.project-item:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  transform: translateX(4px);
}

.project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.project-type-tag {
  justify-self: start;
  font-weight: 500;
  white-space: nowrap;
}

.version-tag {
  justify-self: start;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-weight: 600;
  white-space: nowrap;
}

.status-tag {
  justify-self: start;
  font-weight: 500;
  white-space: nowrap;
}

/* 统一调整所有 Tag 标签大小和居中 */
.project-item :deep(.ant-tag) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 4px 12px;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

/* 发布按钮样式 */
.project-item :deep(.ant-btn-sm) {
  justify-self: end;
  height: 28px;
  padding: 0 12px;
  font-size: 13px;
}

/* 表格行悬浮效果 */
:deep(.vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.08) !important;
  transition: background-color 0.2s ease;
}

/* 深色模式下的悬浮效果 */
:deep(.dark .vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.15) !important;
}

/* 版本模态框表格样式 */
:deep(.ant-modal .ant-table) {
  font-size: 14px;
}

:deep(.ant-modal .ant-table-thead > tr > th) {
  background-color: #fafafa;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
  border-bottom: 1px solid #f0f0f0;
}

/* 深色模式 */
:deep(.dark .ant-modal .ant-table-thead > tr > th) {
  background-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

:deep(.dark .ant-modal .ant-table) {
  color: rgba(255, 255, 255, 0.85);
}

:deep(.dark .ant-modal .ant-table-tbody > tr > td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

:deep(.dark .ant-modal .ant-table-tbody > tr:hover > td) {
  background-color: rgba(255, 255, 255, 0.04);
}
</style>
