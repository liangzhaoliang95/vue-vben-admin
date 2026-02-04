<script lang="ts" setup>
import { ref } from 'vue';
import { Page } from '@vben/common-ui';

import { Modal, Tag } from 'ant-design-vue';

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

const [Grid] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'serverId',
        title: $t('serverManagement.server.serverId'),
        minWidth: 150,
      },
      {
        field: 'serverName',
        title: $t('serverManagement.server.serverName'),
        minWidth: 150,
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
        field: 'lastSeen',
        title: $t('serverManagement.server.lastSeen'),
        minWidth: 180,
        formatter: ({ cellValue }) => {
          return cellValue
            ? new Date(cellValue).toLocaleString('zh-CN')
            : '-';
        },
      },
      {
        field: 'actions',
        title: $t('common.action'),
        width: 120,
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
          console.log('🔍 Fetching server list...');
          const res = await ServerManagementApi.getServerList();
          console.log('✅ API Response:', res);
          console.log('📋 Servers:', res.servers);

          // 判断服务器是否在线（5分钟内有心跳）
          const now = Date.now();
          const servers = (res.servers || []).map((server) => ({
            ...server,
            status:
              now - new Date(server.lastSeen).getTime() < 5 * 60 * 1000
                ? 'online'
                : 'offline',
          }));

          console.log('🎯 Processed servers:', servers);

          // vxe-table 需要的格式
          const result = {
            page: {
              total: servers.length,
            },
            items: servers,
          };

          console.log('📊 Returning result:', result);

          return result;
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
      <template #status="{ row }">
        <Tag v-if="row.status === 'online'" color="success">
          {{ $t('serverManagement.server.online') }}
        </Tag>
        <Tag v-else color="default">
          {{ $t('serverManagement.server.offline') }}
        </Tag>
      </template>

      <template #actions="{ row }">
        <a-button
          type="link"
          size="small"
          :disabled="row.status !== 'online'"
          @click="openTerminal(row)"
        >
          {{ $t('serverManagement.server.openTerminal') }}
        </a-button>
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
  </Page>
</template>

<style>
.terminal-modal .ant-modal-body {
  padding: 0;
  height: 600px;
}
</style>
