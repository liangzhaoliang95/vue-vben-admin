<script lang="ts" setup>
import type { BuildAgentApi } from '#/api/deploy-tools/build-agent';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Descriptions, Modal, Progress, Spin, Tag } from 'ant-design-vue';

import { getBuildAgentDetail } from '#/api/deploy-tools/build-agent';
import { $t } from '#/locales';

const visible = ref(false);
const loading = ref(false);
const agentDetail = ref<BuildAgentApi.BuildAgent | null>(null);
let refreshTimer: NodeJS.Timeout | null = null;

// 格式化时间
function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// 格式化字节为GB
function formatBytes(bytes: number): string {
  if (!bytes) return '-';
  const gb = (bytes / 1024 / 1024 / 1024).toFixed(2);
  return `${gb} GB`;
}

// 获取状态文本
function getStatusText(status: number): string {
  switch (status) {
    case 1:
      return $t('deploy.tools.buildAgent.statusOnline');
    case 2:
      return $t('deploy.tools.buildAgent.statusBusy');
    case 3:
      return $t('deploy.tools.buildAgent.statusDisabled');
    case 0:
    default:
      return $t('deploy.tools.buildAgent.statusOffline');
  }
}

// 获取状态颜色
function getStatusColor(status: number): string {
  switch (status) {
    case 1:
      return 'success';
    case 2:
      return 'processing';
    case 3:
      return 'default';
    case 0:
    default:
      return 'error';
  }
}

// CPU使用率百分比
const cpuUsagePercent = computed(() => {
  if (!agentDetail.value || !agentDetail.value.cpuCores) return 0;
  return Math.round((agentDetail.value.cpuUsage / agentDetail.value.cpuCores) * 100);
});

// 内存使用率百分比
const memoryUsagePercent = computed(() => {
  if (!agentDetail.value || !agentDetail.value.memoryTotal) return 0;
  return Math.round((agentDetail.value.memoryUsage / agentDetail.value.memoryTotal) * 100);
});

// 硬盘使用率百分比
const diskUsagePercent = computed(() => {
  if (!agentDetail.value || !agentDetail.value.diskTotal) return 0;
  return Math.round((agentDetail.value.diskUsage / agentDetail.value.diskTotal) * 100);
});

// CPU使用率颜色
const cpuUsageColor = computed(() => {
  const usage = cpuUsagePercent.value;
  if (usage >= 80) return '#ff4d4f';
  if (usage >= 60) return '#faad14';
  return '#52c41a';
});

// 内存使用率颜色
const memoryUsageColor = computed(() => {
  const usage = memoryUsagePercent.value;
  if (usage >= 80) return '#ff4d4f';
  if (usage >= 60) return '#faad14';
  return '#52c41a';
});

// 硬盘使用率颜色
const diskUsageColor = computed(() => {
  const usage = diskUsagePercent.value;
  if (usage >= 80) return '#ff4d4f';
  if (usage >= 60) return '#faad14';
  return '#52c41a';
});

// 加载详情
async function loadDetail(agentId: string) {
  loading.value = true;
  try {
    const detail = await getBuildAgentDetail(agentId);
    agentDetail.value = detail;
  } catch (error: any) {
    console.error('加载详情失败:', error);
  } finally {
    loading.value = false;
  }
}

// 启动定时刷新
function startRefresh(agentId: string) {
  stopRefresh();
  refreshTimer = setInterval(() => {
    loadDetail(agentId);
  }, 10000); // 每10秒刷新一次
}

// 停止定时刷新
function stopRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 打开弹窗
function open(agent: BuildAgentApi.BuildAgent) {
  visible.value = true;
  loadDetail(agent.id);
  startRefresh(agent.id);
}

// 关闭弹窗
function handleCancel() {
  visible.value = false;
  stopRefresh();
  agentDetail.value = null;
}

// 组件卸载时清理定时器
onBeforeUnmount(() => {
  stopRefresh();
});

