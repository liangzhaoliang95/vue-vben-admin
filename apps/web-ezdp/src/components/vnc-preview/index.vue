<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Button, Modal, Textarea, Tooltip } from 'ant-design-vue';

import RFB from '@novnc/novnc';

import { $t } from '#/locales';

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
const isFullscreen = ref(false);
const clipboardModalVisible = ref(false);
const clipboardText = ref('');

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

// ========== 全屏功能 ==========
function toggleFullscreen() {
  const root = containerRef.value?.closest(
    '.vnc-preview-root',
  ) as HTMLElement | null;
  if (!root) return;

  if (!document.fullscreenElement) {
    root
      .requestFullscreen()
      .then(() => {
        isFullscreen.value = true;
        syncViewportLayout();
      })
      .catch(() => {
        // noop
      });
  } else {
    document
      .exitFullscreen()
      .then(() => {
        isFullscreen.value = false;
        syncViewportLayout();
      })
      .catch(() => {
        // noop
      });
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

// ========== 剪切板透传 ==========

/**
 * 将字符串编码为 UTF-8 字节数组
 */
function encodeUTF8(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

/**
 * 直接通过 VNC WebSocket 发送 ClientCutText 消息（msg-type 6）
 * 绕过 noVNC 的 extended clipboard "notify → wait for request" 机制
 *
 * VNC ClientCutText 协议格式：
 *   [1 byte]  msg-type = 6
 *   [3 bytes] padding = 0
 *   [4 bytes] text length (big-endian)
 *   [N bytes] text data (UTF-8)
 */
function sendClientCutTextRaw(text: string) {
  if (!rfb) return;

  const sock = (rfb as any)._sock;
  if (!sock) {
    console.error('[VNC] _sock not available');
    return;
  }

  const textBytes = encodeUTF8(text);

  // msg-type: 6 (ClientCutText)
  sock.sQpush8(6);
  // padding: 3 bytes of 0
  sock.sQpush8(0);
  sock.sQpush8(0);
  sock.sQpush8(0);
  // length: 4 bytes big-endian
  sock.sQpush32(textBytes.length);
  // text data
  sock.sQpushBytes(textBytes);
  sock.flush();

  console.log('[VNC] ClientCutText sent:', textBytes.length, 'bytes');
}

/**
 * 将文本发送到远程 VNC（同时使用两种方式确保送达）
 */
function pasteToVNC(text: string) {
  if (!rfb) {
    updateDebug('VNC 未连接，无法发送剪切板');
    return;
  }
  if (!text) return;

  try {
    // 方式1: 直接构造 VNC ClientCutText 消息发送（绕过 extended clipboard）
    sendClientCutTextRaw(text);

    // 方式2: 同时也调用 clipboardPasteFrom（兼容走非 extended clipboard 的场景）
    rfb.clipboardPasteFrom(text);

    updateDebug(
      `${$t('serverManagement.serviceBrowser.clipboardSynced')}（${text.length} 字符）`,
    );
  } catch (err) {
    console.error('[VNC] pasteToVNC error:', err);
    updateDebug(`剪切板发送失败: ${err}`);
  }
}

/**
 * VNC → 宿主机：监听 VNC 服务端的剪切板事件
 */
function onClipboardEvent(event: Event) {
  const detail = (event as CustomEvent<{ text?: string }>).detail;
  if (detail?.text) {
    try {
      navigator.clipboard.writeText(detail.text);
    } catch {
      // noop
    }
  }
}

/**
 * 打开剪切板输入弹窗
 */
function openClipboardModal() {
  if (!rfb) {
    updateDebug('VNC 未连接');
    return;
  }
  clipboardText.value = '';
  clipboardModalVisible.value = true;
}

/**
 * 确认发送剪切板内容到 VNC
 */
function confirmClipboardSend() {
  const text = clipboardText.value;
  clipboardModalVisible.value = false;
  clipboardText.value = '';

  if (text) {
    nextTick(() => {
      pasteToVNC(text);
      setTimeout(() => {
        rfb?.focus({ preventScroll: true });
      }, 100);
    });
  } else {
    rfb?.focus({ preventScroll: true });
  }
}

/**
 * 弹窗取消
 */
function cancelClipboardModal() {
  clipboardModalVisible.value = false;
  clipboardText.value = '';
  rfb?.focus({ preventScroll: true });
}

/**
 * 弹窗打开后自动聚焦 textarea
 */
function onModalOpen() {
  nextTick(() => {
    const textarea = document.querySelector(
      '.vnc-clipboard-textarea textarea',
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.focus();
    }
  });
}

// ========== 连接管理 ==========

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

    // 监听 VNC 服务端的剪切板事件（VNC → 宿主机）
    rfb.addEventListener('clipboard', onClipboardEvent);

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

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);
});

