<script lang="ts" setup>
import type { BuildAgentApi } from '#/api/deploy-tools/build-agent';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Button, Descriptions, Modal, Progress, Radio, RadioGroup, Spin, Tag, Tooltip } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import { getBuildAgentDetail, getBuildAgentStats, getBuildAgentStatsHistory } from '#/api/deploy-tools/build-agent';
import { $t } from '#/locales';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const props = defineProps<{
  latestVersion?: string;
}>();

const visible = ref(false);
const loading = ref(false);
const historyLoading = ref(false);
const agentDetail = ref<BuildAgentApi.BuildAgent | null>(null);
const historyList = ref<BuildAgentApi.BuildAgentStats[]>([]);
let refreshTimer: NodeJS.Timeout | null = null;

// 时间范围
type RangePreset = '1h' | '6h' | '24h' | 'custom';
const rangePreset = ref<RangePreset>('1h');

const timeRange = computed<{ startMs: number; endMs: number }>(() => {
  const now = Date.now();
  const hours = rangePreset.value === '1h' ? 1 : rangePreset.value === '6h' ? 6 : 24;
  return { startMs: now - hours * 3600 * 1000, endMs: now };
});

// ECharts refs
const cpuChartRef = ref<HTMLElement | null>(null);
const memChartRef = ref<HTMLElement | null>(null);
const netChartRef = ref<HTMLElement | null>(null);
let cpuChart: echarts.ECharts | null = null;
let memChart: echarts.ECharts | null = null;
let netChart: echarts.ECharts | null = null;

const COLORS = {
  text: '#ccc',
  grid: '#333',
  cpu: '#4096ff',
  mem: '#52c41a',
  recv: '#36cfc9',
  sent: '#ff7875',
};

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

// 格式化网络字节
function formatNetworkBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getStatusText(status: number): string {
  switch (status) {
    case 1: return $t('deploy.tools.buildAgent.statusOnline');
    case 2: return $t('deploy.tools.buildAgent.statusBusy');
    case 3: return $t('deploy.tools.buildAgent.statusDisabled');
    default: return $t('deploy.tools.buildAgent.statusOffline');
  }
}

function getStatusColor(status: number): string {
  switch (status) {
    case 1: return 'success';
    case 2: return 'processing';
    case 3: return 'default';
    default: return 'error';
  }
}

function needsUpdate(currentVersion: string): boolean {
  if (!props.latestVersion || !currentVersion) return false;
  return currentVersion < props.latestVersion;
}

// 使用率百分比
const cpuUsagePercent = computed(() => {
  if (!agentDetail.value) return 0;
  if (agentDetail.value.cpuUsagePercent) return Math.round(agentDetail.value.cpuUsagePercent);
  if (!agentDetail.value.cpuCores) return 0;
  return Math.round((agentDetail.value.cpuUsage / agentDetail.value.cpuCores) * 100);
});

const memoryUsagePercent = computed(() => {
  if (!agentDetail.value) return 0;
  if (agentDetail.value.memoryUsagePercent) return Math.round(agentDetail.value.memoryUsagePercent);
  if (!agentDetail.value.memoryTotal) return 0;
  return Math.round((agentDetail.value.memoryUsage / agentDetail.value.memoryTotal) * 100);
});

const diskUsagePercent = computed(() => {
  if (!agentDetail.value) return 0;
  if (agentDetail.value.diskUsagePercent) return Math.round(agentDetail.value.diskUsagePercent);
  if (!agentDetail.value.diskTotal) return 0;
  return Math.round((agentDetail.value.diskUsage / agentDetail.value.diskTotal) * 100);
});

function usageColor(percent: number): string {
  if (percent >= 80) return '#ff4d4f';
  if (percent >= 60) return '#faad14';
  return '#52c41a';
}

const privateIpsList = computed(() => {
  if (!agentDetail.value?.privateIps) return [];
  return agentDetail.value.privateIps.split(',').filter(Boolean);
});

// 最新 stats 记录（用于多块磁盘展示）
const latestStats = ref<BuildAgentApi.BuildAgentStats | null>(null);

const diskList = computed<BuildAgentApi.DiskInfo[]>(() => {
  if (!latestStats.value?.diskJson) return [];
  try {
    return JSON.parse(latestStats.value.diskJson);
  } catch {
    return [];
  }
});

// ---- ECharts ----

