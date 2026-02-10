<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { FormCollectorApi } from '#/api/formCollector';

import { onActivated } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteTaskApi,
  getTaskListApi,
  updateTaskApi,
} from '#/api/formCollector';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const router = useRouter();

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
    columns: useColumns(onActionClick, onViewDataClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const queryParams: any = {
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
          };

          const result = await getTaskListApi(queryParams);

          // 前端过滤
          let items = result.list || [];
          const originalTotal = result.total || 0;

          // 关键词搜索
          if (formValues.keyword) {
            const keyword = formValues.keyword.toLowerCase();
            items = items.filter(
              (task: FormCollectorApi.TaskInfo) =>
                task.taskName.toLowerCase().includes(keyword) ||
                task.taskDesc?.toLowerCase().includes(keyword) ||
                task.taskId.toLowerCase().includes(keyword),
            );
          }

          // 状态筛选
          if (formValues.status !== undefined && formValues.status !== null) {
            items = items.filter(
              (task: FormCollectorApi.TaskInfo) =>
                task.status === formValues.status,
            );
          }

          // 返回 VxeTable 期望的格式：{ items, total }
          return {
            items,
            total: formValues.keyword || formValues.status ? items.length : originalTotal,
          };
        },
      },
    },
    rowConfig: {
      keyField: 'taskId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<FormCollectorApi.TaskInfo>,
});

// 路由激活时刷新数据（用于 keep-alive 场景）
onActivated(() => {
  gridApi.query();
});

function onActionClick(e: OnActionClickParams<FormCollectorApi.TaskInfo>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'viewData': {
      onViewDataClick(e.row);
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

function onEdit(row: FormCollectorApi.TaskInfo) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: FormCollectorApi.TaskInfo) {
  confirm(`确定要删除任务"${row.taskName}"吗？`, '确认删除')
    .then(async () => {
      await deleteTaskApi(row.taskId);
      message.success('删除成功');
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

function onViewDataClick(row: FormCollectorApi.TaskInfo) {
  router.push({
    path: '/formCollector/data-list',
    query: {
      pageKey: '/formCollector/task-list', // 使用任务列表页的 path 作为 Tab key
      taskId: row.taskId,
      taskName: row.taskName,
    },
  });
}

async function onStatusChange(
  row: FormCollectorApi.TaskInfo,
  status: number,
) {
  try {
    await updateTaskApi({
      taskId: row.taskId,
      taskName: row.taskName,
      taskDesc: row.taskDesc,
      status,
    });
    message.success(status === 1 ? '任务已启用' : '任务已禁用');
    // 更新本地数据
    row.status = status;
  } catch (error) {
    message.error('状态更新失败');
    // 刷新数据以恢复原状态
    gridApi.query();
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid table-title="任务配置">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          新增任务配置
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
