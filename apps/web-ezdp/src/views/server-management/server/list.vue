<script lang="ts" setup>
import { computed, h, nextTick, ref } from 'vue';
import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { IconifyIcon } from '@vben/icons';

import { Button, Modal, Space, Tag, Tooltip, message, Form, FormItem, Input, Card, Collapse, CollapsePanel, Alert, Progress, Table, Upload, Spin, Descriptions, DescriptionsItem, Popconfirm } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import type { UploadProps } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ServerManagementApi } from '#/api/server-management';
import { $t } from '#/locales';
import { copyToClipboard } from '#/utils/clipboard';
import WebTerminal from '#/components/web-terminal/index.vue';

defineOptions({
  name: 'ServerList',
});

// 终端弹窗状态
const terminalVisible = ref(false);
const currentServerId = ref('');
const currentServerName = ref('');

// 编辑弹窗状态
const editVisible = ref(false);
const editForm = ref({
  id: '',
  serverName: '',
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
  };
  editVisible.value = true;
};

// 保存编辑
const saveEdit = async () => {
  try {
    await ServerManagementApi.updateServer(editForm.value);
    message.success($t('common.updateSuccess'));
    editVisible.value = false;
    gridApi.query();
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
        gridApi.query();
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
    gridApi.query();
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
        field: 'serverId',
        title: $t('serverManagement.server.serverId'),
        minWidth: 200,
      },
      {
        field: 'serverName',
        title: $t('serverManagement.server.serverName'),
        minWidth: 150,
        slots: {
          default: 'serverName',
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
          const servers = res.servers || [];

          return {
            page: {
              total: servers.length,
            },
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

// ---- 状态监控 ----
const statsVisible = ref(false);
const statsServerId = ref('');
const statsServerName = ref('');
const statsData = ref<ServerManagementApi.ServerStats | null>(null);
const statsLoading = ref(false);

const openStats = async (row: any) => {
  statsServerId.value = row.serverId;
  statsServerName.value = row.serverName;
  statsData.value = null;
  statsVisible.value = true;
  await refreshStats();
};

const refreshStats = async () => {
  statsLoading.value = true;
  try {
    const res = await ServerManagementApi.getServerStats({ serverId: statsServerId.value });
    statsData.value = res.stats;
  } catch {
    message.error('获取状态失败');
  } finally {
    statsLoading.value = false;
  }
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatUptime = (seconds: number) => {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}天 ${h}小时` : h > 0 ? `${h}小时 ${m}分钟` : `${m}分钟`;
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
    <Grid :table-title="$t('serverManagement.server.title')">
      <template #toolbar-tools>
        <Button type="default" class="mr-3" @click="openDocs">
          <IconifyIcon icon="mdi:file-document-outline" class="mr-1 size-4" aria-hidden="true" />
          {{ $t('page.docs.title') }}
        </Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('serverManagement.server.createServer') }}
        </Button>
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
    <Modal
      v-model:open="statsVisible"
      :title="`监控 - ${statsServerName}`"
      :width="700"
      :footer="null"
      :destroy-on-close="true"
    >
      <div class="mb-3 flex justify-end">
        <Button :loading="statsLoading" @click="refreshStats">刷新</Button>
      </div>
      <Spin :spinning="statsLoading">
        <div v-if="statsData" class="space-y-4">
          <Descriptions bordered :column="2" size="small">
            <DescriptionsItem label="运行时间">{{ formatUptime(statsData.uptime) }}</DescriptionsItem>
            <DescriptionsItem label="进程数">{{ statsData.processCount }}</DescriptionsItem>
            <DescriptionsItem label="系统负载 (1/5/15min)">
              {{ statsData.loadAvg?.load1?.toFixed(2) }} / {{ statsData.loadAvg?.load5?.toFixed(2) }} / {{ statsData.loadAvg?.load15?.toFixed(2) }}
            </DescriptionsItem>
            <DescriptionsItem label="网络收/发">
              ↓ {{ formatBytes(statsData.network?.bytesRecv) }} / ↑ {{ formatBytes(statsData.network?.bytesSent) }}
            </DescriptionsItem>
          </Descriptions>

          <div>
            <div class="text-sm font-medium mb-1">CPU 使用率 ({{ statsData.cpu?.coreCount }} 核)</div>
            <Progress :percent="Math.round(statsData.cpu?.usagePercent || 0)" :stroke-color="statsData.cpu?.usagePercent > 80 ? '#ff4d4f' : '#1677ff'" />
          </div>

          <div>
            <div class="text-sm font-medium mb-1">
              内存使用率 — {{ formatBytes(statsData.memory?.used) }} / {{ formatBytes(statsData.memory?.total) }}
            </div>
            <Progress :percent="Math.round(statsData.memory?.usedPercent || 0)" :stroke-color="statsData.memory?.usedPercent > 80 ? '#ff4d4f' : '#52c41a'" />
          </div>

          <div v-if="statsData.disk?.length">
            <div class="text-sm font-medium mb-2">磁盘</div>
            <div v-for="d in statsData.disk" :key="d.path" class="mb-2">
              <div class="text-xs text-gray-500 mb-1">{{ d.path }} — {{ formatBytes(d.used) }} / {{ formatBytes(d.total) }}</div>
              <Progress :percent="Math.round(d.usedPercent || 0)" size="small" :stroke-color="d.usedPercent > 85 ? '#ff4d4f' : '#faad14'" />
            </div>
          </div>
        </div>
        <div v-else-if="!statsLoading" class="text-center text-gray-400 py-8">暂无状态数据</div>
      </Spin>
    </Modal>

    <!-- 文件管理弹窗 -->
    <Modal
      v-model:open="fileVisible"
      :title="`文件管理 - ${fileServerName}`"
      :width="900"
      :footer="null"
      :destroy-on-close="true"
    >
      <div class="flex flex-col" style="height: 520px">
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
        <div class="flex-1 overflow-hidden">
          <Spin :spinning="dirLoading" class="h-full">
            <Table
              :data-source="dirEntries"
              :columns="fileColumns"
              :pagination="false"
              size="small"
              row-key="path"
              :scroll="{ y: 420 }"
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

.create-server-instruction-warning {
  font-weight: 500;
  color: #d46b08;
}
</style>
