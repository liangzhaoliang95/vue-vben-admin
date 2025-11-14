<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { ProjectConfigApi } from '#/api/project-management/project-config';

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

          // 非超级管理员时，自动过滤当前业务线
          if (!isSuperAdmin) {
            const currentBusinessLine = businessStore.currentBusinessLine;
            if (currentBusinessLine?.businessLine.name) {
              queryParams.group = currentBusinessLine.businessLine.name;
            }
          }

          return await getProjectConfigList(queryParams);
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
  if (row.hasBuildConfig) {
    // 已配置，打开编辑页面
    // TODO: 打开打包配置编辑页面
    message.info('打开打包配置编辑页面');
  } else {
    // 未配置，打开新建页面
    // TODO: 打开打包配置新建页面
    message.info('打开打包配置新建页面');
  }
}

async function onDeployConfigClick(row: ProjectConfigApi.ProjectConfig) {
  if (row.hasDeployConfig) {
    // 已配置，打开编辑页面
    // TODO: 打开发布配置编辑页面
    message.info('打开发布配置编辑页面');
  } else {
    // 未配置，打开新建页面
    // TODO: 打开发布配置新建页面
    message.info('打开发布配置新建页面');
  }
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
