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

// 实时日志相关
const showLogViewer = ref(false);
const logViewerSubscriptionId = ref<string>('');
const logViewerTitle = ref('');

// 组件是否已激活的标记
const isComponentActive = ref(true);

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

// 加载所有业务线的分支数据
async function loadAllBranches() {
  const businessLines = businessStore.businessLines;

  if (!businessLines || businessLines.length === 0) {
    return;
  }

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
  // 检查组件是否仍然激活
  if (!isComponentActive.value) {
    return;
  }

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

// 初始化
async function init() {
  // 加载发布环境
  await loadDeployEnvironments();

  // 设置默认业务线
  if (isSuperAdmin.value) {
    const businessLines = businessStore.businessLines;
    if (businessLines && businessLines.length > 0) {
      selectedBusinessLineId.value = businessLines[0]?.businessLine.id;
    }
  } else {
    selectedBusinessLineId.value =
      businessStore.currentBusinessLineId ?? undefined;
  }

  // 加载分支数据
  await loadAllBranches();

  // 设置默认分支
  if (selectedBusinessLineId.value) {
    const branches =
      allBranchesMap.value.get(selectedBusinessLineId.value) || [];
    selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
  }

  // 加载版本列表
  await loadVersionList();

  // 订阅当前业务线的 WebSocket 日志
  if (selectedBusinessLineId.value) {
    wsStore.subscribeBusinessLine(selectedBusinessLineId.value);
  }
}

// 业务线变化处理
async function handleBusinessLineChange(newId: number) {
  const branches = allBranchesMap.value.get(newId) || [];
  selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
  await loadVersionList();

  // 订阅新业务线的 WebSocket 日志
  wsStore.subscribeBusinessLine(newId);
}

// 分支变化处理
async function handleBranchChange() {
  await loadVersionList();
}

// 环境变化处理
function handleEnvironmentChange(_newId: string) {
  // 预留用于未来功能
}

// 刷新
async function handleRefresh() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }
  await loadVersionList();
  message.success('刷新成功');
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

    // 延迟刷新列表 - 检查组件是否仍然激活
    setTimeout(() => {
      if (isComponentActive.value) {
        loadVersionList();
      }
    }, 2000);
  } catch (error) {
    if (error instanceof Error && error.message !== '已取消') {
      console.error('启动构建失败:', error);
      message.error('启动构建失败');
    }
  }
}

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

  // 显示日志查看器
  showLogViewer.value = true;
}

// 关闭实时日志
function closeLogViewer() {
  // 取消订阅
  if (logViewerSubscriptionId.value) {
    wsStore.unsubscribe(logViewerSubscriptionId.value);
    logViewerSubscriptionId.value = '';
  }
  showLogViewer.value = false;
  // 注意：不取消业务线订阅，保持连接以便下次打开日志时能立即接收
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

// WebSocket 消息处理器
function handleWebSocketMessage(message: any) {
  // 只处理事件类型的消息
  if (message.commandType === 'event' && message.commandId === 1) {
    const { eventType } = message.data;

    // 处理构建完成事件
    if (eventType === 'buildCompleted') {
      // 刷新版本列表
      if (isComponentActive.value) {
        loadVersionList();
        message.success('构建已完成，版本列表已更新');
      }
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
    await wsStore.subscribe('build-event-listener', handleWebSocketMessage);
  } catch (error) {
    console.error('onActivated 初始化失败:', error);
  }
});

// 路由切换时清理资源
onDeactivated(() => {
  try {
    // 标记组件为非激活状态
    isComponentActive.value = false;

    // 关闭日志查看器
    if (showLogViewer.value) {
      closeLogViewer();
    }

    // 取消WebSocket订阅（清理全局状态）
    if (logViewerSubscriptionId.value) {
      wsStore.unsubscribe(logViewerSubscriptionId.value);
      logViewerSubscriptionId.value = '';
    }

    // 取消构建事件监听
    wsStore.unsubscribe('build-event-listener');

    // 注意：不要调用 unsubscribeBusinessLine()
    // WebSocket 连接是全局共享的，其他页面可能还在使用

    // 清空本地状态，避免状态残留
    showLogViewer.value = false;
    versionList.value = [];
    activeKeys.value = [];
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
              {{ $t('deploy.packageDeployManagement.projectPackage.branch') }}:
            </span>
            <Select
              v-model:value="selectedBranchId"
              :options="currentBranchOptions"
              :placeholder="
                $t(
                  'deploy.packageDeployManagement.projectPackage.branchPlaceholder',
                )
              "
              class="w-48"
              @change="handleBranchChange"
            />
          </div>
        </div>

        <!-- 刷新按钮 -->
        <Button type="primary" class="flex-shrink-0" @click="handleRefresh">
          刷新
        </Button>
      </div>
    </Card>

    <!-- 工具栏：发布环境选择 -->
    <Card class="mb-4 mt-4">
      <div class="flex w-full items-center justify-between gap-4">
        <!-- 发布环境选择 -->
        <div class="flex items-center gap-2">
          <span class="filter-label">
            {{
              $t(
                'deploy.packageDeployManagement.projectPackage.deployEnvironment',
              )
            }}:
          </span>
          <Select
            v-model:value="selectedEnvironmentId"
            :options="environmentOptions"
            :placeholder="
              $t(
                'deploy.packageDeployManagement.projectPackage.deployEnvironmentPlaceholder',
              )
            "
            class="w-48"
            @change="handleEnvironmentChange"
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
    <Card>
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
                </div>

                <Button type="primary" size="small" disabled>
                  发布 (待实现)
                </Button>
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
                <Button type="primary" size="small" disabled>
                  发布 (待实现)
                </Button>
              </div>
            </div>
          </CollapsePanel>
        </Collapse>
      </Spin>
    </Card>

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
</style>
