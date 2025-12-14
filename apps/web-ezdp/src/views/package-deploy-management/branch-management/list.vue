<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { BranchManagementApi } from '#/api/package-deploy-management/branch-management';

import { onActivated, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteBranchManagement,
  getBranchManagementList,
} from '#/api/package-deploy-management/branch-management';
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
          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const queryParams: any = {
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };

          // 业务线筛选逻辑：
          // 1. 超级管理员：如果前端筛选条件中有businessLineId，则使用；否则不传，后端会查所有业务线
          // 2. 非超级管理员：不传businessLineId，让后端使用token中的
          if (!isSuperAdmin) {
            delete queryParams.businessLineId;
          }

          return await getBranchManagementList(queryParams);
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
  } as VxeTableGridOptions<BranchManagementApi.BranchManagement>,
});

// 路由激活时刷新数据
onActivated(() => {
  gridApi.query();
});

// 监听业务线ID变化,自动刷新数据
watch(
  () => businessStore.currentBusinessLineId,
  () => {
    gridApi.query();
  },
);

function onActionClick(
  e: OnActionClickParams<BranchManagementApi.BranchManagement>,
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
  }
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

function onEdit(row: BranchManagementApi.BranchManagement) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: BranchManagementApi.BranchManagement) {
  confirm(
    $t('ui.confirmContent.delete', [row.name]),
    $t('ui.confirmTitle.delete'),
  )
    .then(async () => {
      await deleteBranchManagement(row.id);
      message.success($t('ui.successMessage.delete'));
      gridApi.query();
    })
    .catch(() => {
      // 用户取消,不做任何操作
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
    <Grid
      :table-title="$t('deploy.packageDeployManagement.branchManagement.title')"
    >
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [
              $t('deploy.packageDeployManagement.branchManagement.title'),
            ])
          }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
