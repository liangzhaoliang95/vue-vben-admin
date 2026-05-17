<script lang="ts" setup>
import { computed, h, nextTick, onMounted, ref, watch } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { IconifyIcon } from '@vben/icons';

import { Button, Modal, Space, Tag, Tooltip, message, Form, FormItem, Input, Card, Collapse, CollapsePanel, Alert, Table, Upload, Spin, Popconfirm } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import type { UploadProps } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ServerManagementApi } from '#/api/server-management';
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
      lower.includes('alpine')) return 'linux';
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
const getOsIcon = (os: string): string => {
  const lower = (os || '').toLowerCase();
  if (lower.includes('darwin') || lower.includes('macos') || lower.includes('mac os')) {
    return 'simple-icons:apple';
  }
  if (lower.includes('ubuntu')) return 'simple-icons:ubuntu';
  if (lower.includes('debian')) return 'simple-icons:debian';
  if (lower.includes('centos')) return 'simple-icons:centos';
  if (lower.includes('fedora')) return 'simple-icons:fedora';
  if (lower.includes('arch')) return 'simple-icons:archlinux';
  if (lower.includes('alpine')) return 'simple-icons:alpinelinux';
  if (lower.includes('linux')) return 'simple-icons:linux';
  if (lower.includes('windows')) return 'simple-icons:windows';
  if (lower.includes('freebsd') || lower.includes('bsd')) return 'simple-icons:freebsd';
  return 'mdi:server';
};

// 根据 OS 返回图标颜色
const getOsIconColor = (os: string): string => {
  const lower = (os || '').toLowerCase();
  if (lower.includes('darwin') || lower.includes('macos')) return '#a0a0a0';
  if (lower.includes('ubuntu')) return '#e95420';
  if (lower.includes('debian')) return '#a80030';
  if (lower.includes('centos')) return '#932279';
  if (lower.includes('fedora')) return '#294172';
  if (lower.includes('arch')) return '#1793d1';
  if (lower.includes('alpine')) return '#0d597f';
  if (lower.includes('windows')) return '#0078d4';
  if (lower.includes('freebsd')) return '#ab2b28';
  return '#6b7280';
};

// 终端弹窗状态
const terminalVisible = ref(false);
const currentServerId = ref('');
const currentServerName = ref('');

