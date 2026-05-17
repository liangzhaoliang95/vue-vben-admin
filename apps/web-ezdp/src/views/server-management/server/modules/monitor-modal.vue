<script lang="ts" setup>
import { ref, watch, onUnmounted, nextTick, computed } from 'vue';
import {
  Modal,
  Button,
  Spin,
  Descriptions,
  DescriptionsItem,
  Progress,
  Space,
  Radio,
  RadioGroup,
  DatePicker,
} from 'ant-design-vue';
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
import { ServerManagementApi } from '#/api/server-management';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

interface Props {
  open: boolean;
  serverId: string;
  serverName: string;
  cpuModel?: string;
  memTotal?: number;
  server?: ServerManagementApi.Server | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'update:open': [val: boolean] }>();

const statsData = ref<ServerManagementApi.ServerStats | null>(null);
const statsLoading = ref(false);
const historyLoading = ref(false);
const historyList = ref<ServerManagementApi.ServerStatsRecord[]>([]);

type RangePreset = '1h' | '6h' | '24h' | 'custom';
const rangePreset = ref<RangePreset>('1h');
const customRange = ref<[Dayjs, Dayjs] | undefined>(undefined);

const timeRange = computed<{ startMs: number; endMs: number }>(() => {
  const now = Date.now();
  if (rangePreset.value === 'custom' && customRange.value) {
    return {
      startMs: customRange.value[0].valueOf(),
      endMs: customRange.value[1].valueOf(),
    };
  }
  const hours = rangePreset.value === '1h' ? 1 : rangePreset.value === '6h' ? 6 : 24;
  return { startMs: now - hours * 3600 * 1000, endMs: now };
});

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

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}天 ${h}小时` : h > 0 ? `${h}小时 ${m}分钟` : `${m}分钟`;
}

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
    legend: {
      textStyle: { color: COLORS.text, fontSize: 12 },
      top: 4,
    },
    grid: { left: 60, right: 16, top: 36, bottom: 40 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: {
        color: COLORS.text,
        fontSize: 11,
        formatter: (v: number) => dayjs(v).format('HH:mm'),
      },
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
  if (cpuChartRef.value && !cpuChart) cpuChart = echarts.init(cpuChartRef.value);
  if (memChartRef.value && !memChart) memChart = echarts.init(memChartRef.value);
  if (netChartRef.value && !netChart) netChart = echarts.init(netChartRef.value);
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

  const cpuData: [number, number][] = list.map((r) => [r.timestamp, r.cpuUsage]);
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
      formatBytes,
    ),
  );
}

async function loadSnapshot() {
  statsLoading.value = true;
  try {
    const res = await ServerManagementApi.getServerStats({ serverId: props.serverId });
    statsData.value = res.stats;
  } catch {
    // ignore
  } finally {
    statsLoading.value = false;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    const { startMs, endMs } = timeRange.value;
    const res = await ServerManagementApi.getServerStatsHistory({
      serverId: props.serverId,
      startMs,
      endMs,
      limit: 500,
    });
    historyList.value = (res.list || []).sort((a, b) => a.timestamp - b.timestamp);
    await nextTick();
    initCharts();
    renderCharts();
  } catch {
    // ignore
  } finally {
    historyLoading.value = false;
  }
}

async function refresh() {
  await Promise.all([loadSnapshot(), loadHistory()]);
}

function onRangePresetChange() {
  if (rangePreset.value !== 'custom') {
    loadHistory();
  }
}

function onCustomRangeChange() {
  if (customRange.value) {
    loadHistory();
  }
}

watch(
  () => props.open,
  async (val) => {
    if (val) {
      statsData.value = null;
      historyList.value = [];
      rangePreset.value = '1h';
      customRange.value = undefined;
      await nextTick();
      await refresh();
    } else {
      disposeCharts();
    }
  },
);

onUnmounted(() => {
  disposeCharts();
});
</script>

<template>
  <Modal
    :open="props.open"
    :title="`监控 - ${props.serverName}`"
    :width="860"
    :footer="null"
    :destroy-on-close="true"
    wrap-class-name="monitor-modal"
    @update:open="emit('update:open', $event)"
  >
    <div class="monitor-body">
      <!-- 顶部工具栏 -->
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <Space wrap>
          <RadioGroup
            v-model:value="rangePreset"
            button-style="solid"
            size="small"
            @change="onRangePresetChange"
          >
            <Radio value="1h">近1小时</Radio>
            <Radio value="6h">近6小时</Radio>
            <Radio value="24h">近24小时</Radio>
            <Radio value="custom">自定义</Radio>
          </RadioGroup>
          <DatePicker.RangePicker
            v-if="rangePreset === 'custom'"
            v-model:value="customRange"
            show-time
            size="small"
            style="width: 340px"
            @change="onCustomRangeChange"
          />
        </Space>
        <Button size="small" :loading="statsLoading || historyLoading" @click="refresh">
          刷新
        </Button>
      </div>

      <!-- 滚动内容区 -->
      <div class="monitor-scroll">
        <!-- 服务器基本信息 -->
        <div v-if="props.server" class="mb-4">
          <Descriptions bordered :column="2" size="small">
            <DescriptionsItem label="主机名">
              {{ props.server.hostname || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="操作系统">
              {{ props.server.osVersion || props.server.os || '-' }}
              <span v-if="props.server.arch" class="text-gray-400 ml-1">({{ props.server.arch }})</span>
            </DescriptionsItem>
            <DescriptionsItem label="公网 IP">
              {{ props.server.publicIp || props.server.ip || '-' }}
              <span v-if="props.server.ipLocation" class="text-gray-400 ml-1">({{ props.server.ipLocation }})</span>
            </DescriptionsItem>
            <DescriptionsItem label="内网 IP">
              {{ props.server.privateIps || '-' }}
            </DescriptionsItem>
          </Descriptions>
        </div>

        <!-- 硬件配置（始终显示，不依赖实时数据） -->
        <div v-if="props.cpuModel || props.memTotal" class="mb-4">
          <Descriptions bordered :column="2" size="small">
            <DescriptionsItem v-if="props.cpuModel" label="CPU 型号" :span="2">
              {{ props.cpuModel }}
            </DescriptionsItem>
            <DescriptionsItem v-if="props.memTotal" label="内存配置">
              {{ formatBytes(props.memTotal) }}
            </DescriptionsItem>
          </Descriptions>
        </div>

        <!-- 系统概览 -->
        <Spin :spinning="statsLoading">
          <div v-if="statsData" class="mb-4">
            <Descriptions bordered :column="2" size="small">
              <DescriptionsItem label="运行时间">
                {{ formatUptime(statsData.uptime) }}
              </DescriptionsItem>
              <DescriptionsItem label="进程数">{{ statsData.processCount }}</DescriptionsItem>
              <DescriptionsItem label="系统负载 (1/5/15min)">
                {{ statsData.loadAvg?.load1?.toFixed(2) }} /
                {{ statsData.loadAvg?.load5?.toFixed(2) }} /
                {{ statsData.loadAvg?.load15?.toFixed(2) }}
              </DescriptionsItem>
              <DescriptionsItem label="网络收/发">
                ↓ {{ formatBytes(statsData.network?.bytesRecv) }} / ↑
                {{ formatBytes(statsData.network?.bytesSent) }}
              </DescriptionsItem>
            </Descriptions>
          </div>
          <div v-else-if="!statsLoading" class="text-center text-gray-400 py-4 text-sm">
            暂无快照数据
          </div>
        </Spin>

        <!-- 历史图表 -->
        <Spin :spinning="historyLoading">
          <div v-if="historyList.length > 0" class="space-y-4 mb-4">
            <div class="chart-section">
              <div class="chart-title">CPU 使用率 (%)</div>
              <div ref="cpuChartRef" class="chart-canvas" />
            </div>
            <div class="chart-section">
              <div class="chart-title">内存使用率 (%)</div>
              <div ref="memChartRef" class="chart-canvas" />
            </div>
            <div class="chart-section">
              <div class="chart-title">网络流量</div>
              <div ref="netChartRef" class="chart-canvas" />
            </div>
          </div>
          <div v-else-if="!historyLoading" class="text-center text-gray-400 py-6 text-sm">
            暂无历史数据
          </div>
        </Spin>

        <!-- 当前 CPU / 内存进度条 -->
        <Spin :spinning="statsLoading">
          <div v-if="statsData" class="space-y-3 mb-4">
            <div>
              <div class="text-xs text-gray-400 mb-1">
                CPU 使用率 ({{ statsData.cpu?.coreCount }} 核)
              </div>
              <Progress
                :percent="Math.round(statsData.cpu?.usagePercent || 0)"
                :stroke-color="statsData.cpu?.usagePercent > 80 ? '#ff4d4f' : '#1677ff'"
              />
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">
                内存使用率 — {{ formatBytes(statsData.memory?.used) }} /
                {{ formatBytes(statsData.memory?.total) }}
              </div>
              <Progress
                :percent="Math.round(statsData.memory?.usedPercent || 0)"
                :stroke-color="statsData.memory?.usedPercent > 80 ? '#ff4d4f' : '#52c41a'"
              />
            </div>
          </div>
        </Spin>

        <!-- 磁盘 -->
        <Spin :spinning="statsLoading">
          <div v-if="statsData?.disk?.length">
            <div class="text-xs text-gray-400 mb-2">磁盘</div>
            <div v-for="d in statsData.disk" :key="d.path" class="mb-2">
              <div class="text-xs text-gray-500 mb-1">
                {{ d.path }} — {{ formatBytes(d.used) }} / {{ formatBytes(d.total) }}
              </div>
              <Progress
                :percent="Math.round(d.usedPercent || 0)"
                size="small"
                :stroke-color="d.usedPercent > 85 ? '#ff4d4f' : '#faad14'"
              />
            </div>
          </div>
        </Spin>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.monitor-body {
  display: flex;
  flex-direction: column;
  height: calc(80vh - 110px);
}

.monitor-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.chart-section {
  background: rgb(255 255 255 / 3%);
  border-radius: 6px;
  padding: 8px 12px 4px;
}

.chart-title {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 4px;
}

.chart-canvas {
  height: 180px;
  width: 100%;
}
</style>
