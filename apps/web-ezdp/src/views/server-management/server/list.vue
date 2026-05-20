<script lang="ts" setup>
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onClickOutside, useDraggable } from '@vueuse/core';
import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { IconifyIcon } from '@vben/icons';

import { Button, Modal, Space, Tag, Tooltip, message, Form, FormItem, Input, Card, Alert, Table, Upload, Spin, Popconfirm } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import type { UploadProps } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ServerManagementApi } from '#/api/server-management';
import { SystemConfig } from '#/api/system/config';
import { $t } from '#/locales';
import { copyToClipboard } from '#/utils/clipboard';
import WebTerminal from '#/components/web-terminal/index.vue';
import MonitorModal from './modules/monitor-modal.vue';
import MiniGauge from './modules/mini-gauge.vue';

defineOptions({
  name: 'ServerList',
});

// 视图模式：grid | list
const viewMode = ref<'grid' | 'list'>('grid');

// Grid 视图的服务器列表数据
const serverList = ref<ServerManagementApi.Server[]>([]);
const serverListLoading = ref(false);

// 各服务器的实时 stats，key 为 serverId
const serverStatsMap = ref<Record<string, ServerManagementApi.ServerStats>>({});

// ---- 过滤 & 排序 ----
type StatusFilter = 'all' | 'online' | 'offline';
type OsFilter = 'all' | 'linux' | 'darwin' | 'windows' | 'other';
type SortKey = 'default' | 'name' | 'cpu' | 'mem' | 'status';
type SortOrder = 'asc' | 'desc';

const filterStatus = ref<StatusFilter>('all');
const filterOs = ref<OsFilter>('all');
const sortKey = ref<SortKey>('default');
const sortOrder = ref<SortOrder>('asc');
const sortDropdownOpen = ref(false);

const osFilterOptions: { label: string; value: OsFilter; icon: string }[] = [
  { label: '全部', value: 'all', icon: 'mdi:server' },
  { label: 'Linux', value: 'linux', icon: 'simple-icons:linux' },
  { label: 'macOS', value: 'darwin', icon: 'simple-icons:apple' },
  { label: 'Windows', value: 'windows', icon: 'simple-icons:windows' },
  { label: '其他', value: 'other', icon: 'mdi:help-circle-outline' },
];

const sortOptions: { label: string; value: SortKey }[] = [
  { label: '默认', value: 'default' },
  { label: '名称', value: 'name' },
  { label: 'CPU', value: 'cpu' },
  { label: '内存', value: 'mem' },
  { label: '状态', value: 'status' },
];

const getOsCategory = (os: string): OsFilter => {
  const lower = (os || '').toLowerCase();
  if (lower.includes('darwin') || lower.includes('mac')) return 'darwin';
  if (lower.includes('windows')) return 'windows';
  if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') ||
      lower.includes('centos') || lower.includes('fedora') || lower.includes('arch') ||
      lower.includes('alpine') || lower.includes('kylin') || lower.includes('麒麟') ||
      lower.includes('uos') || lower.includes('uniontech') || lower.includes('openeuler') ||
      lower.includes('euler') || lower.includes('anolis') || lower.includes('tencentos') ||
      lower.includes('alinux') || lower.includes('rocky') || lower.includes('opensuse') ||
      lower.includes('suse') || lower.includes('manjaro') || lower.includes('kali')) return 'linux';
  return 'other';
};

const applySort = (list: ServerManagementApi.Server[]) => {
  if (sortKey.value === 'default') {
    return [...list].sort((a, b) => {
      const ao = a.status === 'online' ? 1 : 0;
      const bo = b.status === 'online' ? 1 : 0;
      return bo - ao;
    });
  }
  return [...list].sort((a, b) => {
    if (sortKey.value === 'name') {
      const cmp = a.serverName.localeCompare(b.serverName);
      return sortOrder.value === 'asc' ? cmp : -cmp;
    }
    let va = 0;
    let vb = 0;
    if (sortKey.value === 'status') {
      va = a.status === 'online' ? 1 : 0;
      vb = b.status === 'online' ? 1 : 0;
    } else if (sortKey.value === 'cpu') {
      va = serverStatsMap.value[a.serverId]?.cpu.usagePercent ?? -1;
      vb = serverStatsMap.value[b.serverId]?.cpu.usagePercent ?? -1;
    } else if (sortKey.value === 'mem') {
      va = serverStatsMap.value[a.serverId]?.memory.usedPercent ?? -1;
      vb = serverStatsMap.value[b.serverId]?.memory.usedPercent ?? -1;
    }
    return sortOrder.value === 'asc' ? vb - va : va - vb;
  });
};

const filteredAndSortedServers = computed(() => {
  let list = serverList.value;
  if (filterStatus.value !== 'all') {
    list = list.filter((s) => s.status === filterStatus.value);
  }
  if (filterOs.value !== 'all') {
    list = list.filter((s) => getOsCategory(s.os) === filterOs.value);
  }
  return applySort(list);
});

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
};

const setSortKey = (key: SortKey) => {
  if (sortKey.value === key) {
    toggleSortOrder();
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
  sortDropdownOpen.value = false;
};

// 点击排序下拉框外部时关闭
const sortDropdownRef = ref<HTMLElement | null>(null);
onClickOutside(sortDropdownRef, () => {
  sortDropdownOpen.value = false;
});

// 列表模式下，筛选/排序变化时重新查询
watch([filterStatus, filterOs, sortKey, sortOrder], () => {
  if (viewMode.value === 'list') {
    gridApi.query();
  }
});

const loadServerList = async () => {
  serverListLoading.value = true;
  try {
    const res = await ServerManagementApi.getServerList();
    serverList.value = res.servers || [];
    // 并发拉取所有在线服务器的实时 stats
    const onlineServers = serverList.value.filter((s) => s.status === 'online');
    const results = await Promise.allSettled(
      onlineServers.map((s) => ServerManagementApi.getServerStats({ serverId: s.serverId })),
    );
    const map: Record<string, ServerManagementApi.ServerStats> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.stats) {
        map[onlineServers[i]!.serverId] = r.value.stats;
      }
    });
    serverStatsMap.value = map;
  } catch {
    message.error($t('common.operationFailed'));
  } finally {
    serverListLoading.value = false;
  }
};

// 根据 OS 返回对应的 Iconify 图标名
const getOsIcon = (os: string, osVersion?: string): string => {
  const lower = ((osVersion || '') + ' ' + (os || '')).toLowerCase();
  if (lower.includes('darwin') || lower.includes('macos') || lower.includes('mac os')) {
    return 'simple-icons:apple';
  }
  if (lower.includes('ubuntu')) return 'simple-icons:ubuntu';
  if (lower.includes('debian')) return 'simple-icons:debian';
  if (lower.includes('rocky')) return 'simple-icons:rockylinux';
  if (lower.includes('centos')) return 'simple-icons:centos';
  if (lower.includes('fedora')) return 'simple-icons:fedora';
  if (lower.includes('arch')) return 'simple-icons:archlinux';
  if (lower.includes('alpine')) return 'simple-icons:alpinelinux';
  if (lower.includes('opensuse') || lower.includes('suse')) return 'simple-icons:opensuse';
  if (lower.includes('manjaro')) return 'simple-icons:manjaro';
  if (lower.includes('kali')) return 'simple-icons:kalilinux';
  if (lower.includes('raspberry')) return 'simple-icons:raspberrypi';
  // 国产发行版：麒麟、统信、欧拉等无专属图标，统一用通用 Linux 图标
  if (lower.includes('kylin') || lower.includes('麒麟') ||
      lower.includes('uos') || lower.includes('uniontech') || lower.includes('统信') ||
      lower.includes('openeuler') || lower.includes('euler') ||
      lower.includes('anolis') || lower.includes('tencentos') ||
      lower.includes('alibaba') || lower.includes('alinux')) {
    return 'simple-icons:linux';
  }
  if (lower.includes('linux')) return 'simple-icons:linux';
  if (lower.includes('windows')) return 'simple-icons:windows';
  if (lower.includes('freebsd') || lower.includes('bsd')) return 'simple-icons:freebsd';
  return 'mdi:server';
};

