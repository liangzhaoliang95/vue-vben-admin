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
  upgradeBuildAgent,
  updateBuildAgent,
} from '#/api/deploy-tools/build-agent';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import DetailModal from './modules/detail-modal.vue';
import EditModal from './modules/edit-modal.vue';
import Form from './modules/form.vue';
import TokenDialog from './modules/token-dialog.vue';

// 视图模式：grid | list
const viewMode = ref<'grid' | 'list'>('grid');
const isGridView = computed(() => viewMode.value === 'grid');
const isListView = computed(() => viewMode.value === 'list');

// Grid 视图的 agent 列表数据
const agentList = ref<BuildAgentApi.BuildAgent[]>([]);
const agentListLoading = ref(false);

// 筛选状态
const statusFilter = ref<string>('all');
const osFilter = ref<string>('all');
const sortKey = ref<string>('default');
const sortOrder = ref<'asc' | 'desc'>('desc');
const sortDropdownOpen = ref(false);
const sortDropdownRef = ref<HTMLElement | null>(null);

// 最新版本号（从远程 OSS 获取）
const latestVersion = ref<string>('');

const formRef = ref<InstanceType<typeof Form>>();
const tokenDialogRef = ref<InstanceType<typeof TokenDialog>>();
const detailModalRef = ref<InstanceType<typeof DetailModal>>();
const editModalRef = ref<InstanceType<typeof EditModal>>();

const businessStore = useBusinessStore();

// 打开文档中心
function openDocs() {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
  window.open(`${baseUrl}#/docs?doc=buildAgent-overview`, '_blank');
}

// 获取最新版本号
async function fetchLatestAgentVersion() {
  try {
    const resp = await fetch(
      'https://oss.geekz.cn:81/devops/ezdp/agent/buildAgent/version.json',
    );
    const data = await resp.json();
    latestVersion.value = data.version || '';
  } catch {
    // 静默失败，不影响页面
  }
}

// 版本比较
function needsUpdate(currentVersion: string): boolean {
  if (!latestVersion.value || !currentVersion) return false;
  return currentVersion < latestVersion.value;
}

// 筛选和排序后的列表
const filteredAgentList = computed(() => {
  let list = [...agentList.value];

  // 状态筛选
  if (statusFilter.value === 'online') {
    list = list.filter((a) => a.status === 1);
  } else if (statusFilter.value === 'offline') {
    list = list.filter((a) => a.status === 0 || a.status === 3);
  } else if (statusFilter.value === 'busy') {
    list = list.filter((a) => a.status === 2);
  }

  // OS 筛选
  if (osFilter.value !== 'all') {
    list = list.filter((a) => {
      const lower = (a.os || '').toLowerCase();
      return lower.includes(osFilter.value);
    });
  }

  // 排序
  const dir = sortOrder.value === 'asc' ? 1 : -1;
  if (sortKey.value === 'name') {
    list.sort((a, b) => dir * a.name.localeCompare(b.name));
  } else if (sortKey.value === 'cpu') {
    list.sort((a, b) => {
      const aCpu = a.cpuCores ? (a.cpuUsage / a.cpuCores) * 100 : 0;
      const bCpu = b.cpuCores ? (b.cpuUsage / b.cpuCores) * 100 : 0;
      return dir * (aCpu - bCpu);
    });
  } else if (sortKey.value === 'memory') {
    list.sort((a, b) => {
      const aMem = a.memoryTotal ? (a.memoryUsage / a.memoryTotal) * 100 : 0;
      const bMem = b.memoryTotal ? (b.memoryUsage / b.memoryTotal) * 100 : 0;
      return dir * (aMem - bMem);
    });
  } else if (sortKey.value === 'status') {
    list.sort((a, b) => dir * (a.status - b.status));
  }

  return list;
});

