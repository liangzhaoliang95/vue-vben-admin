<script setup lang="ts">
import '../../assets/fonts/0xproto.css';
import type { WebSocketMessage } from '#/store/websocket';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Button, Checkbox, Input, Space, Switch } from 'ant-design-vue';
import { Terminal } from 'xterm';

import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';

import 'xterm/css/xterm.css';

interface Props {
  subscriptionId: string;
  title?: string;
  taskType?: 1 | 2 | 3; // 1=构建日志, 2=部署日志, 3=预检查日志, undefined=全部
}

const props = withDefaults(defineProps<Props>(), {
  title: '实时日志',
});

const emit = defineEmits<{
  close: [];
}>();

// 日志级别定义
const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'SUCCESS'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

// 日志字段定义
const LOG_FIELDS = [
  { key: 'timestamp', label: '时间戳', default: true },
  { key: 'level', label: '级别', default: true },
  { key: 'logFrom', label: '来源', default: true },
  { key: 'logName', label: '项目', default: true },
  { key: 'message', label: '消息', default: true },
  { key: 'runningTime', label: '运行时间', default: false },
] as const;

const terminalRef = ref<HTMLDivElement>();
const searchInputRef = ref<InstanceType<typeof Input>>();
let terminal: null | Terminal = null;
let fitAddon: FitAddon | null = null;
let searchAddon: null | SearchAddon = null;
let unsubscribe: (() => void) | null = null;
let hasOnlyWaitingMessage = true;
let resizeObserver: null | ResizeObserver = null;
let wheelHandler: ((e: WheelEvent) => void) | null = null;

// 状态
const isConnected = ref(false);
const totalLines = ref(0);
const autoScroll = ref(true);
const searchKeyword = ref('');
const showSearch = ref(false);
const showFilterPanel = ref(false);
const searchResultCount = ref(0);
const currentSearchIndex = ref(0);

// 过滤配置
const levelFilters = ref<LogLevel[]>(Array.from(LOG_LEVELS));
const visibleFields = ref<string[]>(
  LOG_FIELDS.filter((f) => f.default).map((f) => f.key),
);

const wsStore = useWebSocketStore();

// 连接状态
const connectionStatus = computed(() => wsStore.connectionStatus);

// 监听连接状态变化
watch(
  connectionStatus,
  (connected) => {
    isConnected.value = connected;
  },
  { immediate: true },
);

// 级别选项
const levelOptions = [
  { label: '调试', value: 'DEBUG' },
  { label: '信息', value: 'INFO' },
  { label: '警告', value: 'WARNING' },
  { label: '错误', value: 'ERROR' },
  { label: '成功', value: 'SUCCESS' },
];

// 级别中文映射
const LEVEL_CHINESE: Record<LogLevel, string> = {
  DEBUG: '调试',
  INFO: '信息',
  WARNING: '警告',
  ERROR: '错误',
  SUCCESS: '成功',
};

// 字段选项
const fieldOptions = LOG_FIELDS.map((field) => ({
  label: field.label,
  value: field.key,
}));

// 级别颜色映射
const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: '\u001B[36m', // Cyan
  INFO: '\u001B[97m', // Bright White
  WARNING: '\u001B[33m', // Yellow
  ERROR: '\u001B[31m', // Red
  SUCCESS: '\u001B[92m', // Bright Green
};

// 来源颜色映射（统一使用深蓝色）
function getLogFromColor(logFrom: string): string {
  return '\u001B[94m'; // Bright Blue - 统一颜色
}

const RESET_COLOR = '\u001B[0m';

onMounted(async () => {
  if (!terminalRef.value) return;

  // 创建终端实例
  terminal = new Terminal({
    fontSize: 14,
    fontFamily:
      '"SF Mono", Monaco, Menlo, "Roboto Mono", "Source Code Pro", "Courier New", monospace',
    fontWeight: '500',
    fontWeightBold: '700',
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10_000,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#aeafad',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5',
    },
  });

  // 添加插件
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());
  searchAddon = new SearchAddon();
  terminal.loadAddon(searchAddon);

  // 打开终端
  terminal.open(terminalRef.value);

  // 自适应大小
  fitAddon.fit();

  // 监听窗口大小变化
  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit();
  });
  resizeObserver.observe(terminalRef.value);

  // 监听滚动事件
  terminal.onScroll(() => {
    if (!terminal) return;
    const viewportY = terminal.buffer.active.viewportY;
    const baseY = terminal.buffer.active.baseY;
    if (viewportY === baseY) {
      autoScroll.value = true;
    }
  });

  // 监听鼠标滚轮向上滚动
  wheelHandler = (e: WheelEvent) => {
    if (e.deltaY < 0) {
      autoScroll.value = false;
    }
  };
  terminalRef.value.addEventListener('wheel', wheelHandler, { passive: true });

  // 清除 terminal 内容
  terminal.clear();
  totalLines.value = 0;

  // 加载缓存的历史日志
  const cachedLogs = wsStore.getCachedLogs(wsStore.currentBusinessLineId);
  if (cachedLogs && cachedLogs.length > 0) {
    hasOnlyWaitingMessage = false;
    cachedLogs.forEach((message) => {
      renderLogMessage(message);
    });
    if (autoScroll.value) {
      terminal.scrollToBottom();
    }
  } else {
    hasOnlyWaitingMessage = true;
    terminal.writeln(
      `\u001B[90m${$t(
        'deploy.packageDeployManagement.projectPackage.logViewer.waitingForData',
      )}\u001B[0m`,
    );
  }

  // 订阅 WebSocket 消息
  try {
    unsubscribe = await wsStore.subscribe(props.subscriptionId, handleMessage);
    isConnected.value = wsStore.isConnected();
  } catch (error) {
    console.error('订阅 WebSocket 消息失败:', error);
  }
});