// 编辑弹窗状态
const editVisible = ref(false);
const editForm = ref({
  id: '',
  serverName: '',
  ip: '',
  ipLocation: '',
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
    ip: row.ip || '',
    ipLocation: row.ipLocation || '',
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
    const result = await ServerManagementApi.createEnvironmentAgent({
      name: createFormData.value.name,
      description: createFormData.value.description,
    });

    message.success($t('serverManagement.environmentAgent.createSuccess'));
    closeCreateModal();

    tokenResultData.value = {
      token: result.token,
      serverName: createFormData.value.name,
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

// 关闭Token结果弹窗
const closeTokenResult = () => {
  tokenResultVisible.value = false;
  tokenResultData.value = {
    token: '',
    serverName: '',
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

// 安装命令计算属性
const installCommands = computed(() => ({
  download: `# 下载安装脚本
curl -fsSL https://oss.geekz.cn:81/devops/ezdp/agent/serverAgent/install.sh -o install.sh
chmod +x install.sh

# 安装
sudo ./install.sh install`,
  config: `# 配置 Token（从 EZDP 管理后台获取）
sudo vim /etc/ezdp-server-agent/config.json

# 在配置文件中填入 Token
# {
#   "serverAddr": "your-backend-server.com:82",
#   "serverName": "${tokenResultData.value.serverName || 'your-server-name'}",
#   "token": "${tokenResultData.value.token}"
# }`,
  start: `# 启动服务
sudo ./install.sh start

# 设置开机自启
sudo ./install.sh enable

# 查看服务状态
sudo ./install.sh status`,
}));

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
    proxyConfig: {
      ajax: {
        query: async () => {
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

          return {
            page: { total: servers.length },
            items: servers,
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
});

// ---- 状态监控 ----
const statsVisible = ref(false);
const statsServerId = ref('');
const statsServerName = ref('');
const statsCpuModel = ref('');
const statsMemTotal = ref(0);

const openStats = (row: any) => {
  statsServerId.value = row.serverId;
  statsServerName.value = row.serverName;
  statsCpuModel.value = row.cpuModel || '';
  statsMemTotal.value = row.memTotal || 0;
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
                  :icon="getOsIcon(server.os)"
                  class="size-10"
                  :style="{
                    color: server.status === 'online' ? getOsIconColor(server.os) : '#4b5563',
                    filter: server.status === 'online' ? `drop-shadow(0 0 6px ${getOsIconColor(server.os)}80)` : 'none',
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
            </div>

            <!-- 卡片信息区 + 迷你图 -->
            <div class="server-card__body">
              <!-- 左侧信息 -->
              <div class="server-card__info">
                <div class="server-card__info-row">
                  <IconifyIcon icon="mdi:ip-network" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate">
                    <span v-if="server.publicIp || server.ip">{{ server.publicIp || server.ip }}</span>
                    <span v-if="server.privateIps" class="text-gray-400 ml-1 text-xs">{{ server.privateIps }}</span>
                    <span v-if="!server.publicIp && !server.ip && !server.privateIps" class="text-gray-400">-</span>
                  </span>
                </div>
                <div v-if="server.ipLocation" class="server-card__info-row">
                  <IconifyIcon icon="mdi:map-marker-outline" class="size-3.5 shrink-0 text-gray-400" />
                  <span class="truncate">{{ server.ipLocation }}</span>
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
          <!-- 公网 IP：优先显示 agent 上报的 publicIp，其次手动填写的 ip -->
          <div v-if="row.publicIp || row.ip" class="text-sm">
            {{ row.publicIp || row.ip }}
            <span v-if="row.ipLocation" class="text-xs text-gray-400 ml-1">({{ row.ipLocation }})</span>
          </div>
          <!-- 内网 IP -->
          <div v-if="row.privateIps" class="text-xs text-gray-400">{{ row.privateIps }}</div>
          <div v-if="!row.publicIp && !row.ip && !row.privateIps" class="text-sm">-</div>
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
            :icon="getOsIcon(row.os)"
            class="size-4 shrink-0"
            :style="{ color: getOsIconColor(row.os) }"
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

    <!-- 终端弹窗 -->
    <Modal
      v-model:open="terminalVisible"
      :title="`${$t('serverManagement.server.terminal')} - ${currentServerName}`"
      width="80%"
      :footer="null"
      :destroy-on-close="true"
      wrap-class-name="terminal-modal"
      @cancel="closeTerminal"
    >
      <div style="height: 600px">
        <WebTerminal
          v-if="terminalVisible"
          :server-id="currentServerId"
          :title="currentServerName"
          @close="closeTerminal"
        />
      </div>
    </Modal>

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
        <FormItem :label="$t('serverManagement.server.ip')">
          <Input
            v-model:value="editForm.ip"
            :placeholder="$t('serverManagement.server.ipPlaceholder')"
          />
        </FormItem>
        <FormItem :label="$t('serverManagement.server.ipLocation')">
          <Input
            v-model:value="editForm.ipLocation"
            :placeholder="$t('serverManagement.server.ipLocationPlaceholder')"
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
      :width="800"
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
        <div class="space-y-3">
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

          <div class="pt-3 border-t">
            <div class="text-sm font-medium mb-1">
              {{ $t('serverManagement.server.serverName') }}
            </div>
            <div class="text-gray-700 text-sm">{{ tokenResultData.serverName || '-' }}</div>
          </div>
        </div>

        <!-- 安装教程 -->
        <Collapse>
          <CollapsePanel :header="$t('serverManagement.server.step1Title')" key="1">
            <p class="mb-3 text-sm text-gray-600">
              {{ $t('serverManagement.server.step1Desc') }}
            </p>
            <div class="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
              <pre class="text-xs font-mono whitespace-pre-wrap">{{
                installCommands.download
              }}</pre>
            </div>
          </CollapsePanel>

          <CollapsePanel :header="$t('serverManagement.server.step2Title')" key="2">
            <p class="mb-3 text-sm text-gray-600">
              {{ $t('serverManagement.server.step2Desc') }}
            </p>
            <div class="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
              <pre class="text-xs font-mono whitespace-pre-wrap">{{
                installCommands.config
              }}</pre>
            </div>
          </CollapsePanel>

          <CollapsePanel :header="$t('serverManagement.server.step3Title')" key="3">
            <p class="mb-3 text-sm text-gray-600">
              {{ $t('serverManagement.server.step3Desc') }}
            </p>
            <div class="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
              <pre class="text-xs font-mono whitespace-pre-wrap">{{
                installCommands.start
              }}</pre>
            </div>
          </CollapsePanel>
        </Collapse>

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
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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
  overflow: hidden;
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
</style>