function buildLineOption(
  series: { name: string; data: [number, number][]; color: string }[],
  yFormatter: (v: number) => string,
) {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f1f1f',
      borderColor: '#444',
      textStyle: { color: '#eee', fontSize: 12 },
      formatter: (params: any[]) => {
        const time = dayjs(params[0].value[0]).format('MM-DD HH:mm:ss');
        const lines = params.map(
          (p: any) =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: ${yFormatter(p.value[1])}`,
        );
        return `${time}<br/>${lines.join('<br/>')}`;
      },
    },
    legend: { textStyle: { color: COLORS.text, fontSize: 12 }, top: 4 },
    grid: { left: 60, right: 16, top: 36, bottom: 40 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.text, fontSize: 11, formatter: (v: number) => dayjs(v).format('HH:mm') },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.text, fontSize: 11, formatter: yFormatter },
      splitLine: { lineStyle: { color: COLORS.grid, type: 'dashed' } },
    },
    dataZoom: [{ type: 'inside', filterMode: 'none' }],
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { color: s.color, width: 2 },
      itemStyle: { color: s.color },
      data: s.data,
    })),
  };
}

function initCharts() {
  // 每次初始化前先销毁旧实例，确保使用最新的 DOM 容器
  disposeCharts();
  if (cpuChartRef.value) cpuChart = echarts.init(cpuChartRef.value);
  if (memChartRef.value) memChart = echarts.init(memChartRef.value);
  if (netChartRef.value) netChart = echarts.init(netChartRef.value);
}

function disposeCharts() {
  cpuChart?.dispose();
  memChart?.dispose();
  netChart?.dispose();
  cpuChart = null;
  memChart = null;
  netChart = null;
}

function renderCharts() {
  const list = historyList.value;
  if (!list.length) return;

  const cpuData: [number, number][] = list.map((r) => [r.timestamp, r.cpuUsagePercent]);
  const memData: [number, number][] = list.map((r) => [r.timestamp, r.memUsedPct]);
  const recvData: [number, number][] = list.map((r) => [r.timestamp, r.netBytesRecv]);
  const sentData: [number, number][] = list.map((r) => [r.timestamp, r.netBytesSent]);

  cpuChart?.setOption(
    buildLineOption(
      [{ name: 'CPU 使用率', data: cpuData, color: COLORS.cpu }],
      (v) => `${v.toFixed(1)}%`,
    ),
  );

  memChart?.setOption(
    buildLineOption(
      [{ name: '内存使用率', data: memData, color: COLORS.mem }],
      (v) => `${v.toFixed(1)}%`,
    ),
  );

  netChart?.setOption(
    buildLineOption(
      [
        { name: '接收', data: recvData, color: COLORS.recv },
        { name: '发送', data: sentData, color: COLORS.sent },
      ],
      formatNetworkBytes,
    ),
  );

  // 确保图表尺寸与容器匹配（修复 Spin 加载导致的错位）
  cpuChart?.resize();
  memChart?.resize();
  netChart?.resize();
}

// ---- 数据加载 ----

async function loadDetail(agentId: string) {
  loading.value = true;
  try {
    const detail = await getBuildAgentDetail(agentId);
    agentDetail.value = detail;
    // 加载最新 stats（用于多块磁盘展示）
    try {
      const stats = await getBuildAgentStats(agentId);
      latestStats.value = stats;
    } catch {
      latestStats.value = null;
    }
  } catch (error: any) {
    console.error('加载详情失败:', error);
  } finally {
    loading.value = false;
  }
}

async function loadHistory(agentId: string) {
  historyLoading.value = true;
  try {
    const { startMs, endMs } = timeRange.value;
    const list = await getBuildAgentStatsHistory({
      agentId,
      startMs,
      endMs,
      limit: 500,
    });
    historyList.value = (list || []).sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    // ignore
  } finally {
    historyLoading.value = false;
    // 等待 Spin 加载动画消失、DOM 稳定后再初始化图表，避免容器尺寸获取错误导致图表错位
    await nextTick();
    initCharts();
    renderCharts();
  }
}

function startRefresh(agentId: string) {
  stopRefresh();
  refreshTimer = setInterval(() => {
    loadDetail(agentId);
  }, 10000);
}

function stopRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function onRangePresetChange() {
  if (agentDetail.value) {
    loadHistory(agentDetail.value.id);
  }
}

// 打开弹窗
function open(agent: BuildAgentApi.BuildAgent) {
  visible.value = true;
  agentDetail.value = agent;
  loadDetail(agent.id);
  loadHistory(agent.id);
  startRefresh(agent.id);
}

// 关闭弹窗
function handleCancel() {
  visible.value = false;
  stopRefresh();
  disposeCharts();
  agentDetail.value = null;
  historyList.value = [];
}

onBeforeUnmount(() => {
  stopRefresh();
  disposeCharts();
});

defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="$t('deploy.tools.buildAgent.detailTitle')"
    :footer="null"
    :width="920"
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
            <Tag v-if="!agentDetail.enabled" color="default" class="ml-2">
              {{ $t('deploy.tools.buildAgent.statusDisabled') }}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('system.businessLine.name')">
            {{ agentDetail.businessLineName || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.hostname')">
            {{ agentDetail.hostname || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.publicIp')">
            {{ agentDetail.publicIp || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.privateIps')">
            <Tag v-for="ip in privateIpsList" :key="ip" class="mb-1 mr-1">{{ ip }}</Tag>
            <span v-if="privateIpsList.length === 0">-</span>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.osVersion')">
            {{ agentDetail.osVersion || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.version')">
            {{ agentDetail.version || '-' }}
            <Tooltip v-if="needsUpdate(agentDetail.version)">
              <Tag color="warning" class="ml-2">
                {{ $t('deploy.tools.buildAgent.upgradeAvailable') }}: {{ latestVersion }}
              </Tag>
            </Tooltip>
          </Descriptions.Item>
        </Descriptions>

        <!-- 历史趋势图表 -->
        <div class="mt-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold">历史趋势</span>
            <RadioGroup v-model:value="rangePreset" size="small" @change="onRangePresetChange">
              <Radio value="1h">近1小时</Radio>
              <Radio value="6h">近6小时</Radio>
              <Radio value="24h">近24小时</Radio>
            </RadioGroup>
          </div>
          <Spin :spinning="historyLoading">
            <div class="chart-grid">
              <div ref="cpuChartRef" class="chart-box" />
              <div ref="memChartRef" class="chart-box" />
              <div ref="netChartRef" class="chart-box" />
            </div>
          </Spin>
        </div>

        <!-- 任务信息 -->
        <Descriptions :column="3" bordered class="mt-4" size="small" :title="$t('deploy.tools.buildAgent.taskInfo')">
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
            <span class="text-green-500">{{ agentDetail.successTasks }}</span>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.failedTasks')">
            <span class="text-red-500">{{ agentDetail.failedTasks }}</span>
          </Descriptions.Item>
          <Descriptions.Item label="成功率">
            <span v-if="agentDetail.totalTasks > 0">
              {{ ((agentDetail.successTasks / agentDetail.totalTasks) * 100).toFixed(1) }}%
            </span>
            <span v-else>-</span>
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
        </Descriptions>

        <!-- 描述 -->
        <Descriptions v-if="agentDetail.description" :column="1" bordered class="mt-4" size="small" :title="$t('deploy.tools.buildAgent.description')">
          <Descriptions.Item>{{ agentDetail.description }}</Descriptions.Item>
        </Descriptions>

        <!-- 硬件信息 -->
        <Descriptions :column="3" bordered class="mt-4" size="small" :title="$t('deploy.tools.buildAgent.hardwareInfo')">
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.cpuCores')">
            {{ agentDetail.cpuCores }}核 ({{ agentDetail.cpuModel || '-' }})
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.cpuUsage')">
            <Progress :percent="cpuUsagePercent" :stroke-color="usageColor(cpuUsagePercent)" />
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.loadAvg')">
            {{ (latestStats?.load1 ?? agentDetail.loadAvg1)?.toFixed(2) || '-' }} / {{ (latestStats?.load5 ?? agentDetail.loadAvg5)?.toFixed(2) || '-' }} / {{ (latestStats?.load15 ?? agentDetail.loadAvg15)?.toFixed(2) || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.memoryTotal')">
            {{ formatBytes(agentDetail.memoryTotal) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.memoryUsage')">
            <Progress :percent="memoryUsagePercent" :stroke-color="usageColor(memoryUsagePercent)" />
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.networkBytesSent')">
            ↓{{ formatNetworkBytes(latestStats?.netBytesRecv ?? agentDetail.networkBytesRecv) }} / ↑{{ formatNetworkBytes(latestStats?.netBytesSent ?? agentDetail.networkBytesSent) }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('deploy.tools.buildAgent.diskUsage')">
            <!-- 多块磁盘 -->
            <div v-if="diskList.length > 0" class="disk-list">
              <div v-for="disk in diskList" :key="disk.path" class="disk-item">
                <div class="text-xs text-gray-400 mb-1">{{ disk.path }}</div>
                <Progress
                  :percent="Math.round(disk.usedPercent)"
                  :stroke-color="usageColor(Math.round(disk.usedPercent))"
                  :format="() => `${Math.round(disk.usedPercent)}%`"
                  size="small"
                />
                <div class="text-xs text-gray-500 mt-0.5">{{ formatBytes(disk.used) }} / {{ formatBytes(disk.total) }}</div>
              </div>
            </div>
            <!-- 兜底：无 stats 数据时用 agent 信息 -->
            <Progress v-else :percent="diskUsagePercent" :stroke-color="usageColor(diskUsagePercent)" />
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

.mt-4 { margin-top: 16px; }
.ml-2 { margin-left: 8px; }
.mb-1 { margin-bottom: 4px; }
.mr-1 { margin-right: 4px; }

.chart-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.chart-box {
  width: 100%;
  height: 200px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.disk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.disk-item {
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.disk-item:last-child {
  border-bottom: none;
}
</style>
