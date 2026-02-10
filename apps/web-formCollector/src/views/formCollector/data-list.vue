<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FormCollectorApi } from '#/api/formCollector';

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { ArrowLeft } from '@vben/icons';
import { usePreferences } from '@vben/preferences';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  message,
  Modal,
  Space,
  Table,
  Tabs,
  TabPane,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAllFormDataApi,
  deleteFormDataApi,
  getFormDataListApi,
} from '#/api/formCollector';

import { useDataListColumns } from './data-list-columns';

const route = useRoute();
const router = useRouter();
const { isDark } = usePreferences();

// 从路由参数获取任务信息
const taskId = computed(() => route.query.taskId as string);
const taskName = computed(() => route.query.taskName as string);

// 详情对话框
const detailVisible = ref(false);
const currentDetail = ref<FormCollectorApi.FormDataInfo | null>(null);

// 表单数据表格列定义
const formDataColumns = [
  { title: '字段名', dataIndex: 'key', width: '40%' },
  { title: '值', dataIndex: 'value' },
];

// 将 formData 转为表格行数据
const formDataRows = computed(() => {
  if (!currentDetail.value?.formData) return [];
  return Object.entries(currentDetail.value.formData).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
  }));
});

// 页面标题
const pageTitle = computed(() => {
  return taskName.value ? `${taskName.value} - 数据列表` : '数据列表';
});

// 配置 VxeTable Grid
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useDataListColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          if (!taskId.value) {
            message.error('缺少任务ID');
            return { items: [], total: 0 };
          }

          const result = await getFormDataListApi({
            taskId: taskId.value,
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
          });

          return {
            items: result.list || [],
            total: result.total || 0,
          };
        },
      },
    },
    rowConfig: {
      keyField: 'dataId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<FormCollectorApi.FormDataInfo>,
});

// 查看详情
const viewDetail = (record: FormCollectorApi.FormDataInfo) => {
  currentDetail.value = record;
  detailVisible.value = true;
};

// 删除数据
const handleDelete = (dataId: string) => {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这条数据吗？删除后无法恢复。',
    onOk: async () => {
      try {
        await deleteFormDataApi(taskId.value, dataId);
        message.success('删除成功');
        gridApi.query();
      } catch (error) {
        message.error('删除失败');
      }
    },
  });
};

// 删除所有数据
const handleDeleteAll = () => {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除所有数据吗？此操作不可恢复！',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteAllFormDataApi(taskId.value);
        message.success('删除成功');
        gridApi.query();
      } catch (error) {
        message.error('删除失败');
      }
    },
  });
};

// 返回任务列表
const handleBack = () => {
  router.push('/formCollector/task-list');
};
</script>

<template>
  <Page auto-content-height>
    <!-- 返回按钮 -->
    <div class="mb-4">
      <Button type="link" @click="handleBack">
        <template #icon>
          <ArrowLeft class="size-4" />
        </template>
        返回列表
      </Button>
    </div>

    <!-- Grid 表格 -->
    <Grid :table-title="pageTitle">
      <template #toolbar-tools>
        <Button danger type="primary" @click="handleDeleteAll">
          删除所有数据
        </Button>
      </template>

      <!-- 操作列插槽 -->
      <template #operation="{ row }">
        <Space>
          <Button size="small" @click="viewDetail(row)">
            查看详情
          </Button>
          <Button danger size="small" @click="handleDelete(row.dataId)">
            删除
          </Button>
        </Space>
      </template>
    </Grid>

    <!-- 详情对话框 -->
    <Modal
      v-model:open="detailVisible"
      title="表单数据详情"
      width="800px"
      :footer="null"
    >
      <div v-if="currentDetail">
        <Descriptions bordered :column="1" size="small" class="mb-4">
          <DescriptionsItem label="数据ID">
            {{ currentDetail.dataId }}
          </DescriptionsItem>
          <DescriptionsItem label="提交IP">
            {{ currentDetail.submitIp }}
          </DescriptionsItem>
          <DescriptionsItem label="提交地区">
            {{ currentDetail.submitRegion || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="提交时间">
            {{ new Date(currentDetail.submitAt).toLocaleString('zh-CN') }}
          </DescriptionsItem>
        </Descriptions>

        <Tabs default-active-key="table">
          <TabPane key="table" tab="表格视图">
            <Table
              :columns="formDataColumns"
              :data-source="formDataRows"
              :pagination="false"
              size="small"
              bordered
            />
          </TabPane>
          <TabPane key="json" tab="JSON视图">
            <pre :class="['detail-json-pre', isDark && 'detail-json-pre--dark']">{{ JSON.stringify(currentDetail.formData, null, 2) }}</pre>
          </TabPane>
        </Tabs>
      </div>
    </Modal>
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

.detail-json-pre {
  padding: 16px;
  margin: 0;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  max-height: 500px;
  border-radius: 6px;
  background-color: #f5f5f5;
}

.detail-json-pre--dark {
  color: #d4d4d4;
  background-color: #1e1e1e;
}
</style>
