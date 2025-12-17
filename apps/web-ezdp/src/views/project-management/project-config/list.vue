<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { ProjectConfigApi } from '#/api/project-management/project-config';

import { onActivated, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteProjectConfig,
  getProjectConfigList,
} from '#/api/project-management/project-config';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const router = useRouter();

const businessStore = useBusinessStore();

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
    columns: useColumns(onActionClick, onBuildConfigClick, onDeployConfigClick),
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

          const result = await getProjectConfigList(queryParams);

          // 排序已在后端实现：backend > frontend > submodule，同类型内按项目ID正序
          return result;
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
  } as VxeTableGridOptions<ProjectConfigApi.ProjectConfig>,
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

function onActionClick(e: OnActionClickParams<ProjectConfigApi.ProjectConfig>) {
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

function onEdit(row: ProjectConfigApi.ProjectConfig) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: ProjectConfigApi.ProjectConfig) {
  confirm(
    $t('ui.confirmContent.delete', [row.name]),
    $t('ui.confirmTitle.delete'),
  )
    .then(async () => {
      await deleteProjectConfig(row.id);
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

async function onBuildConfigClick(row: ProjectConfigApi.ProjectConfig) {
  // 跳转到配置详情页面，默认显示打包配置 tab
  // pageKey 用于让详情页和列表页共享同一个 Tab
  router.push({
    path: '/project-management/project-config/detail',
    query: {
      pageKey: '/project-management/project-config', // 使用列表页的 path 作为 Tab key
      id: row.id,
      businessLineId: row.businessLineId,
      name: row.name,
      projectId: row.projectId,
      projectUrl: row.projectUrl,
      type: row.type,
      tab: 'build',
    },
  });
}

async function onDeployConfigClick(row: ProjectConfigApi.ProjectConfig) {
  // 跳转到配置详情页面，默认显示发布配置 tab
  // pageKey 用于让详情页和列表页共享同一个 Tab
  router.push({
    path: '/project-management/project-config/detail',
    query: {
      pageKey: '/project-management/project-config', // 使用列表页的 path 作为 Tab key
      id: row.id,
      businessLineId: row.businessLineId,
      name: row.name,
      projectId: row.projectId,
      projectUrl: row.projectUrl,
      type: row.type,
      tab: 'deploy',
    },
  });
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('deploy.projectManagement.projectConfig.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [
              $t('deploy.projectManagement.projectConfig.title'),
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
</style>
