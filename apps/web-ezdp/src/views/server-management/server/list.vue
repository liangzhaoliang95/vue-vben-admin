<script lang="ts" setup>
import { ref } from 'vue';
import { Page } from '@vben/common-ui';

import { Button, Modal, Space, Tag, Tooltip, message, Form, FormItem, Input } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ServerManagementApi } from '#/api/server-management';
import { $t } from '#/locales';
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
</script>

<template>
  <Page auto-content-height>
    <Grid>
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
  </Page>
</template>

<style>
.terminal-modal .ant-modal-body {
  padding: 0;
  height: 600px;
}
</style>
