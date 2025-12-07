<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { K8sSecretApi } from '#/api/deploy-tools/k8s-secret';

import { onActivated, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteK8sSecret,
  getK8sSecretList,
  updateK8sSecret,
} from '#/api/deploy-tools/k8s-secret';
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
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const queryParams: any = {
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };

          // 业务线筛选逻辑：
          // 1. 超级管理员：如果前端筛选条件中有businessLineId，则使用；否则不传，后端会查所有业务线
          // 2. 非超级管理员：不传businessLineId，后端会自动使用token中的businessLineID
          // 注意：formValues中可能包含businessLineId（来自筛选表单），如果是超级管理员则保留，非超级管理员则忽略

          if (!isSuperAdmin) {
            // 非超级管理员：移除businessLineId，让后端使用token中的
            delete queryParams.businessLineId;
          }
          // 超级管理员：保留formValues中的businessLineId（如果有），如果没有则不传，后端会查所有

          return await getK8sSecretList(queryParams);
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
  } as VxeTableGridOptions<K8sSecretApi.K8sSecret>,
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

function onActionClick(e: OnActionClickParams<K8sSecretApi.K8sSecret>) {
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
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(newStatus: 0 | 1, row: K8sSecretApi.K8sSecret) {
  const status: Recordable<string> = {
    0: $t('common.disabled'),
    1: $t('common.enabled'),
  };
  try {
    await confirm(
      `${$t('ui.confirmContent.statusChange', [
        row.name,
        status[newStatus.toString()],
      ])}`,
      $t('ui.confirmTitle.statusChange'),
    );
    await updateK8sSecret(row.id, { status: newStatus });
    message.success($t('ui.successMessage.update'));
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: K8sSecretApi.K8sSecret) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: K8sSecretApi.K8sSecret) {
  confirm(
    $t('ui.confirmContent.delete', [row.name]),
    $t('ui.confirmTitle.delete'),
  )
    .then(async () => {
      await deleteK8sSecret(row.id);
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

function onCreate() {
  formDrawerApi.setData({}).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('deploy.tools.k8sSecret.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('deploy.tools.k8sSecret.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
