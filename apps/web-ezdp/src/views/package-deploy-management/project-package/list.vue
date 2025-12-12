<script lang="ts" setup>
import {
  computed,
  h,
  onActivated,
  ref,
  watch,
} from 'vue';

import { Page } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Badge, Button, Card, Collapse, CollapsePanel, Empty, message, Modal, Select, Space, Spin, Tag } from 'ant-design-vue';

import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import {
  getBuildTaskList,
  startBuildTask,
} from '#/api/package-deploy-management/project-package';
import { getDeployEnvironmentList } from '#/api/project-management/deploy-environment';
import LogViewer from '#/components/log-viewer/index.vue';
import { useWebSocketStore } from '#/store/websocket';
import { $t } from '#/locales';

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
const isSuperAdmin = computed(() => businessStore.currentRole?.isSuper === true);

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

// 业务线变化时，更新分支选项
watch(selectedBusinessLineId, async (newId) => {
  if (newId) {
    const branches = allBranchesMap.value.get(newId) || [];
    if (branches.length > 0) {
      selectedBranchId.value = branches[0].id;
    } else {
      selectedBranchId.value = undefined;
    }
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
    selectedBusinessLineId.value = businessStore.currentBusinessLineId ?? undefined;
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
)

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

  // 显示日志查看器（组件内部会自动订阅）
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

// 获取状态标签配置
function getStatusConfig(status: string) {
  const statusConfig: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: $t('deploy.packageDeployManagement.projectPackage.status.pending') },
    running: { color: 'processing', text: $t('deploy.packageDeployManagement.projectPackage.status.running') },
    success: { color: 'success', text: $t('deploy.packageDeployManagement.projectPackage.status.success') },
    failed: { color: 'error', text: $t('deploy.packageDeployManagement.projectPackage.status.failed') },
  };
  return statusConfig[status] || statusConfig.pending;
}

// 刷新列表
async function handleRefresh() {
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
    await confirm(
      '确定要开始构建吗？构建过程可能需要几分钟时间。',
      '开始构建',
    );

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
      $t('deploy.packageDeployManagement.projectPackage.selectEnvironmentFirst'),
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
      console.log('发布整个版本:', {
        versionId: row.id,
        version: row.version,
        environmentId: selectedEnvironmentId.value,
        projects: row.children,
      });
    } else {
      // TODO: 实现子级发布API调用
      console.log('发布单个项目:', {
        projectId: row.id,
        projectConfigId: row.projectConfigId,
        projectName: row.projectName,
        version: row.version,
        environmentId: selectedEnvironmentId.value,
      });
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
  <Page auto-content-height>
    <!-- 筛选条件区 -->
    <Card class="mb-4">
      <div class="flex items-center justify-between w-full gap-4">
        <div class="flex items-center gap-4 flex-wrap">
          <!-- 业务线筛选(仅超级管理员) -->
          <div v-if="isSuperAdmin" class="flex items-center gap-2">
            <span class="filter-label">{{ $t('system.businessLine.name') }}:</span>
            <Select
              v-model:value="selectedBusinessLineId"
              :options="businessLineOptions"
              :placeholder="$t('system.businessLine.name')"
              class="w-48"
            />
          </div>

          <!-- 分支筛选 -->
          <div class="flex items-center gap-2">
            <span class="filter-label">{{ $t('deploy.packageDeployManagement.projectPackage.branch') }}:</span>
            <Select
              v-model:value="selectedBranchId"
              :options="currentBranchOptions"
              :placeholder="$t('deploy.packageDeployManagement.projectPackage.branchPlaceholder')"
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
      <div class="flex items-center justify-between w-full gap-4">
        <!-- 发布环境选择 -->
        <div class="flex items-center gap-2">
          <span class="filter-label">{{ $t('deploy.packageDeployManagement.projectPackage.deployEnvironment') }}:</span>
          <Select
            v-model:value="selectedEnvironmentId"
            :options="environmentOptions"
            :placeholder="$t('deploy.packageDeployManagement.projectPackage.deployEnvironmentPlaceholder')"
            class="w-48"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center gap-3 flex-shrink-0">
          <Button type="primary" @click="handleBuild">
            开始构建
          </Button>
          <Button @click="openLogViewer(1)">
            {{ $t('deploy.packageDeployManagement.projectPackage.realtimeLog') }}
          </Button>
        </div>
      </div>
    </Card>

    <!-- 版本列表 -->
    <Spin :spinning="loading">
      <div v-if="versionList.length === 0" class="flex justify-center items-center py-20">
        <Empty :description="$t('common.noData')" />
      </div>

      <Collapse
        v-else
        v-model:activeKey="activeKeys"
        :bordered="false"
        :expand-icon-position="'start'"
        class="version-collapse"
      >
        <CollapsePanel
          v-for="version in versionList"
          :key="version.id"
        >
          <template #header>
            <div class="flex items-center justify-between w-full pr-4">
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
                <span class="version-time">
                  {{ formatTime(version.buildTime) }}
                </span>
              </div>

              <Button
                type="primary"
                size="small"
                @click.stop="onDeploy(version, true)"
              >
                {{ $t('deploy.packageDeployManagement.projectPackage.deploy') }}
              </Button>
            </div>
          </template>

          <!-- 项目列表 -->
          <div class="project-list">
            <div
              v-for="project in version.children"
              :key="project.id"
              class="project-item"
            >
              <div class="project-info">
                <span class="project-name">{{ project.projectName || '-' }}</span>
                <Tag color="blue" class="project-type-tag">
                  {{ getProjectTypeName(project.projectType || '') }}
                </Tag>
                <span class="version-text">版本: {{ project.version || '-' }}</span>
                <Tag :color="getStatusConfig(project.status || 'pending').color" class="status-tag">
                  {{ getStatusConfig(project.status || 'pending').text }}
                </Tag>
              </div>

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
      <div
        v-if="showLogViewer"
        class="log-viewer-overlay"
        @click.self="closeLogViewer"
      >
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: hsl(var(--overlay));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.log-viewer-container {
  width: 90%;
  max-width: 1200px;
  height: 80%;
  max-height: 800px;
  background: hsl(var(--background-deep));
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 4px 20px hsl(0 0% 0% / 30%);
}

/* 版本折叠面板样式 */
.version-collapse {
  background: transparent;
}

/* 重置 Ant Design Collapse 的默认样式 */
:deep(.ant-collapse) {
  border: none;
  background: transparent;
}

:deep(.ant-collapse > .ant-collapse-item) {
  border: none;
  margin-bottom: 16px;
  background: hsl(var(--card));
  border-radius: var(--radius) !important;
  border: 1px solid hsl(var(--border));
  overflow: hidden;
  box-shadow: 0 1px 2px hsl(0 0% 0% / 3%);
}

:deep(.ant-collapse > .ant-collapse-item:last-child) {
  margin-bottom: 0;
}

/* 修复：移除 Ant Design 的底部边框 */
:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header) {
  padding: 16px 20px;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-weight: 600;
  border-radius: var(--radius) var(--radius) 0 0 !important;
  border-bottom: 1px solid hsl(var(--border));
  display: flex !important;
  align-items: center !important;
}

:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header:hover) {
  background: hsl(var(--accent));
}

/* 展开后的内容区域 */
:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-content) {
  border-top: none;
  background: hsl(var(--accent-lighter));
}

:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box) {
  padding: 0;
}

/* 展开图标 */
:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-expand-icon) {
  color: hsl(var(--muted-foreground)) !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  align-self: center !important;
}

/* 确保展开图标容器垂直居中 */
:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  display: inline-flex !important;
  align-items: center !important;
  align-self: center !important;
}

/* Header 内容区域也要垂直居中 */
:deep(.ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-header-text) {
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
}

/* 确保展开状态下的头部也有正确的圆角 */
:deep(.ant-collapse > .ant-collapse-item.ant-collapse-item-active > .ant-collapse-header) {
  border-radius: var(--radius) var(--radius) 0 0 !important;
}

/* 版本号标签 */
.version-title {
  font-size: 20px;
  font-weight: 700;
  padding: 8px 16px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: calc(var(--radius) - 2px);
  line-height: 1;
}

/* 版本时间 */
.version-time {
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

/* 项目列表样式 */
.project-list {
  padding: 8px;
}

.project-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  margin-bottom: 8px;
  background: hsl(var(--card));
  border-radius: calc(var(--radius) - 2px);
  border: 1px solid hsl(var(--border));
  transition: all 0.2s ease;
  cursor: default;
}

.project-item:hover {
  border-color: hsl(var(--primary));
  box-shadow: 0 2px 8px hsl(var(--primary) / 20%);
  transform: translateY(-1px);
}

.project-item:last-child {
  margin-bottom: 0;
}

.project-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.project-name {
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--primary));
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 0;
}

.project-type-tag {
  font-size: 12px;
  flex-shrink: 0;
}

.version-text {
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  flex-shrink: 0;
}

.status-tag {
  flex-shrink: 0;
}

/* 筛选标签样式 */
.filter-label {
  color: hsl(var(--muted-foreground));
  font-weight: 500;
  white-space: nowrap;
}
</style>