// 根据 OS 返回图标颜色
const getOsIconColor = (os: string, osVersion?: string): string => {
  const lower = ((osVersion || '') + ' ' + (os || '')).toLowerCase();
  if (lower.includes('darwin') || lower.includes('macos')) return '#a0a0a0';
  if (lower.includes('ubuntu')) return '#e95420';
  if (lower.includes('debian')) return '#a80030';
  if (lower.includes('rocky')) return '#10b981';
  if (lower.includes('centos')) return '#932279';
  if (lower.includes('fedora')) return '#294172';
  if (lower.includes('arch')) return '#1793d1';
  if (lower.includes('alpine')) return '#0d597f';
  if (lower.includes('opensuse') || lower.includes('suse')) return '#73ba25';
  if (lower.includes('manjaro')) return '#35bf5c';
  if (lower.includes('kali')) return '#367bf0';
  if (lower.includes('raspberry')) return '#c51a4a';
  // 国产发行版配色
  if (lower.includes('kylin') || lower.includes('麒麟')) return '#c8232c';       // 麒麟红
  if (lower.includes('uos') || lower.includes('uniontech') || lower.includes('统信')) return '#0050b3'; // 统信蓝
  if (lower.includes('openeuler') || lower.includes('euler')) return '#c7000b';  // 欧拉红
  if (lower.includes('anolis')) return '#ff6a00';                                 // Anolis 橙
  if (lower.includes('tencentos')) return '#006eff';                              // TencentOS 蓝
  if (lower.includes('alibaba') || lower.includes('alinux')) return '#ff6a00';   // Alibaba Cloud Linux 橙
  if (lower.includes('windows')) return '#0078d4';
  if (lower.includes('freebsd')) return '#ab2b28';
  return '#6b7280';
};

// 终端浮层状态
const terminalVisible = ref(false);
const currentServerId = ref('');
const currentServerName = ref('');

// 终端浮层拖拽 & resize
const terminalPanelRef = ref<HTMLElement | null>(null);
const terminalDragHandleRef = ref<HTMLElement | null>(null);
const terminalWidth = ref(900);
const terminalHeight = ref(600);
const terminalMinWidth = 480;
const terminalMinHeight = 320;

const { x: terminalX, y: terminalY } = useDraggable(terminalPanelRef, {
  handle: terminalDragHandleRef,
  initialValue: () => ({
    x: Math.max(0, (window.innerWidth - terminalWidth.value) / 2),
    y: Math.max(0, (window.innerHeight - terminalHeight.value) / 2),
  }),
});

const terminalPanelStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${terminalX.value}px`,
  top: `${terminalY.value}px`,
  width: `${terminalWidth.value}px`,
  height: `${terminalHeight.value}px`,
}));

// resize 逻辑
let resizing = false;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;

const onResizeStart = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  resizing = true;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;
  resizeStartW = terminalWidth.value;
  resizeStartH = terminalHeight.value;
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', onResizeEnd);
};

const onResizeMove = (e: MouseEvent) => {
  if (!resizing) return;
  const dx = e.clientX - resizeStartX;
  const dy = e.clientY - resizeStartY;
  terminalWidth.value = Math.max(terminalMinWidth, resizeStartW + dx);
  terminalHeight.value = Math.max(terminalMinHeight, resizeStartH + dy);
};

const onResizeEnd = () => {
  resizing = false;
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
};

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
});

// 编辑弹窗状态
const editVisible = ref(false);
const editForm = ref({
  id: '',
  serverName: '',
  remark: '',
});

// 新建服务器弹窗状态
const createVisible = ref(false);
const createFormRef = ref();
const createLoading = ref(false);
const createFormData = ref({
  name: '',
  description: '',
});

// Token 结果弹窗状态
const tokenResultVisible = ref(false);
const tokenResultData = ref({
  token: '',
  serverName: '',
  serverAgentAddr: '',
});

// 打开终端
const openTerminal = (row: any) => {
  if (row.status !== 'online') {
    Modal.warning({
      title: $t('serverManagement.server.terminalWarning'),
      content: $t('serverManagement.server.serverOffline'),
    });
    return;
  }
  currentServerId.value = row.serverId;
  currentServerName.value = row.serverName;
  // 每次打开居中显示
  terminalX.value = Math.max(0, (window.innerWidth - terminalWidth.value) / 2);
  terminalY.value = Math.max(0, (window.innerHeight - terminalHeight.value) / 2);
  terminalVisible.value = true;
};

// 关闭终端
const closeTerminal = () => {
  terminalVisible.value = false;
  currentServerId.value = '';
  currentServerName.value = '';
};

// 打开编辑弹窗
const openEdit = (row: any) => {
  editForm.value = {
    id: row.id,
    serverName: row.serverName,
    remark: row.remark || '',
  };
  editVisible.value = true;
};

// 刷新数据（兼容两种视图）
const refreshData = () => {
  if (viewMode.value === 'list') {
    gridApi.query();
  } else {
    loadServerList();
  }
};

// 保存编辑
const saveEdit = async () => {
  try {
    await ServerManagementApi.updateServer(editForm.value);
    message.success($t('common.updateSuccess'));
    editVisible.value = false;
    refreshData();
  } catch (error) {
    message.error($t('common.operationFailed'));
  }
};

// 删除服务器
const deleteServer = (row: any) => {
  Modal.confirm({
    title: $t('serverManagement.server.deleteConfirm'),
    content: `${$t('serverManagement.server.serverName')}: ${row.serverName}`,
    onOk: async () => {
      try {
        await ServerManagementApi.deleteServer({ id: row.id });
        message.success($t('common.deleteSuccess'));
        refreshData();
      } catch (error) {
        message.error($t('common.operationFailed'));
      }
    },
  });
};

// 打开新建服务器弹窗
const openCreateModal = () => {
  createFormData.value = {
    name: '',
    description: '',
  };
  createVisible.value = true;
};

// 关闭新建服务器弹窗
const closeCreateModal = () => {
  createVisible.value = false;
  createFormData.value = {
    name: '',
    description: '',
  };
};

// 创建服务器
const handleCreateServer = async () => {
  try {
    await createFormRef.value?.validate();
  } catch (error: any) {
    if (error?.errorFields?.length) {
      // 聚焦第一个错误字段
      const firstField = error.errorFields[0]?.name?.[0];
      if (firstField) {
        await nextTick();
        const el = document.querySelector<HTMLElement>(
          `.create-server-modal [name="${firstField}"]`,
        );
        el?.focus();
      }
    }
    return;
  }

  createLoading.value = true;
  try {
    const [result, sysConfig] = await Promise.all([
      ServerManagementApi.createEnvironmentAgent({
        name: createFormData.value.name,
        description: createFormData.value.description,
      }),
      SystemConfig.getConfig().catch(() => null),
    ]);

    message.success($t('serverManagement.environmentAgent.createSuccess'));
    const savedName = createFormData.value.name;
    closeCreateModal();

    const rawAddr = sysConfig?.serverAgentAddr || '';
    const cleanAddr = rawAddr.replace(/^https?:\/\//i, '');
    tokenResultData.value = {
      token: result.token,
      serverName: savedName,
      serverAgentAddr: cleanAddr,
    };
    tokenResultVisible.value = true;
    refreshData();
  } catch (error: any) {
    message.error(error?.message || $t('common.saveFailed'));
  } finally {
    createLoading.value = false;
  }
};

// 复制Token
const handleCopyToken = async () => {
  try {
    await copyToClipboard(tokenResultData.value.token);
    message.success($t('serverManagement.environmentAgent.copySuccess'));
  } catch {
    message.error($t('common.copyFailed'));
  }
};

// 复制安装命令
const handleCopyInstallCmd = async () => {
  try {
    await copyToClipboard(oneLineInstallCmd.value);
    message.success($t('serverManagement.server.copyInstallCmdSuccess'));
  } catch {
    message.error($t('common.copyFailed'));
  }
};

// 关闭Token结果弹窗
const closeTokenResult = () => {
  tokenResultVisible.value = false;
  tokenResultData.value = {
    token: '',
    serverName: '',
    serverAgentAddr: '',
  };
};

// 格式化时间戳为可读格式
const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// 新建表单验证规则
const createRules: Record<string, Rule[]> = {
  name: [
    {
      message: $t('serverManagement.environmentAgent.nameRequired'),
      required: true,
      trigger: 'blur',
    },
  ],
};

// 一行安装命令
const oneLineInstallCmd = computed(() => {
  const addr = tokenResultData.value.serverAgentAddr || 'your-ezdp-server.com:82';
  const token = tokenResultData.value.token || '<TOKEN>';
  const name = tokenResultData.value.serverName || 'my-server';
  return `curl -fsSL https://oss.geekz.cn:81/devops/ezdp/agent/serverAgent/install.sh | env EZDP_SERVER=${addr} EZDP_TOKEN=${token} EZDP_NAME="${name}" bash`;
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'serverName',
        title: $t('serverManagement.server.serverName'),
        minWidth: 150,
        slots: {
          default: 'serverName',
        },
      },
      {
        field: 'ip',
        title: $t('serverManagement.server.ip'),
        minWidth: 140,
        slots: {
          default: 'ip',
        },
      },
      {
        field: 'arch',
        title: $t('serverManagement.server.arch'),
        minWidth: 120,
        slots: {
          default: 'arch',
        },
      },
      {
        field: 'os',
        title: $t('serverManagement.server.os'),
        minWidth: 140,
        slots: {
          default: 'os',
        },
      },
      {
        field: 'environmentName',
        title: $t('serverManagement.server.environment'),
        minWidth: 120,
      },
      {
        field: 'status',
        title: $t('serverManagement.server.status'),
        minWidth: 100,
        slots: {
          default: 'status',
        },
      },
      {
        field: 'lastSeenAt',
        title: $t('serverManagement.server.lastSeen'),
        minWidth: 180,
        formatter: ({ cellValue }: { cellValue: number }) => {
          return formatTimestamp(cellValue);
        },
      },
      {
        field: 'actions',
        title: $t('common.action'),
        width: 380,
        fixed: 'right',
        slots: {
          default: 'actions',
        },
      },
    ],
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: true },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const res = await ServerManagementApi.getServerList();
          let servers = res.servers || [];

          // 状态过滤
          if (filterStatus.value !== 'all') {
            servers = servers.filter((s) => s.status === filterStatus.value);
          }
          // OS 过滤
          if (filterOs.value !== 'all') {
            servers = servers.filter((s) => getOsCategory(s.os) === filterOs.value);
          }
          // 排序
          servers = applySort(servers);

          const start = (page.currentPage - 1) * page.pageSize;
          const end = start + page.pageSize;
          return {
            total: servers.length,
            items: servers.slice(start, end),
          };
        },
      },
    },
    toolbarConfig: {
      refresh: true,
    },
  },
});

