<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { DeployAgent } from '#/api/deploy-tools/deploy-agent';

import { onActivated, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDeployAgent,
  getDeployAgentList,
} from '#/api/deploy-tools/deploy-agent';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import TokenDialog from './modules/token-dialog.vue';

// 打开文档中心
function openDocs() {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
  window.open(`${baseUrl}#/docs`, '_blank');
}

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

          return await getDeployAgentList(queryParams);
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
  } as VxeTableGridOptions<DeployAgent>,
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

function onActionClick(e: OnActionClickParams<DeployAgent>) {
  switch (e.code) {
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

function onEdit(row: DeployAgent) {
  formRef.value?.drawerApi.setData(row).open();
}

function onDelete(row: DeployAgent) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('deploy.tools.deployAgent.deleteConfirm', { name: row.name }),
    okText: $t('common.confirm'),
    okType: 'danger',
    title: $t('common.delete'),
    onOk: async () => {
      try {
        // 检查 Agent 是否在线
        if (row.status === 1) {
          message.error($t('deploy.tools.deployAgent.cannotDeleteOnline'));
          return;
        }

        await deleteDeployAgent(row.id);
        message.success($t('common.deleteSuccess'));
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
    <Grid :table-title="$t('deploy.tools.deployAgent.title')">
      <template #toolbar-tools>
        <Button type="link" @click="openDocs" style="margin-right: 12px;">
          📚 {{ $t('page.docs.title') }}
        </Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('common.create') }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
