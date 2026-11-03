<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { EventSubscriptionApi } from '#/api/core/notification-event-subscription';

import { onActivated, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteEventSubscription,
  getEventSubscriptionList,
  testEventSubscriptionWebhook,
} from '#/api/core/notification-event-subscription';
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
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const queryParams: any = {
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };

          const res = await getEventSubscriptionList(queryParams);
          return { items: res.list ?? [], total: res.total ?? 0 };
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
  } as VxeTableGridOptions<EventSubscriptionApi.EventSubscriptionItem>,
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

function onActionClick(
  e: OnActionClickParams<EventSubscriptionApi.EventSubscriptionItem>,
) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'test': {
      onTest(e.row);
      break;
    }
  }
}

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
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

function onEdit(row: EventSubscriptionApi.EventSubscriptionItem) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: EventSubscriptionApi.EventSubscriptionItem) {
  confirm(
    $t('notification.eventSubscription.deleteConfirmContent'),
    $t('notification.eventSubscription.deleteConfirmTitle'),
  )
    .then(async () => {
      await deleteEventSubscription({ id: row.id });
      message.success($t('notification.eventSubscription.deleteSuccess'));
      gridApi.query();
    })
    .catch(() => {
      // 用户取消，不做任何操作
    });
}

async function onTest(row: EventSubscriptionApi.EventSubscriptionItem) {
  try {
    await testEventSubscriptionWebhook({ webhookUrl: row.webhookUrl });
    message.success($t('notification.eventSubscription.testSuccess'));
  } catch (error: any) {
    message.error(
      error.message || $t('notification.eventSubscription.testFailed'),
    );
  }
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('notification.eventSubscription.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('notification.eventSubscription.createSubscription') }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
