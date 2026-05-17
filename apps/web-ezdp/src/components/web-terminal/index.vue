<template>
  <div class="web-terminal-container">
    <div class="terminal-header">
      <div class="header-left">
        <span class="terminal-title">{{ title }}</span>
        <span v-if="connected" class="status-indicator connected"></span>
        <span v-else class="status-indicator disconnected"></span>
        <span class="status-text">{{ connected ? $t('terminal.connected') : $t('terminal.disconnected') }}</span>
      </div>
      <div class="header-right">
        <a-button size="small" @click="handleClear">{{ $t('terminal.clear') }}</a-button>
        <a-button size="small" @click="handleFullscreen">{{ $t('terminal.fullscreen') }}</a-button>
        <a-button size="small" danger @click="handleClose">{{ $t('terminal.close') }}</a-button>
      </div>
    </div>
    <div ref="terminalRef" class="terminal-content"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { message } from 'ant-design-vue';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';
import { $t } from '#/locales';
import 'xterm/css/xterm.css';

interface Props {
  serverId: string;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Web Terminal',
});

const emit = defineEmits<{
  close: [];
}>();

const terminalRef = ref<HTMLElement>();
const connected = ref(false);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let ws: WebSocket | null = null;
let sessionId: string | null = null;
let heartbeatTimer: number | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 初始化终端
const initTerminal = () => {
  if (!terminalRef.value) return;

  // 创建终端实例
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: '"JetBrainsMono Nerd Font", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
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
    scrollback: 10000,
    allowTransparency: false,
  });

  // 添加插件
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());
  terminal.loadAddon(new SearchAddon());

  // 打开终端
  terminal.open(terminalRef.value);
  fitAddon.fit();

  // 监听窗口大小变化
  const resizeObserver = new ResizeObserver(() => {
    if (fitAddon) {
      fitAddon.fit();
      // 发送窗口大小调整消息
      if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
        ws.send(JSON.stringify({
          type: 'resize',
          rows: terminal?.rows,
          cols: terminal?.cols,
        }));
      }
    }
  });
  resizeObserver.observe(terminalRef.value);

  // 监听用户输入
  terminal.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'data',
        data: data,
      }));
    }
  });

  // 显示欢迎消息
  terminal.writeln('\x1b[1;32mConnecting to server...\x1b[0m');
};

// 连接WebSocket
const connectWebSocket = () => {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken || '';
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

  // 转换 http/https -> ws/wss
  let wsURL: string;
  if (apiURL.startsWith('http://')) {
    wsURL = apiURL.replace('http://', 'ws://');
  } else if (apiURL.startsWith('https://')) {
    wsURL = apiURL.replace('https://', 'wss://');
  } else {
    // 相对路径处理
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const path = apiURL.startsWith('/') ? apiURL : `/${apiURL}`;
    wsURL = `${protocol}//${host}${path}`;
  }

  // 确保路径不以 / 结尾
  if (wsURL.endsWith('/')) {
    wsURL = wsURL.slice(0, -1);
  }

  const url = `${wsURL}/webTerminal/connect?serverId=${props.serverId}&token=${encodeURIComponent(token)}`;
  console.log('🔌 连接 WebSocket:', url);

  ws = new WebSocket(url);

  ws.onopen = () => {
    connected.value = true;
    reconnectAttempts = 0;
    terminal?.writeln('\x1b[1;32mConnected!\x1b[0m');
    terminal?.writeln('');

    // 创建PTY会话
    ws?.send(JSON.stringify({
      type: 'create',
      rows: terminal?.rows || 24,
      cols: terminal?.cols || 80,
      shell: '',  // 让服务端自动选择合适的 shell
    }));

    // 启动心跳检测（客户端主动发送 ping）
    startHeartbeat();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'created':
          sessionId = msg.data.sessionId;
          break;
        case 'data':
          terminal?.write(msg.data.data);
          break;
        case 'error':
          message.error(msg.data.message);
          terminal?.writeln(`\x1b[1;31mError: ${msg.data.message}\x1b[0m`);
          break;
        case 'closed':
          terminal?.writeln(`\x1b[1;33m\nSession closed: ${msg.data.reason}\x1b[0m`);
          connected.value = false;
          break;
        case 'pong':
          // 收到服务端的 pong 响应（可选）
          console.log('📡 收到 pong');
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    message.error($t('terminal.connectionError'));
    connected.value = false;
  };

  ws.onclose = (event) => {
    connected.value = false;
    stopHeartbeat();
    terminal?.writeln('\x1b[1;31m\nConnection closed\x1b[0m');

    // 非正常关闭且未超过重连次数，尝试重连
    if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      terminal?.writeln(`\x1b[1;33mReconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...\x1b[0m`);
      reconnectTimer = window.setTimeout(() => {
        connectWebSocket();
      }, 3000);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      terminal?.writeln('\x1b[1;31mMax reconnection attempts reached\x1b[0m');
    }
  };
};

// 启动心跳检测
const startHeartbeat = () => {
  stopHeartbeat();
  // 每 25 秒发送一次心跳（比服务端 30 秒间隔短）
  heartbeatTimer = window.setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ping',
      }));
      console.log('💓 发送心跳 ping');
    }
  }, 25000);
};

// 停止心跳检测
const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

// 清空终端
const handleClear = () => {
  terminal?.clear();
};

// 全屏
const handleFullscreen = () => {
  if (terminalRef.value) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      terminalRef.value.parentElement?.requestFullscreen();
    }
  }
};

// 关闭终端
const handleClose = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'close',
    }));
  }
  emit('close');
};

// 清理资源
const cleanup = () => {
  stopHeartbeat();
  if (ws) {
    ws.close();
    ws = null;
  }
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
  sessionId = null;
  reconnectAttempts = 0;
};

onMounted(() => {
  initTerminal();
  connectWebSocket();
});

onUnmounted(() => {
  cleanup();
});

// 监听serverId变化
watch(() => props.serverId, () => {
  cleanup();
  initTerminal();
  connectWebSocket();
});
</script>

<style scoped lang="less">
.web-terminal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-title {
  font-weight: 500;
  color: #d4d4d4;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.connected {
    background: #0dbc79;
  }

  &.disconnected {
    background: #cd3131;
  }
}

.status-text {
  font-size: 12px;
  color: #888;
}

.header-right {
  display: flex;
  gap: 8px;
}

.terminal-content {
  flex: 1;
  padding: 8px;
  overflow: hidden;
}

:deep(.xterm) {
  height: 100%;
}

:deep(.xterm-viewport) {
  overflow-y: auto;
}
</style>

<style>
@font-face {
  font-family: 'JetBrainsMono Nerd Font';
  src: url('/fonts/JetBrainsMonoNerdFont-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
</style>
