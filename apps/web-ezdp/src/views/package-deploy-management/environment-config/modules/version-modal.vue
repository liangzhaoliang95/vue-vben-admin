<script lang="ts" setup>
import type { DeployEnvironmentApi } from '#/api/project-management/deploy-environment';

import { computed, ref, watch } from 'vue';

import { Modal, Table, Tag } from 'ant-design-vue';

import { getEnvironmentProjectVersions } from '#/api/project-management/deploy-environment';
import { $t } from '#/locales';

const props = defineProps<{
  environmentId: string;
  environmentName: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  close: [];
}>();

const open = defineModel<boolean>('open', { default: false });
const loading = ref(false);
const versions = ref<DeployEnvironmentApi.EnvironmentProjectVersion[]>([]);

// 表格列定义
const columns = computed(() => [
  {
    dataIndex: 'projectName',
    key: 'projectName',
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.projectName'),
    width: 200,
  },
  {
    dataIndex: 'projectType',
    key: 'projectType',
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.projectType'),
    width: 120,
  },
  {
    dataIndex: 'version',
    key: 'version',
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.version'),
    width: 150,
  },
  {
    dataIndex: 'deployedAt',
    key: 'deployedAt',
    title: $t('deploy.packageDeployManagement.environmentConfig.versionModal.deployedAt'),
    width: 180,
  },
]);

// 格式化部署时间
function formatDeployedAt(timestamp: number) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 获取项目类型标签颜色
function getProjectTypeColor(type: string) {
  if (type === 'frontend') return 'blue';
  if (type === 'backend') return 'green';
  return 'default';
}

// 获取项目类型文本
function getProjectTypeText(type: string) {
  if (type === 'frontend') {
    return $t('deploy.packageDeployManagement.environmentConfig.versionModal.frontend');
  }
  if (type === 'backend') {
    return $t('deploy.packageDeployManagement.environmentConfig.versionModal.backend');
  }
  return type;
}

// 加载版本数据
async function loadVersions() {
  if (!props.environmentId) return;

  loading.value = true;
  try {
    const res = await getEnvironmentProjectVersions(props.environmentId);
    versions.value = res.list || [];
  } catch (error) {
    console.error('加载环境项目版本失败:', error);
    versions.value = [];
  } finally {
    loading.value = false;
  }
}

// 监听打开状态,打开时加载数据
watch(open, (newVal) => {
  if (newVal) {
    loadVersions();
  }
});

function handleClose() {
  open.value = false;
  emit('close');
}
</script>

<template>
  <Modal
    v-model:open="open"
    :title="$t('deploy.packageDeployManagement.environmentConfig.versionModal.title', [environmentName])"
    width="800px"
    :footer="null"
    @cancel="handleClose"
  >
    <Table
      :columns="columns"
      :data-source="versions"
      :loading="loading"
      :pagination="false"
      :scroll="{ y: 400 }"
      row-key="projectConfigId"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'projectType'">
          <Tag :color="getProjectTypeColor(record.projectType)">
            {{ getProjectTypeText(record.projectType) }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'deployedAt'">
          {{ formatDeployedAt(record.deployedAt) }}
        </template>
      </template>
      <template #emptyText>
        <div style="padding: 40px 0; text-align: center; color: #999;">
          {{ $t('deploy.packageDeployManagement.environmentConfig.versionModal.noData') }}
        </div>
      </template>
    </Table>
  </Modal>
</template>

<style scoped>
:deep(.ant-table) {
  font-size: 14px;
}

:deep(.ant-table-thead > tr > th) {
  background-color: #fafafa;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
  border-bottom: 1px solid #f0f0f0;
}

/* 深色模式 */
:deep(.dark .ant-table-thead > tr > th) {
  background-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

:deep(.dark .ant-table) {
  color: rgba(255, 255, 255, 0.85);
}

:deep(.dark .ant-table-tbody > tr > td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

:deep(.dark .ant-table-tbody > tr:hover > td) {
  background-color: rgba(255, 255, 255, 0.04);
}
</style>
