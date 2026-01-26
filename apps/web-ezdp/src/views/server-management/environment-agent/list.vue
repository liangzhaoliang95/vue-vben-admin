<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { onActivated, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ServerManagementApi } from '#/api/server-management';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import TokenDialog from './modules/token-dialog.vue';

defineOptions({
  name: 'EnvironmentAgentList',
});

const formRef = ref<InstanceType<typeof Form>>();
const tokenDialogRef = ref<InstanceType<typeof TokenDialog>>();

const businessStore = useBusinessStore();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const queryParams: any = {
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };

          // 业务线筛选逻辑：
          // 1. 超级管理员：如果前端筛选条件中有businessLineId，则使用；否则不传，后端会查所有业务线
          // 2. 非超级管理员：不传businessLineId，后端会自动使用token中的businessLineID

          if (!isSuperAdmin) {
            // 非超级管理员：移除businessLineId，让后端使用token中的
            delete queryParams.businessLineId;
          }
          // 超级管理员：保留formValues中的businessLineId（如果有），如果没有则不传，后端会查所有

          const res = await ServerManagementApi.getEnvironmentAgentList(
            queryParams,
          );
          return {
            page: {
              total: res.total,
            },
            items: res.list,
          };
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
  } as VxeTableGridOptions<any>,
});

// 路由激活时刷新数据（用于 keep-alive 场景）
onActivated(() => {
  gridApi.query();
});

// 监听业务线ID变化，自动刷新数据
watch(
  () => businessStore.currentBusinessLineId,
  () => {
    gridApi.query();
  },
);

function onActionClick(e: OnActionClickParams<any>) {
  switch (e.code) {
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'regenerate': {
      onRegenerateToken(e.row);
      break;
    }
    case 'delete': {
      onDelete(e.row);
      break;
    }
  }
}

function onEdit(row: any) {
  formRef.value?.drawerApi.setData(row).open();
}

function onRegenerateToken(row: any) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('serverManagement.environmentAgent.regenerateTokenConfirm'),
    okText: $t('common.confirm'),
    okType: 'danger',
    title: $t('serverManagement.environmentAgent.regenerateToken'),
    onOk: async () => {
      try {
        const res = await ServerManagementApi.regenerateToken({ id: row.id });
        message.success(
          $t('serverManagement.environmentAgent.regenerateSuccess'),
        );
        gridApi.query();
        // 显示新的 token
        if (res.token) {
          tokenDialogRef.value?.drawerApi.setData({ token: res.token }).open();
        }
      } catch (error: any) {
        message.error(error.message || $t('common.operationFailed'));
      }
    },
  });
}

function onDelete(row: any) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('serverManagement.environmentAgent.deleteConfirm'),
    okText: $t('common.confirm'),
    okType: 'danger',
    title: $t('common.delete'),
    onOk: async () => {
      try {
        await ServerManagementApi.deleteEnvironmentAgent({ id: row.id });
        message.success($t('serverManagement.environmentAgent.deleteSuccess'));
        gridApi.query();
      } catch (error: any) {
        message.error(error.message || $t('common.deleteFailed'));
      }
    },
  });
}

function onCreate() {
  formRef.value?.drawerApi.setData({}).open();
}

function onRefresh(token?: string) {
  gridApi.query();
  // 如果有 token，显示 token 对话框
  if (token) {
    tokenDialogRef.value?.drawerApi.setData({ token }).open();
  }
}
</script>

<template>
  <Page auto-content-height>
    <Form ref="formRef" @success="onRefresh" />
    <TokenDialog ref="tokenDialogRef" />
    <Grid :table-title="$t('serverManagement.environmentAgent.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('common.create') }}
        </Button>
      </template>
      <template #token="{ row }">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs">{{ row.token }}</span>
        </div>
      </template>
    </Grid>
  </Page>
</template>
