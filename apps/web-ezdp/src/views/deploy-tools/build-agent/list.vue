<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { BuildAgentApi } from '#/api/deploy-tools/build-agent';

import { computed, onActivated, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal, Spin, Tag, Tooltip } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteBuildAgent,
  getBuildAgentList,
} from '#/api/deploy-tools/build-agent';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import DetailModal from './modules/detail-modal.vue';
import Form from './modules/form.vue';
import TokenDialog from './modules/token-dialog.vue';

// 视图模式：grid | list
const viewMode = ref<'grid' | 'list'>('grid');
const isGridView = computed(() => viewMode.value === 'grid');
const isListView = computed(() => viewMode.value === 'list');

// Grid 视图的 agent 列表数据
const agentList = ref<BuildAgentApi.BuildAgent[]>([]);
const agentListLoading = ref(false);

const formRef = ref<InstanceType<typeof Form>>();
const tokenDialogRef = ref<InstanceType<typeof TokenDialog>>();
const detailModalRef = ref<InstanceType<typeof DetailModal>>();

const businessStore = useBusinessStore();

// 打开文档中心
function openDocs() {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
  window.open(`${baseUrl}#/docs?doc=buildAgent-overview`, '_blank');
}

// 加载 grid 视图数据
const loadAgentList = async () => {
  agentListLoading.value = true;
  try {
    const isSuperAdmin = businessStore.currentRole?.isSuper === true;
    const params: any = { page: 1, pageSize: 1000 };
    if (!isSuperAdmin) {
      delete params.businessLineId;
    }
    const res = await getBuildAgentList(params);
    agentList.value = res.items || [];
  } catch {
    message.error($t('common.operationFailed'));
  } finally {
    agentListLoading.value = false;
  }
};

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const queryParams: any = {
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };
          if (!isSuperAdmin) {
            delete queryParams.businessLineId;
          }
          return await getBuildAgentList(queryParams);
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<BuildAgentApi.BuildAgent>,
});

// 路由激活时刷新数据
onActivated(() => {
  if (viewMode.value === 'list') {
    gridApi.query();
  } else {
    loadAgentList();
  }
});

onMounted(() => {
  loadAgentList();
});

// 监听业务线ID变化，自动刷新数据
watch(
  () => businessStore.currentBusinessLineId,
  () => {
    if (viewMode.value === 'list') {
      gridApi.query();
    } else {
      loadAgentList();
    }
  },
);

// 切换视图模式
const switchViewMode = (mode: 'grid' | 'list') => {
  viewMode.value = mode;
  if (mode === 'grid') {
    loadAgentList();
  } else {
    gridApi.query();
  }
};

function onActionClick(e: OnActionClickParams<BuildAgentApi.BuildAgent>) {
  switch (e.code) {
    case 'detail': {
      onDetail(e.row);
      break;
    }
    case 'delete': {
      onDelete(e.row);
      break;
    }
  }
}

function onDelete(row: BuildAgentApi.BuildAgent) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('deploy.tools.buildAgent.deleteConfirm', { name: row.name }),
    okText: $t('common.confirm'),
    okType: 'danger',
    title: $t('common.delete'),
    onOk: async () => {
      try {
        if (row.status === 1) {
          message.error($t('deploy.tools.buildAgent.cannotDeleteOnline'));
          return;
        }
        await deleteBuildAgent(row.id);
        message.success($t('common.deleteSuccess'));
        if (viewMode.value === 'list') {
          gridApi.query();
        } else {
          loadAgentList();
        }
      } catch (error: any) {
        message.error(error.message || $t('common.deleteFailed'));
      }
    },
  });
}

function onDetail(row: BuildAgentApi.BuildAgent) {
  detailModalRef.value?.open(row);
}

function onCreate() {
  formRef.value?.drawerApi.setData({}).open();
}

function onRefresh(token?: string) {
  if (viewMode.value === 'list') {
    gridApi.query();
  } else {
    loadAgentList();
  }
  if (token) {
    tokenDialogRef.value?.drawerApi.setData({ token }).open();
  }
}

// ---- Grid 视图辅助函数 ----

function getStatusColor(status: number): string {
  switch (status) {
    case 1: return 'success';
    case 2: return 'processing';
    case 3: return 'default';
    default: return 'error';
  }
}

