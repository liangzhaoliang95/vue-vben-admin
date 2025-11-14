<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { ObjectStorageApi } from '#/api/deploy-tools/object-storage';

import { nextTick } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteObjectStorage,
  getObjectStorageList,
  updateObjectStorage,
} from '#/api/deploy-tools/object-storage';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getObjectStorageList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
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
  } as VxeTableGridOptions<ObjectStorageApi.ObjectStorage>,
});

function onActionClick(e: OnActionClickParams<ObjectStorageApi.ObjectStorage>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
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
  return new Promise((reslove, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        reslove(true);
      },
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param id 对象存储 ID
 * @param newStatus 期望改变的状态值
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(id: number, newStatus: 0 | 1) {
  try {
    await updateObjectStorage(id, { status: newStatus });
    message.success($t('ui.successMessage.update'));
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: ObjectStorageApi.ObjectStorage) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: ObjectStorageApi.ObjectStorage) {
  confirm(
    $t('ui.confirmContent.delete', [row.name]),
    $t('ui.confirmTitle.delete'),
  )
    .then(async () => {
      await deleteObjectStorage(row.id);
      message.success($t('ui.successMessage.delete'));
      gridApi.query();
    })
    .catch(() => {
      // 用户取消，不做任何操作
    });
}

function onRefresh() {
  gridApi.query();
}

async function onCreate() {
  // 使用 nextTick 确保 drawer 打开不会影响搜索表单
  formDrawerApi.setData({});
  // 等待下一个 tick，避免触发搜索表单的变化
  await nextTick();
  formDrawerApi.open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('deploy.tools.objectStorage.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [$t('deploy.tools.objectStorage.name')])
          }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
