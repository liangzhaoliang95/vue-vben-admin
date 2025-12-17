<script setup lang="ts">
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
import { Button, Input, Switch } from 'ant-design-vue';
import { Terminal } from 'xterm';

import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';

import 'xterm/css/xterm.css';

interface Props {
  subscriptionId: string;
  title?: string;
  taskType?: 1 | 2; // 1=构建日志, 2=部署日志
}

const props = withDefaults(defineProps<Props>(), {
  title: '实时日志',
  taskType: 1,
});

const emit = defineEmits<{
  close: [];
}>();

const terminalRef = ref<HTMLDivElement>();
const searchInputRef = ref<InstanceType<typeof Input>>();
let terminal: null | Terminal = null;
let fitAddon: FitAddon | null = null;
let searchAddon: null | SearchAddon = null;
let unsubscribe: (() => void) | null = null;
let hasOnlyWaitingMessage = true; // 标记是否只有等待提示
let resizeObserver: null | ResizeObserver = null; // 提升到组件作用域

// 状态
const isConnected = ref(false);
const totalLines = ref(0);
const autoScroll = ref(true);
const searchKeyword = ref('');
const showSearch = ref(false);
const searchResultCount = ref(0);
const currentSearchIndex = ref(0);

const wsStore = useWebSocketStore();

// 连接状态 - 直接使用 store 中的响应式状态
const connectionStatus = computed(() => wsStore.connectionStatus);

// 监听连接状态变化
watch(
  connectionStatus,
  (connected) => {
    isConnected.value = connected;
  },
  { immediate: true },
);

onMounted(async () => {
  if (!terminalRef.value) return;

  // 创建终端实例
  terminal = new Terminal({
    fontSize: 14,
    fontFamily: '"SF Mono", Monaco, Menlo, "Roboto Mono", "Source Code Pro", "Courier New", monospace',
    fontWeight: '500',
    fontWeightBold: '700',
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10_000, // 保留更多历史记录
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#aeafad',
      selection: '#3a3d41',
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

  // 监听滚动事件，更新自动滚动状态
  terminal.onScroll(() => {
    if (!terminal) return;
    const viewportY = terminal.buffer.active.viewportY;
    const baseY = terminal.buffer.active.baseY;
    // 如果用户手动滚动到底部，自动开启自动滚动
    autoScroll.value = viewportY === baseY;
  });

  // 清除 terminal 内容，确保从干净状态开始
  terminal.clear();
  totalLines.value = 0;

  // 加载缓存的历史日志
  const cachedLogs = wsStore.getCachedLogs(wsStore.currentBusinessLineId);
  if (cachedLogs && cachedLogs.length > 0) {
    hasOnlyWaitingMessage = false;
    cachedLogs.forEach((message) => {
      renderLogMessage(message);
    });
    // 自动滚动到底部
    if (autoScroll.value) {
      terminal.scrollToBottom();
    }
  } else {
    hasOnlyWaitingMessage = true;
    // 显示等待提示
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

// 组件卸载时清理资源（放在组件顶层，不要放在onMounted内部）
onBeforeUnmount(() => {
  // 清理 ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // 清理 WebSocket 订阅
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // 清理 Terminal
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
});

// 渲染日志消息到终端
function renderLogMessage(message: WebSocketMessage) {
  if (!terminal) return;

  // 优先处理系统消息（订阅信息等）- 不受 taskType 过滤影响
  if (message.commandType === 'system') {
    const systemMessage = message.data?.message || '';
    // 系统消息使用黄色显示
    terminal.writeln(`\u001B[33m${systemMessage}\u001B[0m`);
    totalLines.value++;
    return;
  }

  // 根据 taskType 过滤消息：只显示对应 commandId 的日志
  // taskType=1 时只显示 commandId=1 的消息（构建日志）
  // taskType=2 时只显示 commandId=2 的消息（部署日志）
  if (message.commandId !== props.taskType) {
    return;
  }

  if (message.commandType === 'log') {
    const content = message.data?.content || '';

    // 写入日志内容
    terminal.writeln(content);
    // 只统计 WebSocket 下发的实际日志行数（每收到一条日志消息，增加一行）
    totalLines.value++;
  } else if (message.commandType === 'event') {
    const eventType = message.commandId;
    const data = message.data || {};

    // 根据事件类型显示不同颜色
    if (eventType === 1 || eventType === 3) {
      // 成功事件（发布成功、构建成功）
      terminal.writeln(`\u001B[32m✓ ${data.status || '成功'}\u001B[0m`);
    } else if (eventType === 2 || eventType === 4) {
      // 失败事件（发布失败、构建失败）
      terminal.writeln(
        `\u001B[31m✗ ${data.status || '失败'}: ${data.error || ''}\u001B[0m`,
      );
    }
    // 事件消息也计入日志行数
    totalLines.value++;
  }
}

function handleMessage(message: WebSocketMessage) {
  if (!terminal) return;

  // 如果之前只有等待提示，清除它
  if (hasOnlyWaitingMessage) {
    terminal.clear();
    hasOnlyWaitingMessage = false;
    totalLines.value = 0; // 重置计数器
  }

  // 渲染日志消息
  renderLogMessage(message);

  // 自动滚动到底部
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
    // 重新显示等待提示
    terminal.writeln(
      `\u001B[90m${$t(
        'deploy.packageDeployManagement.projectPackage.logViewer.waitingForData',
      )}\u001B[0m`,
    );
    // 清除 WebSocket store 中的缓存
    wsStore.clearLogCache(wsStore.currentBusinessLineId);
  }
}

function toggleAutoScroll(checked: boolean) {
  autoScroll.value = checked;
  if (checked && terminal) {
    terminal.scrollToBottom();
  }
}

function toggleSearch() {
  showSearch.value = !showSearch.value;
  if (showSearch.value) {
    // 聚焦搜索输入框
    nextTick(() => {
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

function handleSearch() {
  if (!searchAddon || !searchKeyword.value.trim()) {
    searchResultCount.value = 0;
    currentSearchIndex.value = 0;
    return;
  }

  // 执行搜索
  const results = searchAddon.findNext(searchKeyword.value, {
    regex: false,
    wholeWord: false,
    caseSensitive: false,
  });

  // 统计搜索结果
  // 注意：xterm.js 的 SearchAddon 不直接提供总数，我们需要通过其他方式统计
  // 这里简化处理，只显示当前匹配
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
  background: #1e1e1e;
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
}

:deep(.xterm-viewport) {
  background: #1e1e1e !important;
}

:deep(.xterm-screen) {
  background: #1e1e1e !important;
}
</style>
