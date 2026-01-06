<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Checkbox, Input, message, Modal, Select } from 'ant-design-vue';

import { executeRelease } from '#/api/project-management/project-release';
import { getProjectConfigList } from '#/api/project-management/project-config';
import LogViewer from '#/components/log-viewer/index.vue';
import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';

defineOptions({ name: 'ProjectRelease' });

interface Project {
  id: string;
  name: string;
}

const projectList = ref<Project[]>([]);
const formData = ref({
  projectId: '',
  branch: '',
  isFullRelease: true, // 默认全量Release
});
const loading = ref(false);
const showLogViewer = ref(false);

const wsStore = useWebSocketStore();

// 计算是否禁用项目选择
const isProjectSelectDisabled = computed(() => formData.value.isFullRelease);

// 加载项目列表
async function loadProjects() {
  try {
    const res = await getProjectConfigList({
      pageIndex: 1,
      pageSize: 1000,
    });
    projectList.value = res.items || [];
  } catch (error) {
    console.error('加载项目列表失败:', error);
    message.error('加载项目列表失败');
  }
}

// 执行Release
async function handleExecute() {
  // 验证分支名称
  if (!formData.value.branch) {
    message.warning('请输入分支名称');
    return;
  }

  // 如果是单个项目Release,验证项目ID
  if (!formData.value.isFullRelease && !formData.value.projectId) {
    message.warning('请选择项目');
    return;
  }

  // 构建确认信息
  let confirmContent = '';
  if (formData.value.isFullRelease) {
    confirmContent = `确定要执行全量Release吗？\n分支: ${formData.value.branch}\n\n将会Release所有项目！`;
  } else {
    const projectName =
      projectList.value.find((p) => p.id === formData.value.projectId)?.name ||
      '';
    confirmContent = `确定要执行Release吗？\n项目: ${projectName}\n分支: ${formData.value.branch}`;
  }

  Modal.confirm({
    title: '确认',
    content: confirmContent,
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      try {
        loading.value = true;
        const res = await executeRelease({
          projectId: formData.value.isFullRelease ? '' : formData.value.projectId,
          branch: formData.value.branch,
        });

        message.success(res.message || 'Release已开始执行');

        // 打开日志查看器
        showLogViewer.value = true;

        // 清空表单
        formData.value = {
          projectId: '',
          branch: '',
          isFullRelease: true,
        };
      } catch (error: any) {
        message.error(error.message || '执行失败');
      } finally {
        loading.value = false;
      }
    },
  });
}

// 重置表单
function handleReset() {
  formData.value = {
    projectId: '',
    branch: '',
    isFullRelease: true,
  };
}

// 切换全量/单个模式时清空项目选择
function handleReleaseTypeChange() {
  if (formData.value.isFullRelease) {
    formData.value.projectId = '';
  }
}

// 关闭日志查看器
function handleCloseLogViewer() {
  showLogViewer.value = false;
}

onMounted(() => {
  loadProjects();
});
</script>

<template>
  <Page
    auto-content-height
    content-class="flex flex-col"
    content-full-height
    :description="$t('deploy.projectManagement.projectRelease.title')"
    :title="$t('deploy.projectManagement.projectRelease.title')"
  >
    <Card :bordered="false" title="项目Release">
      <div class="space-y-4">
        <!-- Release模式 -->
        <div>
          <div class="mb-2 text-sm font-medium">Release模式</div>
          <Checkbox
            v-model:checked="formData.isFullRelease"
            @change="handleReleaseTypeChange"
          >
            全量Release（所有项目）
          </Checkbox>
        </div>

        <!-- 项目选择 -->
        <div>
          <div class="mb-2 text-sm font-medium">
            项目
            <span v-if="!formData.isFullRelease" class="text-red-500">*</span>
          </div>
          <Select
            v-model:value="formData.projectId"
            placeholder="请选择项目（全量Release时无需选择）"
            show-search
            :disabled="isProjectSelectDisabled"
            class="w-full"
            :filter-option="
              (input: string, option: any) => {
                return option.label.toLowerCase().includes(input.toLowerCase());
              }
            "
          >
            <Select.Option
              v-for="project in projectList"
              :key="project.id"
              :value="project.id"
              :label="project.name"
            >
              {{ project.name }}
            </Select.Option>
          </Select>
        </div>

        <!-- 分支 -->
        <div>
          <div class="mb-2 text-sm font-medium">
            分支
            <span class="text-red-500">*</span>
          </div>
          <Input
            v-model:value="formData.branch"
            placeholder="请输入分支名称，如: dev-1.0"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2">
          <Button type="primary" :loading="loading" @click="handleExecute">
            执行Release
          </Button>
          <Button @click="handleReset"> 重置 </Button>
        </div>
      </div>

      <!-- 说明 -->
      <div class="mt-6">
        <div class="rounded bg-blue-50 p-4 dark:bg-blue-900/20">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">
                说明
              </h3>
              <div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <ul class="list-disc space-y-1 pl-5">
                  <li>
                    Release操作会将指定分支合并到master分支，并打tag推送到远程仓库
                  </li>
                  <li>
                    <strong>全量Release</strong>:
                    对当前业务线的所有项目执行Release（超级管理员可Release所有业务线）
                  </li>
                  <li>
                    <strong>单个项目Release</strong>: 仅对选中的项目执行Release
                  </li>
                  <li>
                    此操作可重复执行，如果已经release过，脚本会提示失败
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- 日志查看器弹窗 -->
    <Modal
      v-model:open="showLogViewer"
      :footer="null"
      :width="1200"
      title="Release日志"
      @cancel="handleCloseLogViewer"
    >
      <div style="height: 600px">
        <LogViewer
          :subscription-id="String(wsStore.currentBusinessLineId)"
          :task-type="2"
          title="Release日志"
          @close="handleCloseLogViewer"
        />
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
/* 可以添加自定义样式 */
</style>
