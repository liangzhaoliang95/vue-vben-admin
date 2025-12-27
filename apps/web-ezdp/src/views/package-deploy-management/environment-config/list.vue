<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { DeployEnvironmentApi } from '#/api/project-management/deploy-environment';

import { onActivated, ref, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDeployEnvironment,
  getDeployEnvironmentList,
} from '#/api/project-management/deploy-environment';
import { $t } from '#/locales';

import { loadReferenceData, useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import VersionModal from './modules/version-modal.vue';

const businessStore = useBusinessStore();

// 版本模态框状态
const versionModalOpen = ref(false);
const selectedEnvironment = ref<{
  id: string;
  name: string;
}>({
  id: '',
  name: '',
});

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

          return await getDeployEnvironmentList(queryParams);
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
  } as VxeTableGridOptions<DeployEnvironmentApi.DeployEnvironment>,
  gridEvents: {
    cellClick: ({ row, column }: any) => {
      // 点击环境名称列时打开版本模态框
      if (column.field === 'name') {
        showVersionModal(row.id, row.name);
      }
    },
  },
});

// 路由激活时刷新数据（用于 keep-alive 场景）
onActivated(() => {
  // 重新加载参考数据（对象存储和K8S集群列表）
  loadReferenceData();
  gridApi.query();
});

// 监听业务线ID变化，自动刷新数据
watch(
  () => businessStore.currentBusinessLineId,
  () => {
    // 业务线变化时，重新加载参考数据（因为不同业务线的K8S集群和对象存储可能不同）
    loadReferenceData();
    gridApi.query();
  },
);

function onActionClick(
  e: OnActionClickParams<DeployEnvironmentApi.DeployEnvironment>,
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

function onEdit(row: DeployEnvironmentApi.DeployEnvironment) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: DeployEnvironmentApi.DeployEnvironment) {
  confirm(
    $t('ui.confirmContent.delete', [row.name]),
    $t('ui.confirmTitle.delete'),
  )
    .then(async () => {
      await deleteDeployEnvironment(row.id);
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

// 显示版本模态框
function showVersionModal(id: string, name: string) {
  selectedEnvironment.value = { id, name };
  versionModalOpen.value = true;
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <VersionModal
      v-model:open="versionModalOpen"
      :environment-id="selectedEnvironment.id"
      :environment-name="selectedEnvironment.name"
    />
    <Grid
      :table-title="
        $t('deploy.packageDeployManagement.environmentConfig.title')
      "
    >
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [
              $t('deploy.packageDeployManagement.environmentConfig.title'),
            ])
          }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
/* 表格行悬浮效果 */
:deep(.vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.08) !important;
  transition: background-color 0.2s ease;
}

/* 深色模式下的悬浮效果 */
:deep(.dark .vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.15) !important;
}

/* 环境名称列样式 - 链接效果 */
:deep(.env-name-cell) .vxe-cell--label {
  color: #1890ff;
  cursor: pointer;
  text-decoration: none;
}

:deep(.env-name-cell) .vxe-cell--label:hover {
  text-decoration: underline;
}

/* 深色模式下的链接颜色 */
:deep(.dark .env-name-cell) .vxe-cell--label {
  color: #40a9ff;
}
</style>