function getStatusText(status: number): string {
  switch (status) {
    case 1: return $t('deploy.tools.buildAgent.statusOnline');
    case 2: return $t('deploy.tools.buildAgent.statusBusy');
    case 3: return $t('deploy.tools.buildAgent.statusDisabled');
    default: return $t('deploy.tools.buildAgent.statusOffline');
  }
}

function getOsIcon(os: string): string {
  const lower = (os || '').toLowerCase();
  if (lower.includes('darwin') || lower.includes('mac')) return 'simple-icons:apple';
  if (lower.includes('ubuntu')) return 'simple-icons:ubuntu';
  if (lower.includes('debian')) return 'simple-icons:debian';
  if (lower.includes('centos')) return 'simple-icons:centos';
  if (lower.includes('fedora')) return 'simple-icons:fedora';
  if (lower.includes('arch')) return 'simple-icons:archlinux';
  if (lower.includes('alpine')) return 'simple-icons:alpinelinux';
  if (lower.includes('linux')) return 'simple-icons:linux';
  if (lower.includes('windows')) return 'simple-icons:windows';
  return 'mdi:cog';
}

function getOsIconColor(os: string): string {
  const lower = (os || '').toLowerCase();
  if (lower.includes('darwin') || lower.includes('mac')) return '#a0a0a0';
  if (lower.includes('ubuntu')) return '#e95420';
  if (lower.includes('debian')) return '#a80030';
  if (lower.includes('centos')) return '#932279';
  if (lower.includes('fedora')) return '#294172';
  if (lower.includes('arch')) return '#1793d1';
  if (lower.includes('alpine')) return '#0d597f';
  if (lower.includes('windows')) return '#0078d4';
  return '#6b7280';
}

function formatBytes(bytes: number): string {
  if (!bytes) return '-';
  const gb = (bytes / 1024 / 1024 / 1024).toFixed(1);
  return `${gb} GB`;
}

function cpuUsagePercent(agent: BuildAgentApi.BuildAgent): number {
  if (!agent.cpuCores) return 0;
  return Math.round((agent.cpuUsage / agent.cpuCores) * 100);
}

function memUsagePercent(agent: BuildAgentApi.BuildAgent): number {
  if (!agent.memoryTotal) return 0;
  return Math.round((agent.memoryUsage / agent.memoryTotal) * 100);
}

function usageColor(percent: number): string {
  if (percent >= 80) return '#ff4d4f';
  if (percent >= 60) return '#faad14';
  return '#52c41a';
}
</script>

