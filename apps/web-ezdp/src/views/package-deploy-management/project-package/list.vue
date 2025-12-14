<script lang="ts" setup>
import { computed, onActivated, ref, watch } from 'vue';

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
  Tag,
} from 'ant-design-vue';

import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import {
  getBuildTaskList,
  startBuildTask,
} from '#/api/package-deploy-management/project-package';
import { getDeployEnvironmentList } from '#/api/project-management/deploy-environment';
import LogViewer from '#/components/log-viewer/index.vue';
import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';

const businessStore = useBusinessStore();
const wsStore = useWebSocketStore();

// 数据和加载状态
const versionList = ref<any[]>([]);
const loading = ref(false);
const activeKeys = ref<string[]>([]); // 展开的版本面板

// 发布环境列表
const deployEnvironments = ref<any[]>([]);
const selectedEnvironmentId = ref<string>();

// 实时日志相关
const showLogViewer = ref(false);
const logViewerSubscriptionId = ref<string>('');
const logViewerTitle = ref('');

// 筛选条件
const selectedBusinessLineId = ref<number | undefined>();
const selectedBranchId = ref<string | undefined>();

// 所有分支数据（按业务线分组）
const allBranchesMap = ref<Map<number, any[]>>(new Map());

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

// 业务线选项
const businessLineOptions = computed(() => {
  return businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));
});

// 是否是超级管理员
const isSuperAdmin = computed(
  () => businessStore.currentRole?.isSuper === true,
);