function openDocs() {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
  window.open(`${baseUrl}#/docs?doc=serverAgent-overview`, '_blank');
}

function onCreate() {
  openCreateModal();
}

// 切换视图模式
const switchViewMode = (mode: 'grid' | 'list') => {
  viewMode.value = mode;
  if (mode === 'grid') {
    loadServerList();
  } else {
    gridApi.query();
  }
};

onMounted(() => {
  loadServerList();
  fetchLatestAgentVersion();
});

// ---- 最新 Agent 版本 ----
const latestAgentVersion = ref('');

const fetchLatestAgentVersion = async () => {
  try {
    const res = await fetch('https://oss.geekz.cn:81/devops/ezdp/agent/serverAgent/version.json');
    const data = await res.json();
    latestAgentVersion.value = data.version || '';
  } catch {
    // 获取失败时静默处理，不影响页面功能
  }
};

// 比较版本号，返回 true 表示 current < latest（需要更新）
const needsUpdate = (currentVersion: string): boolean => {
  if (!latestAgentVersion.value || !currentVersion) return false;
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const cur = parse(currentVersion);
  const lat = parse(latestAgentVersion.value);
  for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
    const c = cur[i] ?? 0;
    const l = lat[i] ?? 0;
    if (c < l) return true;
    if (c > l) return false;
  }
  return false;
};

// 正在升级中的服务器 serverId 集合
const upgradingServers = ref<Set<string>>(new Set());

const handleUpgradeAgent = async (server: ServerManagementApi.Server) => {
  if (upgradingServers.value.has(server.serverId)) return;

  Modal.confirm({
    title: $t('serverManagement.server.upgradeConfirmTitle'),
    content: $t('serverManagement.server.upgradeConfirmContent', {
      name: server.serverName,
      current: server.version,
      latest: latestAgentVersion.value,
    }),
    okText: $t('serverManagement.server.upgradeConfirmOk'),
    cancelText: $t('common.cancel'),
    onOk: async () => {
      upgradingServers.value = new Set([...upgradingServers.value, server.serverId]);
      try {
        const res = await ServerManagementApi.upgradeAgent({ serverId: server.serverId });
        if (res.status === 'upgrading') {
          message.info($t('serverManagement.server.upgradeTriggered'));
        } else {
          message.success($t('serverManagement.server.upgradeSuccess'));
        }
        // 延迟 15 秒后刷新列表，等 agent 重启完成
        setTimeout(() => {
          loadServerList();
        }, 15_000);
      } catch (e: any) {
        message.error(e?.message || $t('common.operationFailed'));
      } finally {
        const next = new Set(upgradingServers.value);
        next.delete(server.serverId);
        upgradingServers.value = next;
      }
    },
  });
};

// ---- 状态监控 ----
const statsVisible = ref(false);
const statsServerId = ref('');
const statsServerName = ref('');
const statsCpuModel = ref('');
const statsMemTotal = ref(0);
const statsServer = ref<ServerManagementApi.Server | null>(null);

const openStats = (row: any) => {
  statsServerId.value = row.serverId;
  statsServerName.value = row.serverName;
  statsCpuModel.value = row.cpuModel || '';
  statsMemTotal.value = row.memTotal || 0;
  statsServer.value = row;
  statsVisible.value = true;
};

// ---- 文件管理 ----
const fileVisible = ref(false);
const fileServerId = ref('');
const fileServerName = ref('');