<template>
  <Page auto-content-height>
    <Form ref="formRef" @success="onRefresh" />
    <TokenDialog ref="tokenDialogRef" />
    <DetailModal ref="detailModalRef" />

    <!-- Grid 卡片视图 -->
    <div v-if="isGridView">
      <!-- 顶部工具栏 -->
      <div class="agent-page-header flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold m-0">{{ $t('deploy.tools.buildAgent.title') }}</h2>
        <div class="flex items-center gap-2">
          <Button type="default" @click="openDocs">
            <IconifyIcon icon="mdi:file-document-outline" class="mr-1 size-4" aria-hidden="true" />
            {{ $t('page.docs.title') }}
          </Button>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t('common.create') }}
          </Button>
          <!-- 视图切换 -->
          <div class="view-toggle flex rounded overflow-hidden border border-gray-600">
            <button
              class="view-toggle-btn"
              :class="{ active: isGridView }"
              title="卡片视图"
              @click="switchViewMode('grid')"
            >
              <IconifyIcon icon="mdi:view-grid" class="size-4" />
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: isListView }"
              title="列表视图"
              @click="switchViewMode('list')"
            >
              <IconifyIcon icon="mdi:view-list" class="size-4" />
            </button>
          </div>
          <Button type="default" @click="loadAgentList">
            <IconifyIcon icon="mdi:refresh" class="size-4" :class="{ 'animate-spin': agentListLoading }" />
          </Button>
        </div>
      </div>

      <!-- 卡片网格 -->
      <Spin :spinning="agentListLoading">
        <div v-if="agentList.length === 0 && !agentListLoading" class="empty-state flex flex-col items-center justify-center py-20 text-gray-400">
          <IconifyIcon icon="mdi:robot-off-outline" class="size-16 mb-4 opacity-30" />
          <p class="text-sm">暂无构建代理，点击「新建」添加</p>
        </div>
        <div v-else class="agent-grid">
          <div
            v-for="agent in agentList"
            :key="agent.id"
            class="agent-card"
            :class="{
              'agent-card--online': agent.status === 1,
              'agent-card--busy': agent.status === 2,
              'agent-card--offline': agent.status === 0 || agent.status === 3,
            }"
          >
            <!-- 卡片头部 -->
            <div class="agent-card__header">
              <div class="agent-card__os-icon">
                <IconifyIcon
                  :icon="getOsIcon(agent.os)"
                  class="size-9"
                  :style="{
                    color: getOsIconColor(agent.os),
                    filter: agent.status === 1 ? `drop-shadow(0 0 6px ${getOsIconColor(agent.os)}80)` : 'none',
                    transition: 'color 0.3s, filter 0.3s',
                  }"
                />
              </div>
              <div class="agent-card__title-area flex-1 min-w-0">
                <Tooltip>
                  <template #title>
                    <div style="padding: 4px">
                      <div><strong>主机名:</strong> {{ agent.hostname || '-' }}</div>
                      <div><strong>版本:</strong> {{ agent.version || '-' }}</div>
                      <div><strong>CPU:</strong> {{ agent.cpuModel || '-' }}</div>
                    </div>
                  </template>
                  <div
                    class="agent-card__name truncate cursor-pointer"
                    :title="agent.name"
                    @click="onDetail(agent)"
                  >{{ agent.name }}</div>
                </Tooltip>
                <div class="agent-card__sub truncate text-xs text-gray-400">{{ agent.hostname || '-' }}</div>
              </div>
              <Tag :color="getStatusColor(agent.status)" class="agent-card__status-tag shrink-0">
                {{ getStatusText(agent.status) }}
              </Tag>
            </div>

            <!-- 信息区 + 资源使用 -->
            <div class="agent-card__body">
              <div class="agent-card__info">
                <div class="agent-card__info-row">
                  <IconifyIcon icon="mdi:ip-network" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs">{{ agent.publicIp || agent.ipAddress || '-' }}</span>
                </div>
                <div class="agent-card__info-row">
                  <IconifyIcon icon="mdi:chip" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs font-mono">{{ [agent.os, agent.arch].filter(Boolean).join('/') || '-' }}</span>
                </div>
                <div class="agent-card__info-row">
                  <IconifyIcon icon="mdi:memory" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs">{{ formatBytes(agent.memoryTotal) }}</span>
                </div>
                <div class="agent-card__info-row">
                  <IconifyIcon icon="mdi:harddisk" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs">{{ formatBytes(agent.diskTotal) }}</span>
                </div>
                <div class="agent-card__info-row">
                  <IconifyIcon icon="mdi:hammer-wrench" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs">
                    {{ $t('deploy.tools.buildAgent.tasks') }}: {{ agent.currentTasks ?? 0 }}/{{ agent.maxConcurrentTasks ?? 1 }}
                  </span>
                </div>
              </div>

              <!-- 资源使用仪表盘（在线时显示） -->
              <div v-if="agent.status === 1 || agent.status === 2" class="agent-card__gauges">
                <!-- CPU 迷你仪表 -->
                <div class="mini-gauge-wrap">
                  <svg viewBox="0 0 72 72" width="60" height="60">
                    <path
                      d="M 8 54 A 28 28 0 1 1 64 54"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      stroke-width="5"
                      stroke-linecap="round"
                    />
                    <path
                      v-if="cpuUsagePercent(agent) > 0"
                      :d="`M 8 54 A 28 28 0 ${cpuUsagePercent(agent) > 50 ? 1 : 0} 1 ${
                        36 + 28 * Math.cos(Math.PI - (cpuUsagePercent(agent) / 100) * Math.PI)
                      } ${
                        54 - 28 * Math.sin((cpuUsagePercent(agent) / 100) * Math.PI)
                      }`"
                      fill="none"
                      :stroke="usageColor(cpuUsagePercent(agent))"
                      stroke-width="5"
                      stroke-linecap="round"
                    />
                    <text x="36" y="38" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" :fill="usageColor(cpuUsagePercent(agent))">{{ cpuUsagePercent(agent) }}%</text>
                    <text x="36" y="50" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="rgba(255,255,255,0.4)">CPU</text>
                  </svg>
                </div>
                <!-- MEM 迷你仪表 -->
                <div class="mini-gauge-wrap">
                  <svg viewBox="0 0 72 72" width="60" height="60">
                    <path
                      d="M 8 54 A 28 28 0 1 1 64 54"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      stroke-width="5"
                      stroke-linecap="round"
                    />
                    <path
                      v-if="memUsagePercent(agent) > 0"
                      :d="`M 8 54 A 28 28 0 ${memUsagePercent(agent) > 50 ? 1 : 0} 1 ${
                        36 + 28 * Math.cos(Math.PI - (memUsagePercent(agent) / 100) * Math.PI)
                      } ${
                        54 - 28 * Math.sin((memUsagePercent(agent) / 100) * Math.PI)
                      }`"
                      fill="none"
                      :stroke="usageColor(memUsagePercent(agent))"
                      stroke-width="5"
                      stroke-linecap="round"
                    />
                    <text x="36" y="38" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" :fill="usageColor(memUsagePercent(agent))">{{ memUsagePercent(agent) }}%</text>
                    <text x="36" y="50" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="rgba(255,255,255,0.4)">MEM</text>
                  </svg>
                </div>
              </div>
            </div>

            <!-- 操作区 -->
            <div class="agent-card__actions">
              <Button
                type="primary"
                size="small"
                style="flex: 1; min-width: 0;"
                @click="onDetail(agent)"
              >
                <IconifyIcon icon="mdi:information-outline" class="size-3.5 mr-1" />
                {{ $t('common.detail') }}
              </Button>
              <Button danger size="small" @click="onDelete(agent)">
                <IconifyIcon icon="mdi:delete" class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Spin>
    </div>

    <!-- List 表格视图 -->
    <Grid v-if="isListView" :table-title="$t('deploy.tools.buildAgent.title')">
      <template #toolbar-tools>
        <Button type="default" class="mr-3" @click="openDocs">
          <IconifyIcon icon="mdi:file-document-outline" class="mr-1 size-4" aria-hidden="true" />
          {{ $t('page.docs.title') }}
        </Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('common.create') }}
        </Button>
        <!-- 视图切换 -->
        <div class="view-toggle flex rounded overflow-hidden border border-gray-600 ml-3">
          <button
            class="view-toggle-btn"
            :class="{ active: isGridView }"
            title="卡片视图"
            @click="switchViewMode('grid')"
          >
            <IconifyIcon icon="mdi:view-grid" class="size-4" />
          </button>
          <button
            class="view-toggle-btn"
            :class="{ active: isListView }"
            title="列表视图"
            @click="switchViewMode('list')"
          >
            <IconifyIcon icon="mdi:view-list" class="size-4" />
          </button>
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
/* 视图切换按钮 */
.view-toggle {
  height: 32px;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.45);
  transition: background 0.2s, color 0.2s;
  padding: 0;
}

.view-toggle-btn:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.08);
}

.view-toggle-btn.active {
  color: #1677ff;
  background: rgba(22, 119, 255, 0.12);
}

/* 页面头部 */
.agent-page-header {
  padding: 0 2px;
}

/* 卡片网格 */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.agent-card {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.agent-card:hover {
  border-color: rgba(22, 119, 255, 0.5);
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.15);
}

.agent-card--online {
  border-left: 3px solid #52c41a;
}

.agent-card--busy {
  border-left: 3px solid #1677ff;
}

.agent-card--offline {
  border-left: 3px solid rgba(255, 255, 255, 0.15);
  opacity: 0.75;
}

.agent-card__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.agent-card__os-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.agent-card__title-area {
  padding-top: 2px;
}

.agent-card__name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
  transition: color 0.15s;
}

.agent-card__name:hover {
  color: #4096ff;
}

.agent-card__sub {
  margin-top: 2px;
  line-height: 1.4;
}

.agent-card__status-tag {
  margin-top: 2px;
}

.agent-card__body {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  min-height: 120px;
}

.agent-card__info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  justify-content: center;
}

.agent-card__info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  min-width: 0;
}

.agent-card__gauges {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  flex-shrink: 0;
}

.mini-gauge-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.agent-card__actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}

.agent-card__actions :deep(.ant-btn):not(:first-child) {
  flex-shrink: 0;
}
</style>