onBeforeUnmount(() => {
  disconnect();
  document.removeEventListener('fullscreenchange', onFullscreenChange);
});
</script>

<template>
  <div class="vnc-preview-root">
    <div ref="containerRef" class="vnc-preview-container"></div>

    <!-- 右上角工具栏 -->
    <div class="vnc-toolbar">
      <Tooltip :title="$t('serverManagement.serviceBrowser.pasteClipboard')">
        <Button
          class="vnc-toolbar-btn"
          type="text"
          size="small"
          @click="openClipboardModal"
        >
          <template #icon>
            <span class="vnc-toolbar-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
                />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </span>
          </template>
        </Button>
      </Tooltip>
      <Tooltip
        :title="
          isFullscreen
            ? $t('serverManagement.serviceBrowser.exitFullscreen')
            : $t('serverManagement.serviceBrowser.fullscreen')
        "
      >
        <Button
          class="vnc-toolbar-btn"
          type="text"
          size="small"
          @click="toggleFullscreen"
        >
          <template #icon>
            <span class="vnc-toolbar-icon">
              <svg
                v-if="!isFullscreen"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            </span>
          </template>
        </Button>
      </Tooltip>
    </div>

    <div class="vnc-preview-debug">{{ debugText }}</div>

    <!-- 剪切板输入弹窗 -->
    <Modal
      v-model:open="clipboardModalVisible"
      :title="$t('serverManagement.serviceBrowser.pasteClipboard')"
      :ok-text="$t('serverManagement.serviceBrowser.sendToRemote')"
      :cancel-text="$t('serverManagement.serviceBrowser.cancel')"
      @ok="confirmClipboardSend"
      @cancel="cancelClipboardModal"
      @after-open-change="onModalOpen"
    >
      <p class="vnc-clipboard-hint">
        {{ $t('serverManagement.serviceBrowser.clipboardHint') }}
      </p>
      <Textarea
        v-model:value="clipboardText"
        class="vnc-clipboard-textarea"
        :rows="6"
        :placeholder="
          $t('serverManagement.serviceBrowser.clipboardPlaceholder')
        "
        @keydown.ctrl.enter="confirmClipboardSend"
        @keydown.meta.enter="confirmClipboardSend"
      />
    </Modal>
  </div>
</template>

<style scoped>
.vnc-preview-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  background: #020617;
  border-radius: 12px;
}

.vnc-preview-root:fullscreen {
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vnc-preview-root:fullscreen .vnc-preview-container {
  border-radius: 0;
  width: 100%;
  height: 100%;
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

/* 右上角工具栏 */
.vnc-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px;
  background: rgb(0 0 0 / 45%);
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.vnc-preview-root:hover .vnc-toolbar {
  opacity: 1;
}

.vnc-toolbar-btn {
  color: rgb(255 255 255 / 85%) !important;
}

.vnc-toolbar-btn:hover {
  color: #fff !important;
  background: rgb(255 255 255 / 15%) !important;
}

.vnc-toolbar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 全屏状态下工具栏常驻 */
.vnc-preview-root:fullscreen .vnc-toolbar {
  opacity: 1;
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

/* 剪切板弹窗样式 */
.vnc-clipboard-hint {
  margin-bottom: 12px;
  font-size: 13px;
  color: rgb(0 0 0 / 45%);
}

.vnc-clipboard-textarea {
  font-family: monospace;
}
</style>