// 加载发布环境列表
async function loadDeployEnvironments() {
  try {
    const res = await getDeployEnvironmentList({
      page: 1,
      pageSize: 1000,
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

// 发布环境选项
const environmentOptions = computed(() => {
  return deployEnvironments.value.map((env) => ({
    label: env.name,
    value: env.id,
  }));
});

// 加载所有业务线的分支数据
async function loadAllBranches() {
  const businessLines = businessStore.businessLines;

  for (const bl of businessLines) {
    const businessLineId = bl.businessLine.id;
    try {
      const res = await getBranchManagementList({
        page: 1,
        pageSize: 1000,
        businessLineId,
      });
      allBranchesMap.value.set(businessLineId, res.items || []);
    } catch (error) {
      console.error(`加载业务线 ${businessLineId} 的分支失败:`, error);
    }
  }
}

// 加载版本列表
async function loadVersionList() {
  if (!selectedBranchId.value) {
    versionList.value = [];
    return;
  }

  loading.value = true;
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
  } catch (error) {
    console.error('加载版本列表失败:', error);
    message.error('加载版本列表失败');
  } finally {
    loading.value = false;
  }
}

// 业务线变化时，更新分支选项并自动订阅该业务线的日志
watch(selectedBusinessLineId, async (newId) => {
  if (newId) {
    // 订阅新业务线的构建日志（自动取消旧订阅）
    wsStore.subscribeBusinessLine(newId);

    const branches = allBranchesMap.value.get(newId) || [];
    selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
  } else {
    selectedBranchId.value = undefined;
  }
});

// 分支变化时，加载版本列表
watch(selectedBranchId, async () => {
  await loadVersionList();
});

// 路由激活时刷新数据
onActivated(async () => {
  await loadDeployEnvironments();
  await loadAllBranches();

  // 设置默认业务线和分支
  if (isSuperAdmin.value) {
    const businessLines = businessStore.businessLines;
    if (businessLines && businessLines.length > 0) {
      selectedBusinessLineId.value = businessLines[0]?.businessLine.id;
    }
  } else {
    selectedBusinessLineId.value =
      businessStore.currentBusinessLineId ?? undefined;
  }

  // 如果已经有选中的分支，手动触发加载版本列表
  // 因为watch可能因为值没变化而不触发
  if (selectedBranchId.value) {
    await loadVersionList();
  }
});

// 监听业务线变化
watch(
  () => businessStore.currentBusinessLineId,
  async (newBusinessLineId) => {
    if (!isSuperAdmin.value) {
      selectedBusinessLineId.value = newBusinessLineId;
    }
  },
);

// 打开实时日志
function openLogViewer(taskType: 1 | 2) {
  // 生成唯一的订阅 ID
  const subscriptionId = `log-viewer-${taskType}-${Date.now()}`;

  // 设置日志查看器参数
  logViewerSubscriptionId.value = subscriptionId;

  // 设置标题
  logViewerTitle.value =
    taskType === 1
      ? $t('deploy.packageDeployManagement.projectPackage.buildLog')
      : $t('deploy.packageDeployManagement.projectPackage.deployLog');

  // 显示日志查看器（业务线订阅已在 watch 中自动处理）
  showLogViewer.value = true;
}

// 关闭实时日志
function closeLogViewer() {
  // 取消订阅（由组件内部处理）
  if (logViewerSubscriptionId.value) {
    wsStore.unsubscribe(logViewerSubscriptionId.value);
    logViewerSubscriptionId.value = '';
  }
  showLogViewer.value = false;
  // 注意：不取消业务线订阅，保持连接以便下次打开日志时能立即接收
}

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

// 获取项目类型名称
function getProjectTypeName(type: string) {
  const typeMap: Record<string, string> = {
    backend: '服务端',
    frontend: '前端',
    submodule: '子模块',
  };
  return typeMap[type] || type || '-';
}

// 获取项目类型图标（emoji）
function getProjectTypeIcon(type: string) {
  const iconMap: Record<string, string> = {
    backend: '⚙️', // 服务端
    frontend: '🎨', // 前端
    submodule: '📦', // 子模块
  };
  return iconMap[type] || '📁';
}

// 排序项目列表：服务端在前，前端在后
function getSortedProjects(projects: any[]) {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }

  return [...projects].sort((a, b) => {
    const typeOrder: Record<string, number> = {
      backend: 1, // 服务端排第一
      submodule: 2, // 子模块排第二
      frontend: 3, // 前端排第三
    };

    const orderA = typeOrder[a.projectType] || 999;
    const orderB = typeOrder[b.projectType] || 999;

    // 按类型排序，类型相同则按名称排序
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.projectName || '').localeCompare(b.projectName || '');
  });
}

// 获取状态标签配置（项目构建任务状态）
function getStatusConfig(status: string) {
  const statusConfig: Record<string, { color: string; text: string }> = {
    pending: {
      color: 'default',
      text: $t('deploy.packageDeployManagement.projectPackage.status.pending'),
    },
    building: {
      color: 'processing',
      text: $t('deploy.packageDeployManagement.projectPackage.status.building'),
    },
    running: {
      color: 'processing',
      text: $t('deploy.packageDeployManagement.projectPackage.status.running'),
    },
    success: {
      color: 'success',
      text: $t('deploy.packageDeployManagement.projectPackage.status.success'),
    },
    failed: {
      color: 'error',
      text: $t('deploy.packageDeployManagement.projectPackage.status.failed'),
    },
    skipped: {
      color: 'warning',
      text: $t('deploy.packageDeployManagement.projectPackage.status.skipped'),
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
        'deploy.packageDeployManagement.projectPackage.versionStatus.building',
      ),
    },
    success: {
      color: 'success',
      text: $t(
        'deploy.packageDeployManagement.projectPackage.versionStatus.success',
      ),
    },
    failed: {
      color: 'error',
      text: $t(
        'deploy.packageDeployManagement.projectPackage.versionStatus.failed',
      ),
    },
  };
  return statusConfig[status] || statusConfig.building;
}

// 判断版本是否可以发布（只有成功状态才能发布）
function canDeploy(version: any) {
  return version.status === 'success';
}

// 刷新列表
async function handleRefresh() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }
  await loadVersionList();
  message.success('刷新成功');
}

