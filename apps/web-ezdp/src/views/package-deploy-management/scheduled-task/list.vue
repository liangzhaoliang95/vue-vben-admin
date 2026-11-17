<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { ScheduledTaskItem } from '#/api/package-deploy-management/scheduled-task';

import { h, onActivated, onMounted, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteScheduledTaskApi,
  executeScheduledTaskNowApi,
  getScheduledTaskListApi,
  toggleScheduledTaskApi,
} from '#/api/package-deploy-management/scheduled-task';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const businessStore = useBusinessStore();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onToggleEnabled),
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

          if (!isSuperAdmin) {
            delete queryParams.businessLineId;
          }

          return await getScheduledTaskListApi(queryParams);
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
  } as VxeTableGridOptions<ScheduledTaskItem>,
});

function refreshGridColumns() {
  gridApi.setGridOptions({
    columns: useColumns(onActionClick, onToggleEnabled),
  });
}

onMounted(() => {
  refreshGridColumns();
});

onActivated(() => {
  refreshGridColumns();
  gridApi.query();
});

watch(
  () => businessStore.currentBusinessLineId,
  () => {
    refreshGridColumns();
    gridApi.query();
  },
);

function onActionClick(e: OnActionClickParams<ScheduledTaskItem>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'execute': {
      onExecute(e.row);
      break;
    }
  }
}

function onEdit(row: ScheduledTaskItem) {
  formDrawerApi.setData(row).open();
}

function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

async function onDelete(row: ScheduledTaskItem) {
  try {
    await confirm(
      $t('scheduledTask.message.deleteConfirm'),
      $t('scheduledTask.action.delete'),
    );
    await deleteScheduledTaskApi(row.id);
    message.success($t('scheduledTask.message.deleteSuccess'));
    gridApi.query();
  } catch (error: any) {
    if (error.message !== '已取消') {
      console.error('Delete error:', error);
      message.error(error.message || $t('scheduledTask.message.deleteFailed'));
    }
  }
}

async function onToggleEnabled(row: ScheduledTaskItem, enabled: boolean) {
  try {
    await toggleScheduledTaskApi(row.id, enabled);
    message.success(
      enabled
        ? $t('scheduledTask.message.enableSuccess')
        : $t('scheduledTask.message.disableSuccess'),
    );
    gridApi.query();
  } catch (error: any) {
    console.error('Toggle error:', error);
    message.error(
      error.message ||
        (enabled
          ? $t('scheduledTask.message.enableFailed')
          : $t('scheduledTask.message.disableFailed')),
    );
  }
}

async function onExecute(row: ScheduledTaskItem) {
  try {
    await confirm(
      $t('scheduledTask.message.executeConfirm'),
      $t('scheduledTask.action.executeNow'),
    );
    await executeScheduledTaskNowApi(row.id);
    message.success($t('scheduledTask.message.executeSuccess'));
    gridApi.query();
  } catch (error: any) {
    if (error.message !== '已取消') {
      console.error('Execute error:', error);
      message.error(error.message || $t('scheduledTask.message.executeFailed'));
    }
  }
}

function onCreate() {
  formDrawerApi.setData({}).open();
}

function onRefresh() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('scheduledTask.list.title')">
      <template #toolbar-tools>
        <Button :icon="h(Plus)" type="primary" @click="onCreate">
          {{ $t('scheduledTask.action.create') }}
        </Button>
      </template>
    </Grid>

    <FormDrawer @success="onRefresh" />
  </Page>
</template>
