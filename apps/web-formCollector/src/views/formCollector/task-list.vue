<script lang="ts" setup>
import type {
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { FormCollectorApi } from '#/api/formCollector';

import { computed, onActivated, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal, Tabs, TabPane, Typography, Input, Dropdown, Menu, MenuItem } from 'ant-design-vue';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteTaskApi,
  exportTaskDataApi,
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

// 定义函数(在 useVbenVxeGrid 之前)
function onViewDataClick(row: FormCollectorApi.TaskInfo) {
  router.push({
    path: '/data-list',
    query: {
      pageKey: '/task-list',
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
    row.status = status;
  } catch (error) {
    message.error('状态更新失败');
    gridApi.query();
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onStatusChange, onViewDataClick),
    height: 'auto',
    keepSource: true,
    rowConfig: {
      keyField: 'taskId',
      height: 60,
    },
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
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<FormCollectorApi.TaskInfo>,
});

// AI提示词模态框
const aiPromptVisible = ref(false);
const currentTask = ref<FormCollectorApi.TaskInfo | null>(null);

// AI提示词内容
const submitPrompt = ref('');
const queryPrompt = ref('');

// 获取基础URL
const baseUrl = computed(() => {
  return window.location.origin;
});

// 生成提交数据的AI提示词
const generateSubmitPrompt = (task: FormCollectorApi.TaskInfo) => {
  return `创建完应用后，向 '${baseUrl.value}/server/formCollector/nc/formSubmit/submit/${task.taskId}' 发送post格式的json数据

**请求示例：**
\`\`\`
POST ${baseUrl.value}/server/formCollector/nc/formSubmit/submit/${task.taskId}
Content-Type: application/json

{
  "name": "张三",
  "age": 25,
  "email": "zhangsan@example.com"
}
\`\`\`

**响应示例：**
\`\`\`json
{
  "code": 0,
  "data": {
    "dataId": "698aa73feec82c04339ab211"
  }
}
\`\`\``;
};

// 生成查询数据的AI提示词
const generateQueryPrompt = (task: FormCollectorApi.TaskInfo) => {
  return `直接访问该网址就能查询到已收集的数据，可以用它继续制作实时的数据列表页面。

**请求示例：**
\`\`\`
GET ${baseUrl.value}/server/formCollector/nc/formSubmit/submit/${task.taskId}/all
\`\`\`

**响应示例：**
\`\`\`json
{
  "code": 0,
  "data": {
    "total": 1,
    "list": [
      {
        "dataId": "698aa73feec82c04339ab211",
        "taskId": "${task.taskId}",
        "formData": {
          "name": "张三",
          "age": 25,
          "email": "zhangsan@example.com"
        },
        "submitIp": "120.230.xx.xx",
        "submitRegion": "广东省/广州市",
        "submitAt": 1707544463000
      }
    ]
  }
}
\`\`\``;
};

// 复制AI提示词
const copyPrompt = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    message.success('复制成功');
  }).catch(() => {
    message.error('复制失败');
  });
};

// 路由激活时刷新数据（用于 keep-alive 场景）
onActivated(() => {
  gridApi.query();
});

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

