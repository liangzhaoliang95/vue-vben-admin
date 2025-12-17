<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api/system/user';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteUser, getUserList, updateUser } from '#/api/system/user';
import { $t } from '#/locales';
import Form from '#/views/usermanage/modules/form.vue';
import { useColumns, useGridFormSchema } from '#/views/usermanage/user/data';
import PermissionContent from '#/views/usermanage/user/modules/permission.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [PermissionDrawer, permissionDrawerApi] = useVbenDrawer({
  connectedComponent: PermissionContent,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    keepSource: true,
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getUserList({
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
  } as VxeTableGridOptions<SystemUserApi.User>,
});

function onActionClick(e: OnActionClickParams<SystemUserApi.User>) {
  switch (e.code) {
    case 'delete': {
      Modal.confirm({
        title: $t('ui.confirmTitle.delete'),
        content: $t('ui.confirmContent.delete', [
          e.row.userName || e.row.loginName,
        ]),
        onOk: async () => {
          try {
            await deleteUser(e.row.id);
            message.success($t('ui.successMessage.delete'));
            gridApi.query();
          } catch (error) {
            console.error('删除用户失败:', error);
          }
        },
      });
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'permission': {
      onPermissionSetting(e.row);
      break;
    }
  }
}

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
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

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(newStatus: 0 | 1, row: SystemUserApi.User) {
  const status: Recordable<string> = {
    0: '禁用',
    1: '启用',
  };
  try {
    await confirm(
      `你要将${row.userName || row.loginName}的状态切换为 【${status[newStatus.toString()]}】 吗？`,
      '切换状态',
    );
    await updateUser(row.id, { status: newStatus });
    message.success($t('ui.successMessage.update'));
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: SystemUserApi.User) {
  formDrawerApi.setData(row).open();
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}

function onPermissionSetting(row: SystemUserApi.User) {
  permissionDrawerApi.setData({
    userId: row.id,
    userName: row.userName || row.loginName,
  });
  permissionDrawerApi.open();
}

function onPermissionSuccess() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <PermissionDrawer @success="onPermissionSuccess" />
    <Grid :table-title="$t('system.user.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.user.name')]) }}
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
