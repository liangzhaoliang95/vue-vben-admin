<script lang="ts" setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import RFB from '@novnc/novnc';

const props = withDefaults(
  defineProps<{
    connectionKey?: number | string;
    password?: string;
    username?: string;
    wsUrl: string;
  }>(),
  {
    password: '',
    username: '',
    connectionKey: '',
  },
);

const emit = defineEmits<{
  connected: [];
  disconnected: [reason?: string];
  error: [message: string];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const debugText = ref('等待连接');

let rfb: null | RFB = null;
let mountVersion = 0;

function updateDebug(message: string) {
  debugText.value = message;
}

function getCanvas() {
  return containerRef.value?.querySelector(
    'canvas',
  ) as HTMLCanvasElement | null;
}

function syncViewportLayout() {
  const container = containerRef.value;
  const screen = container?.firstElementChild as HTMLElement | null;
  const canvas = getCanvas();
  if (!container || !screen || !canvas) return;

  screen.style.width = '100%';
  screen.style.height = '100%';
  screen.style.display = 'flex';
  screen.style.alignItems = 'center';
  screen.style.justifyContent = 'center';
  screen.style.overflow = 'hidden';
  canvas.style.display = 'block';
  canvas.style.maxWidth = '100%';
  canvas.style.maxHeight = '100%';
}

function disconnect() {
  if (rfb) {
    try {
      rfb.disconnect();
    } catch {
      // noop
    }
    rfb = null;
  }
  if (containerRef.value) {
    containerRef.value.innerHTML = '';
  }
}

async function connect() {
  const currentVersion = ++mountVersion;
  disconnect();
  await nextTick();

  if (!containerRef.value || !props.wsUrl) return;

  updateDebug('正在建立 VNC 连接');

  try {
    const options =
      props.password || props.username
        ? {
            credentials: {
              password: props.password,
              username: props.username,
            },
          }
        : undefined;

    const instance = new RFB(containerRef.value, props.wsUrl, options);
    if (currentVersion !== mountVersion) {
      instance.disconnect();
      return;
    }

    rfb = instance;
    rfb.background = '#020617';
    rfb.scaleViewport = true;
    rfb.resizeSession = false;
    rfb.viewOnly = false;
    rfb.focusOnClick = true;
    rfb.clipViewport = false;
    rfb.qualityLevel = 6;
    rfb.compressionLevel = 2;
    rfb.showDotCursor = true;

    const bindLayout = () => {
      syncViewportLayout();
      requestAnimationFrame(() => {
        syncViewportLayout();
        rfb?.focus({ preventScroll: true });
      });
    };

    rfb.addEventListener('connect', () => {
      const canvas = getCanvas();
      const width = canvas?.width ?? 0;
      const height = canvas?.height ?? 0;
      bindLayout();
      updateDebug(
        `VNC 已连接${width > 0 && height > 0 ? `（${width}×${height}）` : ''}`,
      );
      emit('connected');
    });

    rfb.addEventListener('disconnect', (event: Event) => {
      const detail = (event as CustomEvent<{ clean?: boolean }>).detail;
      updateDebug(detail?.clean ? 'VNC 已断开' : 'VNC 连接异常断开');
      emit('disconnected', detail?.clean ? 'clean' : 'unclean');
    });

    rfb.addEventListener('credentialsrequired', () => {
      if (props.password || props.username) {
        updateDebug('服务端要求认证，正在发送凭据');
        rfb?.sendCredentials({
          password: props.password,
          username: props.username,
        });
      } else {
        updateDebug('服务端要求凭据，但当前未提供');
        emit('error', '缺少 VNC 凭据');
      }
    });

    rfb.addEventListener('securityfailure', (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      updateDebug(`VNC 安全校验失败：${detail?.reason || 'unknown'}`);
      emit('error', detail?.reason || 'VNC 安全校验失败');
    });

    rfb.addEventListener('desktopname', (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      updateDebug(
        detail?.name ? `已连接桌面：${detail.name}` : '已收到桌面信息',
      );
      bindLayout();
    });

    rfb.addEventListener('capabilities', bindLayout);
    rfb.addEventListener('clippingviewport', bindLayout);

    requestAnimationFrame(bindLayout);
    window.setTimeout(bindLayout, 120);
    window.setTimeout(bindLayout, 500);
  } catch (error: any) {
    updateDebug(error?.message || 'VNC 连接失败');
    emit('error', error?.message || 'VNC 连接失败');
  }
}

watch(
  () => [props.wsUrl, props.password, props.username, props.connectionKey],
  () => {
    void connect();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disconnect();
});
</script>

<template>
  <div class="vnc-preview-root">
    <div ref="containerRef" class="vnc-preview-container"></div>
    <div class="vnc-preview-debug">{{ debugText }}</div>
  </div>
</template>

<style scoped>
.vnc-preview-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
}

.vnc-preview-container {
  width: 100%;
  height: 100%;
  min-height: 420px;
  overflow: hidden;
  background: #020617;
  border-radius: 12px;
}

.vnc-preview-container :deep(div) {
  box-sizing: border-box;
}

.vnc-preview-container :deep(canvas) {
  display: block;
  max-width: 100%;
  max-height: 100%;
}

.vnc-preview-debug {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 2;
  max-width: calc(100% - 24px);
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.4;
  color: #e2e8f0;
  pointer-events: none;
  background: rgb(2 6 23 / 72%);
  border-radius: 6px;
}
</style>