// 获取所有 OS 类型（用于筛选下拉）
const osOptions = computed(() => {
  const osSet = new Set<string>();
  for (const agent of agentList.value) {
    if (agent.os) {
      const lower = agent.os.toLowerCase();
      if (lower.includes('darwin') || lower.includes('mac')) {
        osSet.add('darwin');
      } else if (lower.includes('linux')) {
        osSet.add('linux');
      } else if (lower.includes('windows')) {
        osSet.add('windows');
      } else {
        osSet.add(lower);
      }
    }
  }
  return Array.from(osSet);
});

// OS 筛选选项（带图标，跟服务器页面一致）
const osFilterOptions = computed(() => {
  const opts: { label: string; value: string; icon: string }[] = [
    { label: '全部', value: 'all', icon: '' },
  ];
  for (const os of osOptions.value) {
    if (os === 'darwin') {
      opts.push({ label: 'macOS', value: os, icon: 'simple-icons:apple' });
    } else if (os === 'linux') {
      opts.push({ label: 'Linux', value: os, icon: 'simple-icons:linux' });
    } else if (os === 'windows') {
      opts.push({ label: 'Windows', value: os, icon: 'simple-icons:windows' });
    } else {
      opts.push({ label: os, value: os, icon: 'mdi:cog' });
    }
  }
  return opts;
});

// 排序选项
const sortOptions = [
  { label: '默认排序', value: 'default' },
  { label: '按名称', value: 'name' },
  { label: '按 CPU', value: 'cpu' },
  { label: '按内存', value: 'memory' },
  { label: '按状态', value: 'status' },
];

function setSortKey(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'desc';
  }
  sortDropdownOpen.value = false;
}

// 点击外部关闭排序下拉
function handleClickOutside(e: MouseEvent) {
  if (sortDropdownRef.value && !sortDropdownRef.value.contains(e.target as Node)) {
    sortDropdownOpen.value = false;
  }
}

onMounted(() => {
  loadAgentList();
  fetchLatestAgentVersion();
  document.addEventListener('click', handleClickOutside);
});

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
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'delete': {
      onDelete(e.row);
      break;
    }
  }
}

function onEdit(row: BuildAgentApi.BuildAgent) {
  editModalRef.value?.modalApi.setData(row).open();
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

// 升级 Agent
function handleUpgradeAgent(agent: BuildAgentApi.BuildAgent) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('deploy.tools.buildAgent.upgradeConfirmContent'),
    okText: $t('deploy.tools.buildAgent.upgrade'),
    okType: 'primary',
    title: $t('deploy.tools.buildAgent.upgradeConfirm'),
    onOk: async () => {
      try {
        const result = await upgradeBuildAgent(agent.id);
        message.success(result.message || $t('deploy.tools.buildAgent.upgradeSuccess'));
        // 延迟刷新，等待 Agent 重启
        setTimeout(() => {
          loadAgentList();
        }, 5000);
      } catch (error: any) {
        message.error(error.message || $t('deploy.tools.buildAgent.upgradeFailed'));
      }
    },
  });
}

// 启用/禁用 Agent
function handleToggleEnabled(agent: BuildAgentApi.BuildAgent) {
  const newEnabled = !agent.enabled;
  const actionKey = newEnabled ? 'enable' : 'disable';

  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t(`deploy.tools.buildAgent.${actionKey}ConfirmContent`),
    okText: $t(`deploy.tools.buildAgent.${actionKey}`),
    okType: newEnabled ? 'primary' : 'warning',
    title: $t(`deploy.tools.buildAgent.${actionKey}Confirm`),
    onOk: async () => {
      try {
        await updateBuildAgent(agent.id, { enabled: newEnabled });
        message.success($t(`deploy.tools.buildAgent.${actionKey}Success`));
        loadAgentList();
      } catch (error: any) {
        message.error(error.message || $t('common.operationFailed'));
      }
    },
  });
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

function formatNetworkBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function cpuUsagePercent(agent: BuildAgentApi.BuildAgent): number {
  if (agent.cpuUsagePercent) return Math.round(agent.cpuUsagePercent);
  if (!agent.cpuCores) return 0;
  return Math.round((agent.cpuUsage / agent.cpuCores) * 100);
}