// 组件卸载时清理资源
onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (wheelHandler && terminalRef.value) {
    terminalRef.value.removeEventListener('wheel', wheelHandler);
    wheelHandler = null;
  }

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
});

/**
 * 格式化时间戳
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * 格式化运行时间
 */
function formatRunningTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * 检查日志是否应该显示
 */
function shouldShowLog(data: any): boolean {
  // 检查级别过滤
  if (data.level && !levelFilters.value.includes(data.level as LogLevel)) {
    return false;
  }

  return true;
}

/**
 * 渲染结构化日志
 */
function renderStructuredLog(data: any) {
  if (!terminal) return;

  // 检查是否应该显示
  if (!shouldShowLog(data)) {
    return;
  }

  const parts: string[] = [];

  // 时间戳
  if (visibleFields.value.includes('timestamp') && data.timestamp) {
    parts.push(`\u001B[90m${formatTimestamp(data.timestamp)}\u001B[0m`);
  }

  // 级别（带颜色，居中对齐，显示中文）
  if (visibleFields.value.includes('level') && data.level) {
    const color = LEVEL_COLORS[data.level as LogLevel] || '';
    const chineseLevel = LEVEL_CHINESE[data.level as LogLevel] || data.level;
    // 所有中文级别都是2个字符，不需要填充
    parts.push(`${color}[${chineseLevel}]${RESET_COLOR}`);
  }

  // 来源（带颜色）
  if (visibleFields.value.includes('logFrom') && data.logFrom) {
    const color = getLogFromColor(data.logFrom);
    parts.push(`${color}[${data.logFrom}]${RESET_COLOR}`);
  }

  // 项目名称
  if (visibleFields.value.includes('logName') && data.logName) {
    parts.push(`\u001B[96m[${data.logName}]\u001B[0m`);
  }

  // 运行时间
  if (visibleFields.value.includes('runningTime') && data.runningTime) {
    parts.push(`\u001B[35m[${formatRunningTime(data.runningTime)}]\u001B[0m`);
  }

  // 消息内容（颜色与级别一致）
  if (visibleFields.value.includes('message') && data.message) {
    const color = LEVEL_COLORS[data.level as LogLevel] || '';
    // 确保 emoji 后面有空格（如果没有的话自动添加）
    const message = data.message.replace(
      /([\u{1F300}-\u{1F9FF}])([一-龥a-zA-Z])/gu,
      '$1 $2',
    );
    parts.push(`${color}${message}${RESET_COLOR}`);
  }

  // 拼接所有部分（用空格分隔）
  terminal.writeln(parts.join(' '));
  totalLines.value++;
}

/**
 * 渲染旧版日志（兼容）
 */
function renderLegacyLog(content: string) {
  if (!terminal) return;
  terminal.writeln(content);
  totalLines.value++;
}

/**
 * 渲染日志消息到终端
 */
function renderLogMessage(message: WebSocketMessage) {
  if (!terminal) return;

  // 处理系统消息
  if (message.commandType === 'system') {
    const systemMessage = message.data?.message || '';
    terminal.writeln(`\u001B[33m${systemMessage}\u001B[0m`);
    totalLines.value++;
    return;
  }

  if (message.commandType === 'log') {
    // taskType 过滤
    if (props.taskType !== undefined && message.commandId !== props.taskType) {
      return;
    }

    const data = message.data;
    if (!data) return;

    // 优先使用新的结构化日志格式
    if (data.timestamp && data.level && data.message) {
      renderStructuredLog(data);
    } else if (data.content) {
      // 兼容旧版本
      renderLegacyLog(data.content);
    }
  }
}