async function onExport(row: FormCollectorApi.TaskInfo) {
  try {
    message.loading({ content: '正在导出数据...', key: 'export', duration: 0 });

    console.log('开始导出任务:', row.taskId);
    const blob = await exportTaskDataApi(row.taskId);
    console.log('导出成功，Blob 大小:', blob.size, 'bytes');

    // 检查 Blob 是否有效
    if (!blob || blob.size === 0) {
      throw new Error('导出的文件为空');
    }

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${row.taskName}_${new Date().getTime()}.xlsx`;
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    message.success({ content: '导出成功', key: 'export' });
  } catch (error: any) {
    console.error('导出失败:', error);
    message.error({ content: `导出失败: ${error.message || '请稍后重试'}`, key: 'export' });
  }
}

function onShowAiPrompt(row: FormCollectorApi.TaskInfo) {
  currentTask.value = row;
  submitPrompt.value = generateSubmitPrompt(row);
  queryPrompt.value = generateQueryPrompt(row);
  aiPromptVisible.value = true;
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

      <!-- 自定义操作列 -->
      <template #operation="{ row }">
        <div class="operation-buttons">
          <Button size="small" @click="onViewDataClick(row)">查看数据</Button>
          <Button size="small" type="primary" @click="onShowAiPrompt(row)">AI提示词</Button>
          <Dropdown placement="bottomRight">
            <Button size="small">
              更多
              <template #icon>
                <span style="margin-left: 4px;">▼</span>
              </template>
            </Button>
            <template #overlay>
              <Menu>
                <MenuItem key="export" @click="onExport(row)">
                  <span>数据导出</span>
                </MenuItem>
                <MenuItem key="edit" @click="onEdit(row)">
                  <span>编辑</span>
                </MenuItem>
                <MenuItem key="delete" @click="onDelete(row)">
                  <span style="color: #ff4d4f;">删除</span>
                </MenuItem>
              </Menu>
            </template>
          </Dropdown>
        </div>
      </template>
    </Grid>

    <!-- AI提示词模态框 -->
    <Modal
      v-model:open="aiPromptVisible"
      title="AI提示词"
      width="900px"
      :footer="null"
      :body-style="{ padding: 0 }"
    >
      <div v-if="currentTask" class="ai-prompt-modal">
        <Tabs default-active-key="submit" class="ai-prompt-tabs">
          <!-- 提交数据接口 -->
          <TabPane key="submit" tab="提交数据接口">
            <div class="tab-content-scroll">
              <div class="api-doc-content">
                <h3 class="api-title">接口地址</h3>
                <div class="api-url-box">
                  <span class="api-method">POST</span>
                  <span class="api-url">{{ baseUrl }}/server/formCollector/nc/formSubmit/submit/{{ currentTask.taskId }}</span>
                </div>

                <h3 class="api-title mt-4">接口说明</h3>
                <p class="api-desc">将表单数据提交到平台。请求体为任意结构的 JSON 对象，平台会原样存储。</p>

                <h3 class="api-title mt-4">AI提示词</h3>
                <div class="ai-prompt-editor">
                  <div class="ai-prompt-header">
                    <Button type="primary" size="small" @click="copyPrompt(submitPrompt)">
                      复制
                    </Button>
                  </div>
                  <TextArea
                    v-model:value="submitPrompt"
                    :auto-size="{ minRows: 15, maxRows: 25 }"
                    class="ai-prompt-textarea"
                  />
                </div>
              </div>
            </div>
          </TabPane>

          <!-- 查询数据接口 -->
          <TabPane key="query" tab="查询数据接口">
            <div class="tab-content-scroll">
              <div class="api-doc-content">
                <h3 class="api-title">接口地址</h3>
                <div class="api-url-box">
                  <span class="api-method">GET</span>
                  <span class="api-url">{{ baseUrl }}/server/formCollector/nc/formSubmit/submit/{{ currentTask.taskId }}/all</span>
                </div>

                <h3 class="api-title mt-4">接口说明</h3>
                <p class="api-desc">获取指定任务下的所有提交数据，返回完整列表。</p>

                <h3 class="api-title mt-4">AI提示词</h3>
                <div class="ai-prompt-editor">
                  <div class="ai-prompt-header">
                    <Button type="primary" size="small" @click="copyPrompt(queryPrompt)">
                      复制
                    </Button>
                  </div>
                  <TextArea
                    v-model:value="queryPrompt"
                    :auto-size="{ minRows: 20, maxRows: 30 }"
                    class="ai-prompt-textarea"
                  />
                </div>
              </div>
            </div>
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

/* 操作按钮布局 */
.operation-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.operation-buttons button {
  min-width: 70px;
}

/* 确保操作列单元格有足够高度 */
:deep(.vxe-table--body .vxe-body--column[data-colid="operation"]) {
  padding: 8px 4px !important;
}

:deep(.vxe-table--body .vxe-body--column[data-colid="operation"] .vxe-cell) {
  overflow: visible !important;
  line-height: normal !important;
}

/* AI提示词模态框布局 */
.ai-prompt-modal {
  display: flex;
  flex-direction: column;
  height: 70vh;
}

.ai-prompt-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Tab 头部固定 */
:deep(.ai-prompt-tabs .ant-tabs-nav) {
  margin-bottom: 0;
  padding: 0 24px;
}

/* Tab 内容区域可滚动 */
:deep(.ai-prompt-tabs .ant-tabs-content-holder) {
  flex: 1;
  overflow: hidden;
}

:deep(.ai-prompt-tabs .ant-tabs-content) {
  height: 100%;
}

:deep(.ai-prompt-tabs .ant-tabs-tabpane) {
  height: 100%;
}

.tab-content-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
}

/* API文档样式 */
.api-doc-content {
  padding: 0;
}

.api-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1890ff;
}

:deep(.dark) .api-title {
  color: #40a9ff;
}

.api-url-box {
  padding: 16px;
  background-color: #e6f7ff;
  border-radius: 4px;
  border-left: 3px solid #1890ff;
  word-break: break-all;
}

:deep(.dark) .api-url-box {
  background-color: rgba(24, 144, 255, 0.1);
  border-left-color: #40a9ff;
}

.api-method {
  display: inline-block;
  padding: 2px 8px;
  margin-right: 8px;
  background-color: #52c41a;
  color: #fff;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.api-url {
  color: #333;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

:deep(.dark) .api-url {
  color: rgba(255, 255, 255, 0.85);
}

.api-desc {
  color: #666;
  line-height: 1.6;
}

:deep(.dark) .api-desc {
  color: rgba(255, 255, 255, 0.65);
}

.mb-2 {
  margin-bottom: 8px;
}

.api-code {
  padding: 16px;
  margin: 0;
  background-color: #1e1e1e;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
  color: #e8e8e8;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.ai-prompt-box {
  padding: 16px;
  background-color: #e6f7ff;
  border-radius: 4px;
  border-left: 3px solid #1890ff;
}

:deep(.dark) .ai-prompt-box {
  background-color: rgba(24, 144, 255, 0.1);
  border-left-color: #40a9ff;
}

.ai-prompt-box p {
  margin: 0 0 12px 0;
  color: #333;
  line-height: 1.6;
}

:deep(.dark) .ai-prompt-box p {
  color: rgba(255, 255, 255, 0.85);
}

.ai-prompt-code {
  margin: 0;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.dark) .ai-prompt-code {
  background-color: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.85);
}

.ai-prompt-editor {
  position: relative;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
}

:deep(.dark) .ai-prompt-editor {
  border-color: #434343;
}

.ai-prompt-header {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  background-color: #fafafa;
  border-bottom: 1px solid #d9d9d9;
}

:deep(.dark) .ai-prompt-header {
  background-color: #1f1f1f;
  border-bottom-color: #434343;
}

.ai-prompt-textarea {
  border: none !important;
  border-radius: 0 !important;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.ai-prompt-textarea:focus {
  box-shadow: none !important;
}

.mt-4 {
  margin-top: 16px;
}

.ml-2 {
  margin-left: 8px;
}
</style>