function memUsagePercent(agent: BuildAgentApi.BuildAgent): number {
  if (agent.memoryUsagePercent) return Math.round(agent.memoryUsagePercent);
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
    <DetailModal ref="detailModalRef" :latest-version="latestVersion" />
    <EditModal ref="editModalRef" @success="onRefresh" />

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

      <!-- 筛选栏（与服务器页面风格一致） -->
      <div class="server-filter-bar mb-4">
        <!-- 状态筛选 -->
        <div class="filter-group">
          <button
            v-for="opt in [
              { label: '全部', value: 'all' },
              { label: '在线', value: 'online' },
              { label: '离线', value: 'offline' },
              { label: '忙碌', value: 'busy' },
            ]"
            :key="opt.value"
            class="filter-chip"
            :class="{ active: statusFilter === opt.value }"
            @click="statusFilter = opt.value"
          >
            <span
              v-if="opt.value !== 'all'"
              class="filter-chip__dot"
              :class="{
                'dot-online': opt.value === 'online',
                'dot-offline': opt.value === 'offline',
                'dot-busy': opt.value === 'busy',
              }"
            />
            {{ opt.label }}
            <span class="filter-chip__count">
              {{
                opt.value === 'all'
                  ? agentList.length
                  : opt.value === 'online'
                    ? agentList.filter((a) => a.status === 1).length
                    : opt.value === 'offline'
                      ? agentList.filter((a) => a.status === 0 || a.status === 3).length
                      : agentList.filter((a) => a.status === 2).length
              }}
            </span>
          </button>
        </div>

        <!-- OS 筛选 -->
        <div class="filter-group">
          <button
            v-for="opt in osFilterOptions"
            :key="opt.value"
            class="filter-chip"
            :class="{ active: osFilter === opt.value }"
            @click="osFilter = opt.value"
          >
            <IconifyIcon v-if="opt.icon" :icon="opt.icon" class="size-3.5" />
            {{ opt.label }}
          </button>
        </div>

        <!-- 排序 -->
        <div class="filter-sort-wrap">
          <div ref="sortDropdownRef" class="sort-dropdown-anchor">
            <button class="sort-btn" @click="sortDropdownOpen = !sortDropdownOpen">
              <IconifyIcon icon="mdi:sort" class="size-4" />
              排序：{{ sortOptions.find((o) => o.value === sortKey)?.label }}
              <IconifyIcon
                :icon="sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'"
                class="size-3.5 ml-0.5"
              />
            </button>
            <div v-if="sortDropdownOpen" class="sort-dropdown">
              <div class="sort-dropdown__title">排序方式</div>
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                class="sort-dropdown__item"
                :class="{ active: sortKey === opt.value }"
                @click="setSortKey(opt.value)"
              >
                <IconifyIcon
                  v-if="sortKey === opt.value"
                  :icon="sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'"
                  class="size-3.5 mr-1"
                />
                <span v-else class="size-3.5 mr-1 inline-block" />
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 卡片网格 -->
      <Spin :spinning="agentListLoading">
        <div v-if="agentList.length === 0 && !agentListLoading" class="empty-state flex flex-col items-center justify-center py-20 text-gray-400">
          <IconifyIcon icon="mdi:robot-off-outline" class="size-16 mb-4 opacity-30" />
          <p class="text-sm">暂无构建代理，点击「新建」添加</p>
        </div>
        <div v-else-if="filteredAgentList.length === 0" class="empty-state flex flex-col items-center justify-center py-20 text-gray-400">
          <IconifyIcon icon="mdi:filter-off-outline" class="size-16 mb-4 opacity-30" />
          <p class="text-sm">没有匹配的构建代理</p>
        </div>
        <div v-else class="agent-grid">
          <div
            v-for="agent in filteredAgentList"
            :key="agent.id"
            class="agent-card"
            :class="{
              'agent-card--online': agent.status === 1,
              'agent-card--busy': agent.status === 2,
              'agent-card--offline': agent.status === 0,
              'agent-card--disabled': agent.status === 3 || !agent.enabled,
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
              <!-- 版本标签 + 升级提示 -->
              <Tooltip v-if="agent.version" :title="needsUpdate(agent.version) ? `${$t('deploy.tools.buildAgent.latestVersion')}: ${latestVersion}` : ''">
                <Tag
                  class="agent-card__version-tag shrink-0 cursor-pointer"
                  :color="needsUpdate(agent.version) ? 'warning' : 'default'"
                  @click="needsUpdate(agent.version) && handleUpgradeAgent(agent)"
                >
                  v{{ agent.version }}
                  <span v-if="needsUpdate(agent.version)" class="upgrade-dot"></span>
                </Tag>
              </Tooltip>
              <Tag v-if="agent.sharedEnabled" color="purple" class="agent-card__status-tag shrink-0">
                {{ $t('deploy.tools.buildAgent.sharedTag') }}
              </Tag>
            </div>

            <!-- 信息区 + 资源使用 -->
            <div class="agent-card__body">
              <div class="agent-card__info">
                <div class="agent-card__info-row">
                  <IconifyIcon icon="mdi:ip-network" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs" :title="agent.publicIp">{{ agent.publicIp || agent.ipAddress || '-' }}</span>
                </div>
                <div v-if="agent.privateIps" class="agent-card__info-row">
                  <IconifyIcon icon="mdi:lan" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs" :title="agent.privateIps">{{ agent.privateIps }}</span>
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
                      :d="`M 8 54 A 28 28 0 0 1 ${
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
                      :d="`M 8 54 A 28 28 0 0 1 ${
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
              <Button v-if="needsUpdate(agent.version) && (agent.status === 1 || agent.status === 2)" size="small" type="primary" @click="handleUpgradeAgent(agent)">
                <IconifyIcon icon="mdi:arrow-up-bold" class="size-3.5" />
              </Button>
              <Button v-if="agent.enabled" size="small" @click="onEdit(agent)">
                <IconifyIcon icon="mdi:pencil" class="size-3.5" />
              </Button>
              <Button
                :type="agent.enabled ? 'default' : 'primary'"
                size="small"
                @click="handleToggleEnabled(agent)"
              >
                <IconifyIcon :icon="agent.enabled ? 'mdi:pause' : 'mdi:play'" class="size-3.5" />
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