// 暴露方法给父组件
defineExpose({
  open,
});
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="$t('deploy.tools.buildAgent.detailTitle')"
    :footer="null"
    :width="800"
    @cancel="handleCancel"
  >
    <Spin :spinning="loading">
      <div v-if="agentDetail" class="agent-detail">
        <!-- 基本信息 -->
        <Descriptions :column="2" bordered size="small" :title="$t('deploy.tools.buildAgent.basicInfo')">
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.name')">
            {{ agentDetail.name }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('common.status.name')">
            <Tag :color="getStatusColor(agentDetail.status)">
              {{ getStatusText(agentDetail.status) }}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('system.businessLine.name')">
            {{ agentDetail.businessLineName || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.hostname')">
            {{ agentDetail.hostname || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.ipAddress')">
            {{ agentDetail.ipAddress || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.publicIp')">
            {{ agentDetail.publicIp || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.osArch')">
            {{ agentDetail.os }}/{{ agentDetail.arch }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.osVersion')">
            {{ agentDetail.osVersion || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.version')">
            {{ agentDetail.version || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.cpuModel')">
            {{ agentDetail.cpuModel || '-' }}
          </Descriptions.Item>
        </Descriptions>

        <!-- 硬件信息 -->
        <Descriptions :column="3" bordered class="mt-4" size="small" :title="$t('deploy.tools.buildAgent.hardwareInfo')">
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.cpuCores')">
            {{ agentDetail.cpuCores }}核
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.cpuUsed')">
            {{ agentDetail.cpuUsage?.toFixed(2) || 0 }}核
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.cpuUsage')">
            <Progress :percent="cpuUsagePercent" :stroke-color="cpuUsageColor" />
          </Descriptions.Item>

          <Descriptions.Item :label="$t('deploy.tools.buildAgent.memoryTotal')">
            {{ formatBytes(agentDetail.memoryTotal) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.memoryUsed')">
            {{ formatBytes(agentDetail.memoryUsage) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.memoryUsage')">
            <Progress :percent="memoryUsagePercent" :stroke-color="memoryUsageColor" />
          </Descriptions.Item>

          <Descriptions.Item :label="$t('deploy.tools.buildAgent.diskTotal')">
            {{ formatBytes(agentDetail.diskTotal) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.diskUsed')">
            {{ formatBytes(agentDetail.diskUsage) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.diskUsage')">
            <Progress :percent="diskUsagePercent" :stroke-color="diskUsageColor" />
          </Descriptions.Item>
        </Descriptions>

        <!-- 任务信息 -->
        <Descriptions :column="2" bordered class="mt-4" size="small" :title="$t('deploy.tools.buildAgent.taskInfo')">
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.maxConcurrentTasks')">
            {{ agentDetail.maxConcurrentTasks }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.currentTasks')">
            {{ agentDetail.currentTasks }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.totalTasks')">
            {{ agentDetail.totalTasks }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.successTasks')">
            {{ agentDetail.successTasks }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.failedTasks')">
            {{ agentDetail.failedTasks }}
          </Descriptions.Item>
        </Descriptions>

        <!-- 时间信息 -->
        <Descriptions :column="2" bordered class="mt-4" size="small" :title="$t('deploy.tools.buildAgent.timeInfo')">
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.lastHeartbeatAt')">
            {{ formatDateTime(agentDetail.lastHeartbeatAt) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.registeredAt')">
            {{ formatDateTime(agentDetail.registeredAt) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('common.createdAt')">
            {{ formatDateTime(agentDetail.createdAt) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('common.updatedAt')">
            {{ formatDateTime(agentDetail.updatedAt) }}
          </Descriptions.Item>
        </Descriptions>

        <!-- 描述信息 -->
        <Descriptions v-if="agentDetail.description" :column="1" bordered class="mt-4" size="small" :title="$t('deploy.tools.buildAgent.description')">
          <Descriptions.Item>
            {{ agentDetail.description }}
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Spin>
  </Modal>
</template>

<style scoped>
.agent-detail {
  padding: 16px 0;
}

.mt-4 {
  margin-top: 16px;
}
</style>