// 开始构建
async function handleBuild() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }

  try {
    await confirm('确定要开始构建吗？构建过程可能需要几分钟时间。', '开始构建');

    const queryParams: any = {
      branchId: selectedBranchId.value,
    };

    // 超级管理员可以传业务线ID
    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    await startBuildTask(queryParams);
    message.success('构建任务已启动，请查看实时日志');

    // 打开实时日志
    openLogViewer(1);

    // 延迟刷新列表
    setTimeout(() => {
      loadVersionList();
    }, 2000);
  } catch (error) {
    if (error instanceof Error && error.message !== '已取消') {
      console.error('启动构建失败:', error);
      message.error('启动构建失败');
    }
  }
}

// 发布版本或项目
async function onDeploy(row: any, isVersion: boolean = false) {
  if (!selectedEnvironmentId.value) {
    message.warning(
      $t(
        'deploy.packageDeployManagement.projectPackage.selectEnvironmentFirst',
      ),
    );
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    let confirmMessage = '';
    if (isVersion) {
      // 父级: 发布整个版本的所有项目
      const projectCount = row.children?.length || 0;
      confirmMessage = `确定要将版本 ${row.version} 的所有项目（共 ${projectCount} 个）发布到【${environmentName}】环境吗？`;
    } else {
      // 子级: 只发布单个项目
      confirmMessage = `确定要将项目【${row.projectName}】(版本 ${row.version}) 发布到【${environmentName}】环境吗？`;
    }

    await confirm(
      confirmMessage,
      $t('deploy.packageDeployManagement.projectPackage.deploy'),
    );

    if (isVersion) {
      // TODO: 实现父级发布API调用
      // console.warn('发布整个版本:', {
      //   versionId: row.id,
      //   version: row.version,
      //   environmentId: selectedEnvironmentId.value,
      //   projects: row.children,
      // });
    } else {
      // TODO: 实现子级发布API调用
      // console.warn('发布单个项目:', {
      //   projectId: row.id,
      //   projectConfigId: row.projectConfigId,
      //   projectName: row.projectName,
      //   version: row.version,
      //   environmentId: selectedEnvironmentId.value,
      // });
    }

    message.success(
      $t('deploy.packageDeployManagement.projectPackage.deploySuccess'),
    );
    await loadVersionList();
  } catch (error) {
    if (error instanceof Error && error.message !== '已取消') {
      console.error('发布失败:', error);
    }
  }
}
</script>