/* 筛选栏（与服务器页面一致） */
.server-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.filter-chip:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.06);
}

.filter-chip.active {
  background: rgba(22, 119, 255, 0.18);
  color: #4096ff;
}

.filter-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-online { background: #52c41a; }
.dot-offline { background: rgba(255, 255, 255, 0.25); }
.dot-busy { background: #1677ff; }

.filter-chip__count {
  font-size: 11px;
  opacity: 0.6;
  min-width: 14px;
  text-align: center;
}

/* 排序 */
.filter-sort-wrap {
  margin-left: auto;
}

.sort-dropdown-anchor {
  position: relative;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.sort-btn:hover {
  border-color: rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.9);
}

.sort-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 140px;
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.sort-dropdown__title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  padding: 4px 8px 6px;
  letter-spacing: 0.05em;
}

.sort-dropdown__item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, color 0.12s;
}

.sort-dropdown__item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}

.sort-dropdown__item.active {
  color: #4096ff;
}

/* 页面头部 */
.agent-page-header {
  padding: 0 2px;
}

/* 卡片网格 */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
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

.agent-card--online:hover {
  box-shadow: 0 4px 16px rgba(82, 196, 26, 0.15);
}

.agent-card--busy {
  border-left: 3px solid #1677ff;
}

.agent-card--offline {
  border-left: 3px solid rgba(255, 255, 255, 0.15);
  opacity: 0.75;
}

.agent-card--disabled {
  border-left: 3px solid #8c8c8c;
  opacity: 0.55;
}

.agent-card__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
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

.agent-card__version-tag {
  margin-top: 2px;
  position: relative;
}

.upgrade-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff4d4f;
  margin-left: 4px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
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