const fileColumns = [
  { key: 'name', title: '名称', ellipsis: true },
  { key: 'size', title: '大小', width: 90 },
  { key: 'mode', title: '权限', width: 120 },
  { key: 'modTime', title: '修改时间', width: 160 },
  { key: 'action', title: '操作', width: 120, fixed: 'right' },
];

// 目录浏览
const currentPath = ref('/');
const dirEntries = ref<ServerManagementApi.FileEntry[]>([]);
const dirLoading = ref(false);

// 路径输入框（快速跳转）
const pathInputVisible = ref(false);
const pathInputValue = ref('');

// 上传
const uploadLoading = ref(false);
const uploadFileList = ref<any[]>([]);

// 下载
const downloadLoading = ref<Record<string, boolean>>({});

// 新建文件夹
const mkdirVisible = ref(false);
const mkdirName = ref('');
const mkdirLoading = ref(false);

const openFileManager = async (row: any) => {
  fileServerId.value = row.serverId;
  fileServerName.value = row.serverName;
  currentPath.value = '/';
  dirEntries.value = [];
  fileVisible.value = true;
  await loadDir('/');
};

const loadDir = async (path: string) => {
  dirLoading.value = true;
  try {
    const res = await ServerManagementApi.listDir({ serverId: fileServerId.value, path });
    currentPath.value = res.path || path;
    dirEntries.value = (res.entries || []).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (e: any) {
    message.error(e?.message || '获取目录失败');
  } finally {
    dirLoading.value = false;
  }
};

const enterDir = async (entry: ServerManagementApi.FileEntry) => {
  if (!entry.isDir) return;
  await loadDir(entry.path);
};

// 面包屑
const breadcrumbs = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean);
  const result: { label: string; path: string }[] = [{ label: '/', path: '/' }];
  let acc = '';
  for (const p of parts) {
    acc += '/' + p;
    result.push({ label: p, path: acc });
  }
  return result;
});

const goUp = async () => {
  if (currentPath.value === '/') return;
  const parent = currentPath.value.replace(/\/[^/]+\/?$/, '') || '/';
  await loadDir(parent);
};

// 路径输入快速跳转
const showPathInput = () => {
  pathInputValue.value = currentPath.value;
  pathInputVisible.value = true;
  nextTick(() => {
    const el = document.getElementById('file-path-input');
    el?.focus();
    (el as HTMLInputElement)?.select();
  });
};

const confirmPathInput = async () => {
  const p = pathInputValue.value.trim() || '/';
  pathInputVisible.value = false;
  await loadDir(p);
};

// 上传
const handleUpload: UploadProps['customRequest'] = async (options) => {
  uploadLoading.value = true;
  try {
    const base = currentPath.value === '/' ? '' : currentPath.value.replace(/\/$/, '');
    const remotePath = base + '/' + (options.file as File).name;
    await ServerManagementApi.uploadFile(fileServerId.value, remotePath, options.file as File);
    message.success('上传成功');
    uploadFileList.value = [];
    await loadDir(currentPath.value);
  } catch (e: any) {
    message.error(e?.message || '上传失败');
  } finally {
    uploadLoading.value = false;
  }
};