<template>
  <!-- eslint-disable vue/html-closing-bracket-newline -->
  <Page auto-content-height>
    <!-- 筛选条件区 -->
    <Card class="mb-4">
      <div class="flex w-full items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-4">
          <!-- 业务线筛选(仅超级管理员) -->
          <div v-if="isSuperAdmin" class="flex items-center gap-2">
            <span class="filter-label"
              >{{ $t('system.businessLine.name') }}:</span
            >
            <Select
              v-model:value="selectedBusinessLineId"
              :options="businessLineOptions"
              :placeholder="$t('system.businessLine.name')"
              class="w-48"
            />
          </div>

          <!-- 分支筛选 -->
          <div class="flex items-center gap-2">
            <span class="filter-label"
              >{{
                $t('deploy.packageDeployManagement.projectPackage.branch')
              }}:</span
            >
            <Select
              v-model:value="selectedBranchId"
              :options="currentBranchOptions"
              :placeholder="
                $t(
                  'deploy.packageDeployManagement.projectPackage.branchPlaceholder',
                )
              "
              class="w-48"
            />
          </div>
        </div>

        <!-- 刷新按钮 -->
        <Button type="primary" @click="handleRefresh" class="flex-shrink-0">
          刷新
        </Button>
      </div>
    </Card>

    <!-- 工具栏 -->
    <Card class="mb-4">
      <div class="flex w-full items-center justify-between gap-4">
        <!-- 发布环境选择 -->
        <div class="flex items-center gap-2">
          <span class="filter-label"
            >{{
              $t(
                'deploy.packageDeployManagement.projectPackage.deployEnvironment',
              )
            }}:</span
          >
          <Select
            v-model:value="selectedEnvironmentId"
            :options="environmentOptions"
            :placeholder="
              $t(
                'deploy.packageDeployManagement.projectPackage.deployEnvironmentPlaceholder',
              )
            "
            class="w-48"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-shrink-0 items-center gap-3">
          <Button type="primary" @click="handleBuild"> 开始构建 </Button>
          <Button @click="openLogViewer(1)">
            {{
              $t('deploy.packageDeployManagement.projectPackage.realtimeLog')
            }}
          </Button>
        </div>
      </div>
    </Card>

    <!-- 版本列表 -->
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
                    getVersionStatusConfig(version.status || 'building').color
                  "
                  class="version-status-tag"
                >
                  {{
                    getVersionStatusConfig(version.status || 'building').text
                  }}
                </Tag>
                <span class="version-time">
                  {{ formatTime(version.buildTime) }}
                </span>
              </div>

              <Button
                type="primary"
                size="small"
                :disabled="!canDeploy(version)"
                @click.stop="onDeploy(version, true)"
              >
                {{ $t('deploy.packageDeployManagement.projectPackage.deploy') }}
              </Button>
            </div>
          </template>

          <!-- 项目列表 -->
          <div class="project-list">
            <!-- 项目数据行 -->
            <div
              v-for="project in getSortedProjects(version.children)"
              :key="project.id"
              class="project-item"
              :class="[`project-type-${project.projectType || 'default'}`]"
            >
              <span class="project-name">{{ project.projectName || '-' }}</span>
              <Tag color="blue" class="project-type-tag">
                {{ getProjectTypeIcon(project.projectType || '') }}
                {{ getProjectTypeName(project.projectType || '') }}
              </Tag>
              <Tag color="red" class="version-tag">
                {{ project.version || '-' }}
              </Tag>
              <Tag
                :color="getStatusConfig(project.status || 'pending').color"
                class="status-tag"
              >
                {{ getStatusConfig(project.status || 'pending').text }}
              </Tag>
              <div></div>
              <Button
                type="primary"
                size="small"
                @click="onDeploy(project, false)"
              >
                {{ $t('deploy.packageDeployManagement.projectPackage.deploy') }}
              </Button>
            </div>
          </div>
        </CollapsePanel>
      </Collapse>
    </Spin>

    <!-- 实时日志悬浮窗 -->
    <Teleport to="body">
      <div v-if="showLogViewer" class="log-viewer-overlay">
        <div class="log-viewer-container">
          <LogViewer
            v-if="logViewerSubscriptionId"
            :subscription-id="logViewerSubscriptionId"
            :title="logViewerTitle"
            @close="closeLogViewer"
          />
        </div>
      </div>
    </Teleport>
  </Page>
</template>

<style scoped>
.log-viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--overlay));
}

.log-viewer-container {
  width: 90%;
  max-width: 1200px;
  height: 80%;
  max-height: 800px;
  overflow: hidden;
  background: hsl(var(--background-deep));
  border-radius: var(--radius);
  box-shadow: 0 4px 20px hsl(0deg 0% 0% / 30%);
}

/* 版本折叠面板样式 */
.version-collapse {
  background: transparent;
}

/* 重置 Ant Design Collapse 的默认样式 */
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

/* 修复：移除 Ant Design 的底部边框 */
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

/* 展开后的内容区域 */
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

/* 展开图标 */
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

/* 确保展开图标容器垂直居中 */
:deep(
  .ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow
) {
  display: inline-flex !important;
  align-items: center !important;
  align-self: center !important;
}

/* Header 内容区域也要垂直居中 */
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

/* 确保展开状态下的头部也有正确的圆角 */
:deep(
  .ant-collapse
    > .ant-collapse-item.ant-collapse-item-active
    > .ant-collapse-header
) {
  border-radius: var(--radius) var(--radius) 0 0 !important;
}

/* 版本号标签 */
.version-title {
  padding: 8px 16px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: calc(var(--radius) - 2px);
}

/* 版本时间 */
.version-time {
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
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

/* 服务端项目：蓝色边框 */
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

/* 前端项目：粉色边框 */
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

/* 子模块项目：紫色边框 */
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

/* 版本状态标签 */
.version-status-tag {
  flex-shrink: 0;
  font-weight: 500;
}

/* 筛选标签样式 */
.filter-label {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
</style>