function handleMessage(message: WebSocketMessage) {
  if (!terminal) return;

  // 清除等待提示
  if (hasOnlyWaitingMessage) {
    terminal.clear();
    hasOnlyWaitingMessage = false;
    totalLines.value = 0;
  }

  // 渲染日志消息
  renderLogMessage(message);

  // 自动滚动
  if (autoScroll.value) {
    terminal.scrollToBottom();
  }
}

function handleClose() {
  emit('close');
}

function clearLog() {
  if (terminal) {
    terminal.clear();
    totalLines.value = 0;
    hasOnlyWaitingMessage = true;
    terminal.writeln(
      `\u001B[90m${$t(
        'deploy.packageDeployManagement.projectPackage.logViewer.waitingForData',
      )}\u001B[0m`,
    );
    wsStore.clearLogCache(wsStore.currentBusinessLineId);
  }
}

function toggleAutoScroll(checked: boolean | string | number) {
  autoScroll.value = !!checked;
  if (autoScroll.value && terminal) {
    terminal.scrollToBottom();
  }
}

function toggleSearch() {
  showSearch.value = !showSearch.value;
  if (showSearch.value) {
    nextTick(() => {
      // @ts-ignore - Ant Design Vue Input focus method
      searchInputRef.value?.focus();
    });
  } else {
    searchKeyword.value = '';
    searchResultCount.value = 0;
    currentSearchIndex.value = 0;
    if (searchAddon) {
      searchAddon.clearDecorations();
    }
  }
}

function toggleFilterPanel() {
  showFilterPanel.value = !showFilterPanel.value;
}

function handleSearch() {
  if (!searchAddon || !searchKeyword.value.trim()) {
    searchResultCount.value = 0;
    currentSearchIndex.value = 0;
    return;
  }

  const results = searchAddon.findNext(searchKeyword.value, {
    regex: false,
    wholeWord: false,
    caseSensitive: false,
  });

  currentSearchIndex.value = results ? currentSearchIndex.value + 1 : 0;
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      searchPrev();
    } else {
      searchNext();
    }
  } else if (event.key === 'Escape') {
    toggleSearch();
  }
}

function searchNext() {
  if (!searchAddon || !searchKeyword.value.trim()) return;
  searchAddon.findNext(searchKeyword.value, {
    regex: false,
    wholeWord: false,
    caseSensitive: false,
  });
}

function searchPrev() {
  if (!searchAddon || !searchKeyword.value.trim()) return;
  searchAddon.findPrevious(searchKeyword.value, {
    regex: false,
    wholeWord: false,
    caseSensitive: false,
  });
}

/**
 * 重新渲染所有日志（应用过滤器）
 */
function reRenderLogs() {
  if (!terminal) return;

  terminal.clear();
  totalLines.value = 0;

  const cachedLogs = wsStore.getCachedLogs(wsStore.currentBusinessLineId);
  if (cachedLogs && cachedLogs.length > 0) {
    cachedLogs.forEach((message) => {
      renderLogMessage(message);
    });
    if (autoScroll.value) {
      terminal.scrollToBottom();
    }
  }
}

// 监听搜索关键词变化
watch(searchKeyword, () => {
  if (searchKeyword.value.trim()) {
    handleSearch();
  } else {
    searchResultCount.value = 0;
    currentSearchIndex.value = 0;
    if (searchAddon) {
      searchAddon.clearDecorations();
    }
  }
});

// 监听过滤器变化，重新渲染
watch([levelFilters, visibleFields], reRenderLogs, {
  deep: true,
});
</script>