// 下载
const handleDownload = async (entry: ServerManagementApi.FileEntry) => {
  downloadLoading.value = { ...downloadLoading.value, [entry.path]: true };
  try {
    const blob = await ServerManagementApi.downloadFile({
      serverId: fileServerId.value,
      remotePath: entry.path,
    });
    const url = URL.createObjectURL(blob as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(url);
    message.success('下载成功');
  } catch (e: any) {
    message.error(e?.message || '下载失败');
  } finally {
    const next = { ...downloadLoading.value };
    delete next[entry.path];
    downloadLoading.value = next;
  }
};

// 删除
const handleDelete = async (entry: ServerManagementApi.FileEntry) => {
  try {
    await ServerManagementApi.deleteFile({
      serverId: fileServerId.value,
      path: entry.path,
      recursive: entry.isDir,
    });
    message.success('删除成功');
    await loadDir(currentPath.value);
  } catch (e: any) {
    message.error(e?.message || '删除失败');
  }
};

// 新建文件夹
const openMkdir = () => {
  mkdirName.value = '';
  mkdirVisible.value = true;
};

const confirmMkdir = async () => {
  const name = mkdirName.value.trim();
  if (!name) return;
  mkdirLoading.value = true;
  try {
    const base = currentPath.value === '/' ? '' : currentPath.value.replace(/\/$/, '');
    await ServerManagementApi.mkdir({ serverId: fileServerId.value, path: base + '/' + name });
    message.success('创建成功');
    mkdirVisible.value = false;
    await loadDir(currentPath.value);
  } catch (e: any) {
    message.error(e?.message || '创建失败');
  } finally {
    mkdirLoading.value = false;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatModTime = (ms: number): string => {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('zh-CN', { hour12: false });
};

// ---- 端口代理 ----
const proxyVisible = ref(false);
const proxyServerId = ref('');
const proxyServerName = ref('');
const proxyList = ref<ServerManagementApi.ProxyInfo[]>([]);
const proxyLoading = ref(false);
const proxyForm = ref({ localPort: '', remoteAddr: '' });
const proxyCreateLoading = ref(false);

const openProxy = async (row: any) => {
  proxyServerId.value = row.serverId;
  proxyServerName.value = row.serverName;
  proxyForm.value = { localPort: '', remoteAddr: '' };
  proxyVisible.value = true;
  await refreshProxyList();
};

const refreshProxyList = async () => {
  proxyLoading.value = true;
  try {
    const res = await ServerManagementApi.getProxyList({ serverId: proxyServerId.value });
    proxyList.value = res.proxies || [];
  } catch {
    message.error('获取代理列表失败');
  } finally {
    proxyLoading.value = false;
  }
};

const handleCreateProxy = async () => {
  if (!proxyForm.value.localPort || !proxyForm.value.remoteAddr) {
    message.warning('请填写本地端口和远端地址');
    return;
  }
  proxyCreateLoading.value = true;
  try {
    await ServerManagementApi.createProxy({
      serverId: proxyServerId.value,
      localPort: proxyForm.value.localPort,
      remoteAddr: proxyForm.value.remoteAddr,
    });
    message.success('代理创建成功');
    proxyForm.value = { localPort: '', remoteAddr: '' };
    await refreshProxyList();
  } catch (e: any) {
    message.error(e?.message || '创建失败');
  } finally {
    proxyCreateLoading.value = false;
  }
};

const handleCloseProxy = async (proxyId: string) => {
  try {
    await ServerManagementApi.closeProxy({ proxyId });
    message.success('代理已关闭');
    await refreshProxyList();
  } catch {
    message.error('关闭失败');
  }
};

const proxyColumns = [
  { title: '本地端口', dataIndex: 'localPort', key: 'localPort' },
  { title: '远端地址', dataIndex: 'remoteAddr', key: 'remoteAddr' },
  { title: '连接数', dataIndex: 'connCount', key: 'connCount' },
  { title: '操作', key: 'action' },
];
</script>

<template>
  <Page auto-content-height>
    <!-- 顶部工具栏（Grid 视图时独立渲染，List 视图时由 Grid 组件渲染） -->
    <div v-if="viewMode === 'grid'" class="server-page-header flex items-center justify-between mb-3">
      <h2 class="text-base font-semibold m-0">{{ $t('serverManagement.server.title') }}</h2>
      <Space>
        <Button type="default" @click="openDocs">
          <IconifyIcon icon="mdi:file-document-outline" class="mr-1 size-4" aria-hidden="true" />
          {{ $t('page.docs.title') }}
        </Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('serverManagement.server.createServer') }}
        </Button>
        <!-- 视图切换 -->
        <div class="view-toggle flex rounded overflow-hidden border border-gray-600">
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'grid' }"
            title="卡片视图"
            @click="switchViewMode('grid')"
          >
            <IconifyIcon icon="mdi:view-grid" class="size-4" />
          </button>
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'list' }"
            title="列表视图"
            @click="switchViewMode('list')"
          >
            <IconifyIcon icon="mdi:view-list" class="size-4" />
          </button>
        </div>
        <Button type="default" @click="loadServerList">
          <IconifyIcon icon="mdi:refresh" class="size-4" :class="{ 'animate-spin': serverListLoading }" />
        </Button>
      </Space>
    </div>

    <!-- 筛选栏（Grid / List 视图共用） -->
    <div class="server-filter-bar mb-4">
      <!-- 状态筛选 -->
      <div class="filter-group">
        <button
          v-for="opt in [
            { label: '全部', value: 'all' },
            { label: '在线', value: 'online' },
            { label: '离线', value: 'offline' },
          ]"
          :key="opt.value"
          class="filter-chip"
          :class="{ active: filterStatus === opt.value }"
          @click="filterStatus = (opt.value as StatusFilter)"
        >
          <span
            v-if="opt.value !== 'all'"
            class="filter-chip__dot"
            :class="opt.value === 'online' ? 'dot-online' : 'dot-offline'"
          />
          {{ opt.label }}
          <span class="filter-chip__count">
            {{
              opt.value === 'all'
                ? serverList.length
                : serverList.filter((s) => s.status === opt.value).length
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
          :class="{ active: filterOs === opt.value }"
          @click="filterOs = opt.value"
        >
          <IconifyIcon :icon="opt.icon" class="size-3.5" />
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

    <!-- Grid 卡片视图 -->
    <div v-if="viewMode === 'grid'">
      <Spin :spinning="serverListLoading">
        <div v-if="serverList.length === 0 && !serverListLoading" class="empty-state flex flex-col items-center justify-center py-20 text-gray-400">
          <IconifyIcon icon="mdi:server-off" class="size-16 mb-4 opacity-30" />
          <p class="text-sm">暂无服务器，点击「新建服务器」添加</p>
        </div>
        <div v-else-if="filteredAndSortedServers.length === 0" class="empty-state flex flex-col items-center justify-center py-16 text-gray-400">
          <IconifyIcon icon="mdi:filter-off-outline" class="size-12 mb-3 opacity-30" />
          <p class="text-sm">没有符合条件的服务器</p>
        </div>
        <div v-else class="server-grid">
          <div
            v-for="server in filteredAndSortedServers"
            :key="server.id"
            class="server-card"
            :class="{ 'server-card--online': server.status === 'online', 'server-card--offline': server.status !== 'online' }"
          >
            <!-- 卡片头部：OS logo + 名称 + 状态 -->
            <div class="server-card__header">
              <div class="server-card__os-icon">
                <IconifyIcon
                  :icon="getOsIcon(server.os, server.osVersion)"
                  class="size-10"
                  :style="{
                    color: getOsIconColor(server.os, server.osVersion),
                    filter: server.status === 'online' ? `drop-shadow(0 0 6px ${getOsIconColor(server.os, server.osVersion)}80)` : 'none',
                    transition: 'color 0.3s, filter 0.3s',
                  }"
                />
              </div>
              <div class="server-card__title-area flex-1 min-w-0">
                <Tooltip>
                  <template #title>
                    <div style="padding: 4px">
                      <div><strong>主机名:</strong> {{ server.hostname || '-' }}</div>
                      <div><strong>版本:</strong> {{ server.version || '-' }}</div>
                      <div><strong>CPU:</strong> {{ server.cpuModel || '-' }}</div>
                    </div>
                  </template>
                  <div class="server-card__name truncate" :title="server.serverName">{{ server.serverName }}</div>
                </Tooltip>
                <div class="server-card__env truncate text-xs text-gray-400">{{ server.environmentName || '-' }}</div>
              </div>
              <Tag
                :color="server.status === 'online' ? 'success' : 'default'"
                class="server-card__status-tag shrink-0"
              >
                {{ server.status === 'online' ? $t('serverManagement.server.online') : $t('serverManagement.server.offline') }}
              </Tag>
              <!-- 版本 tag -->
              <Tooltip
                v-if="server.version"
                :title="upgradingServers.has(server.serverId)
                  ? $t('serverManagement.server.upgrading')
                  : needsUpdate(server.version)
                    ? (server.status === 'online'
                        ? $t('serverManagement.server.agentUpdateClickToUpgrade', { version: latestAgentVersion })
                        : $t('serverManagement.server.agentVersionLatest', { version: latestAgentVersion }))
                    : $t('serverManagement.server.agentLatest')"
              >
                <div
                  class="agent-version-tag shrink-0"
                  :class="{
                    'agent-version-tag--outdated': needsUpdate(server.version),
                    'agent-version-tag--upgrading': upgradingServers.has(server.serverId),
                    'agent-version-tag--clickable': needsUpdate(server.version) && server.status === 'online' && !upgradingServers.has(server.serverId),
                  }"
                  @click.stop="needsUpdate(server.version) && server.status === 'online' && !upgradingServers.has(server.serverId) && handleUpgradeAgent(server)"
                >
                  <IconifyIcon
                    v-if="upgradingServers.has(server.serverId)"
                    icon="mdi:loading"
                    class="size-3 animate-spin"
                  />
                  <span class="agent-version-tag__text">{{ server.version }}</span>
                  <span v-if="needsUpdate(server.version) && !upgradingServers.has(server.serverId)" class="agent-version-tag__dot" />
                </div>
              </Tooltip>
            </div>

            <!-- 卡片信息区 + 迷你图 -->
            <div class="server-card__body">
              <!-- 左侧信息 -->
              <div class="server-card__info">
                <div class="server-card__info-row">
                  <IconifyIcon icon="mdi:ip-network" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate">
                    <span v-if="server.publicIp">{{ server.publicIp }}</span>
                    <span v-if="server.privateIps" class="text-gray-400 ml-1 text-xs">{{ server.privateIps }}</span>
                    <span v-if="!server.publicIp && !server.privateIps" class="text-gray-400">-</span>
                  </span>
                </div>
                <div v-if="server.ipLocation" class="server-card__info-row">
                  <IconifyIcon icon="mdi:map-marker-outline" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate">{{ server.ipLocation }}</span>
                </div>
                <div v-if="server.remark" class="server-card__info-row">
                  <IconifyIcon icon="mdi:note-text-outline" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs">{{ server.remark }}</span>
                </div>
                <div class="server-card__info-row">
                  <IconifyIcon icon="mdi:chip" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="font-mono text-xs truncate">{{ [server.os, server.arch].filter(Boolean).join('/') || '-' }}</span>
                </div>
                <div class="server-card__info-row">
                  <IconifyIcon icon="mdi:monitor-dashboard" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate">{{ server.osVersion || server.os || '-' }}</span>
                </div>
                <div class="server-card__info-row">
                  <IconifyIcon icon="mdi:clock-outline" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate text-xs">{{ formatTimestamp(server.lastSeenAt) }}</span>
                </div>
              </div>

              <!-- 右侧迷你图（仅在线且有 stats 时显示） -->
              <div v-if="server.status === 'online' && serverStatsMap[server.serverId]" class="server-card__mini-stats">
                <MiniGauge
                  label="CPU"
                  :value="serverStatsMap[server.serverId]!.cpu.usagePercent"
                />
                <MiniGauge
                  label="MEM"
                  :value="serverStatsMap[server.serverId]!.memory.usedPercent"
                />
              </div>
            </div>

            <!-- 卡片操作区 -->
            <div class="server-card__actions">
              <Button
                type="primary"
                size="small"
                :disabled="server.status !== 'online'"
                style="flex: 1; min-width: 0;"
                @click="openTerminal(server)"
              >
                <IconifyIcon icon="mdi:console" class="size-3.5 mr-1" />
                {{ $t('serverManagement.server.openTerminal') }}
              </Button>
              <Button
                size="small"
                :disabled="server.status !== 'online'"
                @click="openStats(server)"
              >
                <IconifyIcon icon="mdi:chart-line" class="size-3.5" />
              </Button>
              <Button
                size="small"
                :disabled="server.status !== 'online'"
                @click="openFileManager(server)"
              >
                <IconifyIcon icon="mdi:folder-open" class="size-3.5" />
              </Button>
              <Button
                size="small"
                :disabled="server.status !== 'online'"
                @click="openProxy(server)"
              >
                <IconifyIcon icon="mdi:transit-connection-variant" class="size-3.5" />
              </Button>
              <Button size="small" @click="openEdit(server)">
                <IconifyIcon icon="mdi:pencil" class="size-3.5" />
              </Button>
              <Button danger size="small" @click="deleteServer(server)">
                <IconifyIcon icon="mdi:delete" class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Spin>
    </div>

    <!-- List 表格视图 -->
    <Grid v-if="viewMode === 'list'" :table-title="$t('serverManagement.server.title')">
      <template #toolbar-tools>
        <Button type="default" class="mr-3" @click="openDocs">
          <IconifyIcon icon="mdi:file-document-outline" class="mr-1 size-4" aria-hidden="true" />
          {{ $t('page.docs.title') }}
        </Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('serverManagement.server.createServer') }}
        </Button>
        <!-- 视图切换 -->
        <div class="view-toggle flex rounded overflow-hidden border border-gray-600 ml-3">
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'grid' }"
            title="卡片视图"
            @click="switchViewMode('grid')"
          >
            <IconifyIcon icon="mdi:view-grid" class="size-4" />
          </button>
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'list' }"
            title="列表视图"
            @click="switchViewMode('list')"
          >
            <IconifyIcon icon="mdi:view-list" class="size-4" />
          </button>
        </div>
      </template>
      <!-- 服务器名称（带 hover 显示详细信息） -->
      <template #serverName="{ row }">
        <Tooltip>
          <template #title>
            <div style="padding: 8px">
              <div><strong>{{ $t('serverManagement.server.hostname') }}:</strong> {{ row.hostname || '-' }}</div>
              <div><strong>{{ $t('serverManagement.server.os') }}:</strong> {{ row.os || '-' }}</div>
              <div><strong>{{ $t('serverManagement.server.arch') }}:</strong> {{ row.arch || '-' }}</div>
              <div><strong>{{ $t('serverManagement.server.version') }}:</strong> {{ row.version || '-' }}</div>
            </div>
          </template>
          <span style="cursor: help; border-bottom: 1px dashed #999">{{ row.serverName }}</span>
        </Tooltip>
      </template>

      <!-- 状态标签 -->
      <template #status="{ row }">
        <Tag v-if="row.status === 'online'" color="success">
          {{ $t('serverManagement.server.online') }}
        </Tag>
        <Tag v-else color="default">
          {{ $t('serverManagement.server.offline') }}
        </Tag>
      </template>

      <!-- IP 地址 + 归属地 -->
      <template #ip="{ row }">
        <div class="leading-tight">
          <div v-if="row.publicIp" class="text-sm">
            {{ row.publicIp }}
            <span v-if="row.ipLocation" class="text-xs text-gray-400 ml-1">({{ row.ipLocation }})</span>
          </div>
          <!-- 内网 IP -->
          <div v-if="row.privateIps" class="text-xs text-gray-400">{{ row.privateIps }}</div>
          <div v-if="!row.publicIp && !row.privateIps" class="text-sm">-</div>
        </div>
      </template>

      <!-- 架构：os/arch 格式 -->
      <template #arch="{ row }">
        <span v-if="row.os || row.arch" class="text-sm font-mono">
          {{ [row.os, row.arch].filter(Boolean).join('/') }}
        </span>
        <span v-else class="text-gray-400">-</span>
      </template>

      <!-- 操作系统：显示发行版名称 + logo -->
      <template #os="{ row }">
        <div class="flex items-center gap-1.5">
          <IconifyIcon
            :icon="getOsIcon(row.os, row.osVersion)"
            class="size-4 shrink-0"
            :style="{ color: getOsIconColor(row.os, row.osVersion) }"
          />
          <span class="text-sm">{{ row.osVersion || row.os || '-' }}</span>
        </div>
      </template>

      <!-- 操作按钮 -->
      <template #actions="{ row }">
        <Space :size="4" wrap>
          <Button
            type="primary"
            size="small"
            :disabled="row.status !== 'online'"
            @click="openTerminal(row)"
          >
            {{ $t('serverManagement.server.openTerminal') }}
          </Button>
          <Button
            size="small"
            :disabled="row.status !== 'online'"
            @click="openStats(row)"
          >
            监控
          </Button>
          <Button
            size="small"
            :disabled="row.status !== 'online'"
            @click="openFileManager(row)"
          >
            文件
          </Button>
          <Button
            size="small"
            :disabled="row.status !== 'online'"
            @click="openProxy(row)"
          >
            代理
          </Button>
          <Button
            size="small"
            @click="openEdit(row)"
          >
            {{ $t('common.edit') }}
          </Button>
          <Button
            danger
            size="small"
            @click="deleteServer(row)"
          >
            {{ $t('common.delete') }}
          </Button>
        </Space>
      </template>
    </Grid>

    <!-- 终端浮层（可拖动 + 可缩放） -->
    <Teleport to="body">
      <div
        v-if="terminalVisible"
        ref="terminalPanelRef"
        class="terminal-float-panel"
        :style="terminalPanelStyle"
      >
        <div ref="terminalDragHandleRef" class="terminal-float-header">
          <div class="terminal-float-title">
            <span class="terminal-float-dot red"></span>
            <span class="terminal-float-dot yellow"></span>
            <span class="terminal-float-dot green"></span>
            <span class="terminal-float-name">{{ $t('serverManagement.server.terminal') }} — {{ currentServerName }}</span>
          </div>
          <button class="terminal-float-close" @click="closeTerminal">✕</button>
        </div>
        <div class="terminal-float-body">
          <WebTerminal
            v-if="terminalVisible"
            :server-id="currentServerId"
            :title="currentServerName"
            @close="closeTerminal"
          />
        </div>
        <div class="terminal-resize-handle" @mousedown="onResizeStart"></div>
      </div>
    </Teleport>

    <!-- 编辑弹窗 -->
    <Modal
      v-model:open="editVisible"
      :title="$t('serverManagement.server.editServer')"
      @ok="saveEdit"
    >
      <Form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <FormItem :label="$t('serverManagement.server.serverName')">
          <Input v-model:value="editForm.serverName" />
        </FormItem>
        <FormItem :label="$t('serverManagement.server.remark')">
          <Input.TextArea
            v-model:value="editForm.remark"
            :placeholder="$t('serverManagement.server.remarkPlaceholder')"
            :rows="3"
            :maxlength="512"
            show-count
          />
        </FormItem>
      </Form>
    </Modal>

    <!-- 新建服务器弹窗 -->
    <Modal
      v-model:open="createVisible"
      :title="$t('serverManagement.server.createServer')"
      :width="580"
      :confirm-loading="createLoading"
      :ok-text="$t('serverManagement.server.createAndShowToken')"
      :cancel-text="$t('common.cancel')"
      wrap-class-name="create-server-modal"
      @ok="handleCreateServer"
      @cancel="closeCreateModal"
    >
      <Form
        ref="createFormRef"
        :model="createFormData"
        :rules="createRules"
        layout="vertical"
      >
        <FormItem
          :label="$t('serverManagement.environmentAgent.name')"
          name="name"
        >
          <Input
            v-model:value="createFormData.name"
            name="name"
            autocomplete="off"
            :maxlength="50"
            :placeholder="$t('serverManagement.environmentAgent.namePlaceholder')"
          />
        </FormItem>

        <FormItem
          :label="$t('serverManagement.environmentAgent.description')"
          name="description"
        >
          <Input.TextArea
            v-model:value="createFormData.description"
            name="description"
            autocomplete="off"
            spellcheck="false"
            :maxlength="200"
            show-count
            :placeholder="$t('serverManagement.environmentAgent.descriptionPlaceholder')"
            :rows="4"
          />
        </FormItem>
      </Form>

      <Alert
        class="create-server-instruction"
        :message="$t('serverManagement.server.instructionTitle')"
        type="info"
        show-icon
      >
        <template #description>
          <ul class="create-server-instruction-list">
            <li>{{ $t('serverManagement.server.instruction1') }}</li>
            <li>{{ $t('serverManagement.server.instruction2') }}</li>
            <li class="create-server-instruction-warning">{{ $t('serverManagement.server.instruction3') }}</li>
          </ul>
        </template>
      </Alert>
    </Modal>

    <!-- Token 结果弹窗 -->
    <Modal
      v-model:open="tokenResultVisible"
      :title="$t('serverManagement.server.tokenResult')"
      :width="700"
      :footer="null"
      :mask-closable="false"
    >
      <div class="space-y-4">
        <!-- 警告提示 -->
        <Alert
          :message="$t('serverManagement.environmentAgent.tokenAlertTitle')"
          :description="$t('serverManagement.environmentAgent.tokenWarning')"
          type="warning"
          show-icon
        />

        <!-- Token 显示区域 -->
        <div>
          <div class="text-sm font-medium mb-2">
            {{ $t('serverManagement.environmentAgent.token') }}
          </div>
          <div class="flex items-center gap-2">
            <Input
              :value="tokenResultData.token"
              readonly
              class="font-mono text-sm"
            />
            <Button type="primary" @click="handleCopyToken">
              {{ $t('serverManagement.environmentAgent.copyToken') }}
            </Button>
          </div>
        </div>

        <!-- 一行安装命令 -->
        <div>
          <div class="text-sm font-medium mb-2">
            {{ $t('serverManagement.server.oneLineInstall') }}
          </div>
          <p class="text-xs text-gray-400 mb-2">{{ $t('serverManagement.server.oneLineInstallDesc') }}</p>
          <div class="relative bg-gray-900 rounded-lg p-3 pr-28 overflow-x-auto">
            <pre class="text-xs font-mono text-gray-100 whitespace-pre-wrap break-all">{{ oneLineInstallCmd }}</pre>
            <Button
              type="primary"
              size="small"
              class="absolute right-3 top-3"
              @click="handleCopyInstallCmd"
            >
              {{ $t('serverManagement.server.copyInstallCmd') }}
            </Button>
          </div>
        </div>

        <!-- 重要提示 -->
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="font-medium text-blue-900 mb-2 text-sm">
            {{ $t('serverManagement.server.importantNote') }}
          </div>
          <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>{{ $t('serverManagement.server.note1') }}</li>
            <li>{{ $t('serverManagement.server.note2') }}</li>
            <li>{{ $t('serverManagement.server.note3') }}</li>
          </ul>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end pt-2">
          <Button type="primary" @click="closeTokenResult">
            {{ $t('serverManagement.server.closeAndReturn') }}
          </Button>
        </div>
      </div>
    </Modal>

    <!-- 状态监控弹窗 -->
    <MonitorModal
      v-model:open="statsVisible"
      :server-id="statsServerId"
      :server-name="statsServerName"
      :cpu-model="statsCpuModel"
      :mem-total="statsMemTotal"
      :server="statsServer"
    />

    <!-- 文件管理弹窗 -->
    <Modal
      v-model:open="fileVisible"
      :title="`文件管理 - ${fileServerName}`"
      :width="900"
      :footer="null"
      :destroy-on-close="true"
      wrap-class-name="file-manager-modal"
    >
      <div class="flex flex-col" style="height: calc(80vh - 110px)">
        <!-- 地址栏 -->
        <div class="flex items-center gap-2 mb-2 px-1">
          <!-- 返回上级 -->
          <Button size="small" :disabled="currentPath === '/'" @click="goUp">↑</Button>

          <!-- 面包屑 / 路径输入框 -->
          <div class="flex-1 min-w-0">
            <div
              v-if="!pathInputVisible"
              class="flex items-center gap-1 px-2 py-1 rounded border border-transparent hover:border-gray-500 cursor-text select-none overflow-x-auto whitespace-nowrap"
              style="font-size: 13px"
              @click="showPathInput"
            >
              <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.path">
                <span
                  class="hover:text-blue-400 cursor-pointer shrink-0"
                  @click.stop="loadDir(crumb.path)"
                >{{ crumb.label }}</span>
                <span v-if="idx < breadcrumbs.length - 1" class="text-gray-500 shrink-0">/</span>
              </template>
            </div>
            <Input
              v-else
              id="file-path-input"
              v-model:value="pathInputValue"
              size="small"
              @blur="confirmPathInput"
              @press-enter="confirmPathInput"
            />
          </div>

          <!-- 工具按钮 -->
          <Space size="small">
            <Button size="small" @click="openMkdir">新建文件夹</Button>
            <Upload
              v-model:file-list="uploadFileList"
              :custom-request="handleUpload"
              :max-count="1"
              :show-upload-list="false"
            >
              <Button size="small" :loading="uploadLoading">上传文件</Button>
            </Upload>
            <Button size="small" @click="loadDir(currentPath)">刷新</Button>
          </Space>
        </div>

        <!-- 文件列表 -->
        <div class="flex-1 overflow-hidden min-h-0">
          <Spin :spinning="dirLoading" class="h-full">
            <Table
              :data-source="dirEntries"
              :columns="fileColumns"
              :pagination="false"
              size="small"
              row-key="path"
              :scroll="{ y: 'calc(80vh - 200px)', x: 'max-content' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <span
                    :class="record.isDir ? 'cursor-pointer hover:text-blue-400' : ''"
                    @click="record.isDir && enterDir(record)"
                  >
                    <span class="mr-1">{{ record.isDir ? '📁' : '📄' }}</span>
                    {{ record.name }}
                  </span>
                </template>
                <template v-else-if="column.key === 'size'">
                  <span class="text-gray-400 text-xs">{{ record.isDir ? '-' : formatFileSize(record.size) }}</span>
                </template>
                <template v-else-if="column.key === 'mode'">
                  <span class="font-mono text-xs text-gray-400">{{ record.mode }}</span>
                </template>
                <template v-else-if="column.key === 'modTime'">
                  <span class="text-xs text-gray-400">{{ formatModTime(record.modTime) }}</span>
                </template>
                <template v-else-if="column.key === 'action'">
                  <Space size="small">
                    <Button
                      v-if="!record.isDir"
                      size="small"
                      type="link"
                      :loading="!!downloadLoading[record.path]"
                      @click="handleDownload(record)"
                    >下载</Button>
                    <Popconfirm
                      :title="`确认删除 ${record.name}${record.isDir ? ' 及其所有内容' : ''}？`"
                      ok-text="删除"
                      ok-type="danger"
                      cancel-text="取消"
                      @confirm="handleDelete(record)"
                    >
                      <Button size="small" type="link" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                </template>
              </template>
            </Table>
          </Spin>
        </div>
      </div>
    </Modal>

    <!-- 新建文件夹弹窗 -->
    <Modal
      v-model:open="mkdirVisible"
      title="新建文件夹"
      :width="360"
      :confirm-loading="mkdirLoading"
      ok-text="创建"
      cancel-text="取消"
      @ok="confirmMkdir"
    >
      <div class="py-2">
        <div class="text-xs text-gray-400 mb-2">当前路径：{{ currentPath }}</div>
        <Input
          v-model:value="mkdirName"
          placeholder="文件夹名称"
          @press-enter="confirmMkdir"
        />
      </div>
    </Modal>

    <!-- 端口代理弹窗 -->
    <Modal
      v-model:open="proxyVisible"
      :title="`端口代理 - ${proxyServerName}`"
      :width="640"
      :footer="null"
      :destroy-on-close="true"
    >
      <div class="space-y-4">
        <Card title="创建新代理" size="small">
          <Space>
            <Input v-model:value="proxyForm.localPort" placeholder="本地端口 如 13306" style="width: 160px" />
            <span class="text-gray-400">→</span>
            <Input v-model:value="proxyForm.remoteAddr" placeholder="远端地址 如 localhost:3306" style="width: 200px" />
            <Button type="primary" :loading="proxyCreateLoading" @click="handleCreateProxy">创建</Button>
          </Space>
          <div class="text-xs text-gray-400 mt-2">服务端监听本地端口，流量通过 Agent 转发到远端目标</div>
        </Card>

        <Card title="当前代理列表" size="small" :extra="h('a', { onClick: refreshProxyList }, '刷新')">
          <Spin :spinning="proxyLoading">
            <Table
              :data-source="proxyList"
              :columns="proxyColumns"
              :pagination="false"
              size="small"
              row-key="proxyId"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                  <Button danger size="small" @click="handleCloseProxy(record.proxyId)">关闭</Button>
                </template>
              </template>
            </Table>
          </Spin>
        </Card>
      </div>
    </Modal>
  </Page>
