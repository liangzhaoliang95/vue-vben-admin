<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';
import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { IconifyIcon } from '@vben/icons';

import { Button, Modal, Space, Tag, Tooltip, message, Form, FormItem, Input, Card, Collapse, CollapsePanel, Alert } from 'ant-design-vue';

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
const createRules = {
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
        formatter: ({ cellValue }) => {
          return formatTimestamp(cellValue);
        },
      },
      {
        field: 'actions',
        title: $t('common.action'),
        width: 280,
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
        <Space>
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