<template>
  <div class="log-viewer">
    <!-- 头部 -->
    <div class="log-viewer-header">
      <div class="log-viewer-header-left">
        <span class="log-viewer-title">{{ title }}</span>
        <div class="log-viewer-status">
          <span
            class="status-dot"
            :class="{ connected: isConnected, disconnected: !isConnected }"
          ></span>
          <span class="status-text">
            {{
              isConnected
                ? $t(
                    'deploy.packageDeployManagement.projectPackage.logViewer.connected',
                  )
                : $t(
                    'deploy.packageDeployManagement.projectPackage.logViewer.disconnected',
                  )
            }}
          </span>
        </div>
        <span class="log-viewer-lines">
          {{
            $t(
              'deploy.packageDeployManagement.projectPackage.logViewer.totalLines',
            )
          }}: {{ totalLines }}
        </span>
      </div>
      <div class="log-viewer-header-right">
        <!-- 日志级别过滤器 -->
        <div class="level-filter-inline">
          <Checkbox.Group
            v-model:value="levelFilters"
            :options="levelOptions"
          />
        </div>
        <Button size="small" @click="toggleFilterPanel">
          {{ showFilterPanel ? '隐藏过滤器' : '显示过滤器' }}
        </Button>
        <Button size="small" @click="toggleSearch">
          {{
            $t('deploy.packageDeployManagement.projectPackage.logViewer.search')
          }}
        </Button>
        <Button size="small" @click="clearLog">
          {{
            $t(
              'deploy.packageDeployManagement.projectPackage.logViewer.clearLog',
            )
          }}
        </Button>
        <div class="auto-scroll-switch">
          <span class="switch-label">{{
            $t(
              'deploy.packageDeployManagement.projectPackage.logViewer.autoScroll',
            )
          }}</span>
          <Switch
            v-model:checked="autoScroll"
            size="small"
            @change="toggleAutoScroll"
          />
        </div>
        <button class="log-viewer-close" @click="handleClose">×</button>
      </div>
    </div>

    <!-- 过滤面板 -->
    <div v-if="showFilterPanel" class="log-viewer-filter">
      <Space direction="vertical" style="width: 100%" :size="12">
        <div class="filter-row">
          <span class="filter-label">显示字段：</span>
          <Checkbox.Group
            v-model:value="visibleFields"
            :options="fieldOptions"
          />
        </div>
      </Space>
    </div>

    <!-- 搜索栏 -->
    <div v-if="showSearch" class="log-viewer-search">
      <Input
        ref="searchInputRef"
        v-model:value="searchKeyword"
        :placeholder="
          $t(
            'deploy.packageDeployManagement.projectPackage.logViewer.searchPlaceholder',
          )
        "
        class="search-input"
        @keydown="handleSearchKeydown"
      />
      <div class="search-actions">
        <Button
          size="small"
          :disabled="!searchKeyword.trim()"
          @click="searchPrev"
        >
          {{
            $t(
              'deploy.packageDeployManagement.projectPackage.logViewer.searchPrev',
            )
          }}
        </Button>
        <Button
          size="small"
          :disabled="!searchKeyword.trim()"
          @click="searchNext"
        >
          {{
            $t(
              'deploy.packageDeployManagement.projectPackage.logViewer.searchNext',
            )
          }}
        </Button>
        <Button size="small" @click="toggleSearch"> 关闭 </Button>
      </div>
    </div>

    <!-- 终端 -->
    <div ref="terminalRef" class="log-viewer-terminal"></div>
  </div>
</template>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #000000;
  border-radius: 4px;
}

.log-viewer-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3a3d41;
}

.log-viewer-header-left {
  display: flex;
  gap: 16px;
  align-items: center;
}

.log-viewer-title {
  font-size: 14px;
  font-weight: 500;
  color: #d4d4d4;
}

.log-viewer-status {
  display: flex;
  gap: 6px;
  align-items: center;
}

.status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.connected {
  background: #0dbc79;
  box-shadow: 0 0 4px rgb(13 188 121 / 50%);
}

.status-dot.disconnected {
  background: #cd3131;
}

.status-text {
  font-size: 12px;
  color: #d4d4d4;
}

.log-viewer-lines {
  font-size: 12px;
  color: #858585;
}

.log-viewer-header-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.level-filter-inline {
  display: flex;
  align-items: center;
}

.level-filter-inline :deep(.ant-checkbox-group) {
  display: flex;
  gap: 8px;
}

.level-filter-inline :deep(.ant-checkbox-wrapper) {
  margin: 0;
  font-size: 12px;
  color: #d4d4d4;
}

.level-filter-inline :deep(.ant-checkbox-wrapper span) {
  padding-right: 0;
  padding-left: 4px;
}

.auto-scroll-switch {
  display: flex;
  gap: 8px;
  align-items: center;
}

.switch-label {
  font-size: 12px;
  color: #d4d4d4;
}

.log-viewer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  font-size: 16px;
  color: #d4d4d4;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 4px;
  transition: color 0.2s;
}

.log-viewer-close:hover {
  color: #fff;
  background: rgb(255 255 255 / 10%);
}

.log-viewer-filter {
  flex-shrink: 0;
  padding: 12px 16px;
  background: #252526;
  border-bottom: 1px solid #3a3d41;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-label {
  flex-shrink: 0;
  min-width: 80px;
  font-size: 12px;
  color: #d4d4d4;
}

.log-viewer-search {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: #252526;
  border-bottom: 1px solid #3a3d41;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

.search-actions {
  display: flex;
  gap: 8px;
}

.log-viewer-terminal {
  position: relative;
  flex: 1;
  padding: 8px;
  overflow: hidden;
}

/* xterm.js 样式覆盖 */
:deep(.xterm) {
  height: 100%;
  line-height: 1.8; /* 增加行间距 */
  letter-spacing: 1px; /* 增加字间距，让 emoji 和文字不那么挤 */
  font-family: '0xProto Nerd Font Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
}

:deep(.xterm-viewport) {
  background: #000000 !important;
}

:deep(.xterm-screen) {
  background: #000000 !important;
}

/* Checkbox 样式适配暗色主题 */
:deep(.ant-checkbox-wrapper) {
  color: #d4d4d4;
}

:deep(.ant-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
