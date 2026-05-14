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
  Tooltip,
} from 'ant-design-vue';

import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import {
  getBuildTaskList,
  startBuildTask,
} from '#/api/package-deploy-management/project-package';
import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';
import { copyToClipboard } from '#/utils/clipboard';

const businessStore = useBusinessStore();
const wsStore = useWebSocketStore();

// 筛选条件
const selectedBusinessLineId = ref<number | undefined>();
const selectedBranchId = ref<string | undefined>();

// 所有分支数据（按业务线分组）
const allBranchesMap = ref<Map<number, any[]>>(new Map());

// 版本列表
const versionList = ref<any[]>([]);
const loading = ref(false);
const activeKeys = ref<string[]>([]); // 展开的版本面板

// 组件是否已激活的标记
const isComponentActive = ref(true);
// 是否已经初始化过
const isInitialized = ref(false);
// 是否正在初始化中（防止重复初始化）
const isInitializing = ref(false);

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

// 加载版本列表
async function loadVersionList() {
  console.log('[项目打包] loadVersionList 被调用');

  // 检查组件是否仍然激活
  if (!isComponentActive.value) {
    console.log('[项目打包] 组件未激活，跳过加载');
    return;
  }

  if (!selectedBranchId.value) {
    console.log('[项目打包] 未选择分支，清空版本列表');
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

    console.log('[项目打包] 正在加载版本列表，参数:', queryParams);
    const res = await getBuildTaskList(queryParams);
    console.log('[项目打包] 版本列表加载完成，数据:', res);
    versionList.value = res.items || [];
  } catch (error) {
    console.error('[项目打包] 加载版本列表失败:', error);
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

    // 步骤1: 设置默认业务线（仅首次）
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

    // 步骤2: 加载当前业务线的分支数据（懒加载策略）
    if (selectedBusinessLineId.value) {
      await loadBranchesForBusinessLine(selectedBusinessLineId.value);
    }

    // 步骤3: 设置默认分支（仅首次）
    if (!selectedBranchId.value && selectedBusinessLineId.value) {
      const branches =
        allBranchesMap.value.get(selectedBusinessLineId.value) || [];
      selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
    }

    // 步骤4: 只有在分支列表准备好后，才加载版本列表
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

    // 打开全局日志查看器（taskType=1 表示构建日志）
    wsStore.openGlobalLogViewer(1);

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

// 强制构建（跳过 tag 和镜像检查）
async function handleForceBuild() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }

  try {
    await confirm(
      '⚠️ 强制构建将跳过 tag 和镜像检查，强制重新构建所有项目。确定要继续吗？',
      '强制构建',
    );

    const queryParams: any = {
      branchId: selectedBranchId.value,
      forceRebuild: true, // 强制构建标记
    };

    // 超级管理员可以传业务线ID
    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    await startBuildTask(queryParams);
    message.success('强制构建任务已启动，请查看实时日志');

    // 打开全局日志查看器（taskType=1 表示构建日志）
    wsStore.openGlobalLogViewer(1);

    // 延迟刷新列表 - 检查组件是否仍然激活
    setTimeout(() => {
      if (isComponentActive.value) {
        loadVersionList();
      }
    }, 2000);
  } catch (error) {
    if (error instanceof Error && error.message !== '已取消') {
      console.error('启动强制构建失败:', error);
      message.error('启动强制构建失败');
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

// 格式化构建耗时为 hh:mm:ss
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
  console.log('[项目打包] 收到 WebSocket 消息:', message);

  // 只处理事件类型的消息
  if (message.commandType === 'event' && message.commandId === 1) {
    const { eventType } = message.data;
    console.log(
      '[项目打包] 事件类型:',
      eventType,
      '组件激活状态:',
      isComponentActive.value,
    );

    // 处理构建完成事件
    if (
      eventType === 'build_completed' && // 刷新版本列表
      isComponentActive.value
    ) {
      console.log('[项目打包] 触发刷新版本列表');
      loadVersionList();
      message.success('构建已完成，版本列表已更新');
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

// 复制版本为 Markdown 表格
async function copyVersionAsMarkdown(version: any) {
  if (!version.children || version.children.length === 0) {
    message.warning('该版本无项目数据');
    return;
  }

  try {
    // 构建 Markdown 表格头部
    const versionHeader = `## 版本 ${version.version}\n\n`;
    const versionInfo = `**构建时间:** ${formatTime(version.buildTime)}\n**状态:** ${getVersionStatusConfig(version.status || 'building').text}\n\n`;

    // 构建 Markdown 表格
    const headers = ['项目名称', '项目类型', '版本号', '状态'];
    const separator = ['---', '---', '---', '---'];

    const rows = getSortedProjects(version.children).map((project: any) => {
      return [
        project.projectName || '-',
        getProjectTypeName(project.projectType || ''),
        project.version || '-',
        getStatusConfig((project && project.status) || 'pending').text,
      ];
    });

    // 拼接 Markdown 表格
    const markdownTable = [
      `| ${headers.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');

    // 完整的 Markdown 内容
    const fullMarkdown = versionHeader + versionInfo + markdownTable;

    // 复制到剪贴板
    await copyToClipboard(fullMarkdown);
    message.success('已复制为 Markdown 表格');
  } catch (error) {
    console.error('复制失败:', error);
    message.error('复制失败');
  }
}

// 路由切换时清理资源
onDeactivated(() => {
  try {
    // 标记组件为非激活状态
    isComponentActive.value = false;

    // 取消WebSocket订阅（清理全局状态）
    // 取消构建事件监听
    wsStore.unsubscribe('build-event-listener');

    // 注意：不要调用 unsubscribeBusinessLine()
    // WebSocket 连接是全局共享的，其他页面可能还在使用

    // 清空版本列表状态，但保留其他缓存数据（分支等）
    versionList.value = [];
    activeKeys.value = [];

    // 保留 isInitialized 标记，避免重新初始化时重复加载分支数据
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

        <!-- 操作按钮组 -->
        <div class="flex flex-shrink-0 items-center gap-3">
          <Button @click="handleRefresh">刷新</Button>
          <Button type="primary" @click="handleBuild">开始构建</Button>
          <Button danger type="primary" @click="handleForceBuild">
            ⚡ 强制构建
          </Button>
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
                </div>
                <!-- 复制按钮 -->
                <Tooltip title="复制为 Markdown 表格">
                  <Button
                    size="small"
                    type="text"
                    @click.stop="copyVersionAsMarkdown(version)"
                  >
                    <template #icon>
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
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path
                          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                        />
                      </svg>
                    </template>
                  </Button>
                </Tooltip>
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
                <span
                  v-if="project.duration && project.duration > 0"
                  class="duration-text"
                >
                  ⏱️ {{ formatDuration(project.duration) }}
                </span>
                <span v-else class="duration-text" />
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
              </div>
            </div>
          </CollapsePanel>
        </Collapse>
      </Spin>
    </Card>
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

/* 复制按钮样式 */
:deep(.ant-btn-text) svg {
  transition: all 0.2s ease;
}

:deep(.ant-btn-text):hover svg {
  color: hsl(var(--primary));
  transform: scale(1.1);
}

/* 项目列表样式 */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 12px;
}

.project-item {
  position: relative;
  display: grid;
  grid-template-columns: 200px 60px 90px minmax(0, 160px) 90px;
  column-gap: 16px;
  align-items: center;
  padding: 4px 20px;
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
  display: inline-block;
  justify-self: start;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 10px;
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

.project-item .duration-text {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: default;
}

.project-item .version-tag {
  min-width: 0;
  max-width: 100%;
  padding: 4px 10px;
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
</style>
