<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ServerManagementApi } from '#/api/server-management';
import { $t } from '#/locales';

defineOptions({
  name: 'ServerList',
});

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
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          const res = await ServerManagementApi.getServerList();
          // 判断服务器是否在线（5分钟内有心跳）
          const now = Date.now();
          const servers = res.servers.map((server) => ({
            ...server,
            status:
              now - new Date(server.lastSeen).getTime() < 5 * 60 * 1000
                ? 'online'
                : 'offline',
          }));
          return {
            result: servers,
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
      <template #status="{ row }">
        <Tag v-if="row.status === 'online'" color="success">
          {{ $t('serverManagement.server.online') }}
        </Tag>
        <Tag v-else color="default">
          {{ $t('serverManagement.server.offline') }}
        </Tag>
      </template>
    </Grid>
  </Page>
</template>