</template>

<style>
.terminal-modal .ant-modal-body {
  padding: 0;
  height: 600px;
}

.terminal-float-panel {
  z-index: 1050;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  min-width: 480px;
  min-height: 320px;
}

.terminal-float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #2d2d2d;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
  border-bottom: 1px solid #3e3e3e;
}

.terminal-float-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.terminal-float-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  &.red    { background: #ff5f57; }
  &.yellow { background: #febc2e; }
  &.green  { background: #28c840; }
}

.terminal-float-name {
  margin-left: 8px;
  font-size: 13px;
  color: #d4d4d4;
  font-weight: 500;
}

.terminal-float-close {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  &:hover { color: #fff; background: #ff5f57; }
}

.terminal-float-body {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.terminal-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, #555 50%, #555 60%, transparent 60%, transparent 70%, #555 70%, #555 80%, transparent 80%);
}

.file-manager-modal .ant-modal-body {
  padding: 12px 16px;
}

.file-manager-modal .ant-table-wrapper,
.file-manager-modal .ant-spin-nested-loading,
.file-manager-modal .ant-spin-container,
.file-manager-modal .ant-table,
.file-manager-modal .ant-table-container {
  height: 100%;
}

.file-manager-modal .ant-table-body {
  flex: 1;
  overflow-y: auto !important;
  height: calc(80vh - 200px) !important;
  max-height: none !important;
}

/* 新建服务器弹窗样式优化 */
.create-server-modal .ant-modal-header {
  padding: 20px 24px 12px;
}

.create-server-modal .ant-modal-body {
  padding: 12px 24px 8px;
}

.create-server-modal .ant-modal-footer {
  padding: 12px 24px 20px;
}

.create-server-modal .ant-form-item {
  margin-bottom: 16px;
}

.create-server-modal .ant-alert-info {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.create-server-modal .ant-alert-info .ant-alert-message {
  color: rgba(255, 255, 255, 0.92);
}

.create-server-modal .ant-alert-info .ant-alert-description {
  color: rgba(255, 255, 255, 0.72);
}

.create-server-modal .ant-alert-info .ant-alert-icon {
  color: #1677ff;
}
</style>

<style scoped>
.create-server-instruction {
  margin-top: 16px;
  border-radius: 8px;
}

.create-server-instruction-list {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
  line-height: 1.8;
  font-size: 13px;
}

.create-server-instruction-list li {
  margin-bottom: 4px;
}

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

/* 服务器卡片网格 */
.server-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.server-card {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.server-card:hover {
  border-color: #52c41a;
  border-left-color: #52c41a;
  box-shadow: 0 4px 16px rgba(82, 196, 26, 0.2);
}

.server-card--online {
  border-left: 3px solid #52c41a;
}

.server-card--offline {
  border-left: 3px solid rgba(255, 255, 255, 0.15);
  opacity: 0.75;
}

.server-card__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.server-card__os-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.server-card__title-area {
  padding-top: 2px;
}

.server-card__name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
}

.server-card__env {
  margin-top: 2px;
  line-height: 1.4;
}

.server-card__status-tag {
  margin-top: 2px;
}

.server-card__body {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  height: 148px;
  overflow: hidden;
}

.server-card__info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.server-card__info::-webkit-scrollbar {
  width: 3px;
}

.server-card__info::-webkit-scrollbar-track {
  background: transparent;
}

.server-card__info::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.server-card__info::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.server-card__mini-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  flex-shrink: 0;
}

.server-card__info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  min-width: 0;
}

.server-card__actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}

.server-card__actions :deep(.ant-btn):not(:first-child) {
  flex-shrink: 0;
}

/* 页面头部 */
.server-page-header {
  padding: 0 2px;
}

/* 筛选栏 */
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

.create-server-instruction-warning {
  font-weight: 500;
  color: #d46b08;
}

/* Agent 版本 tag */
.agent-version-tag {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: rgba(255, 255, 255, 0.45);
  cursor: default;
  transition: border-color 0.2s, color 0.2s;
  line-height: 18px;
}

.agent-version-tag--outdated {
  border-color: rgba(255, 77, 79, 0.4);
  color: rgba(255, 255, 255, 0.65);
}

.agent-version-tag--clickable {
  cursor: pointer;
}

.agent-version-tag--clickable:hover {
  border-color: rgba(255, 77, 79, 0.7);
  background: rgba(255, 77, 79, 0.12);
  color: #ff7875;
}

.agent-version-tag--upgrading {
  border-color: rgba(250, 173, 20, 0.5);
  color: rgba(250, 173, 20, 0.85);
  cursor: default;
}

.agent-version-tag__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff4d4f;
  flex-shrink: 0;
  animation: version-dot-pulse 2s ease-in-out infinite;
}

@keyframes version-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}
</style>
