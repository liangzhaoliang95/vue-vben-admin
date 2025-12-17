<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, onMounted, ref, watch } from 'vue';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useBusinessStore, useUserStore } from '@vben/stores';

import { Button, Modal } from 'ant-design-vue';
import { marked } from 'marked';

import {
  clearReadNotifications,
  getNotificationList,
  markAllAsRead,
  markAsRead,
} from '#/api/core/notification';
import LogViewer from '#/components/log-viewer/index.vue';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { useWebSocketStore } from '#/store/websocket';
import LoginForm from '#/views/_core/authentication/login.vue';

const notifications = ref<NotificationItem[]>([]);

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const businessStore = useBusinessStore();
const wsStore = useWebSocketStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);

// 通知详情弹窗
const showNotificationDetail = ref(false);
const currentNotification = ref<NotificationItem | null>(null);

// 渲染通知内容（支持 Markdown）
const notificationContent = computed(() => {
  if (!currentNotification.value) return '';
  const content = currentNotification.value.message || '';

  try {
    // 尝试渲染为 Markdown
    return marked(content);
  } catch {
    // 如果解析失败，返回纯文本
    return content;
  }
});

// 实时日志相关 - 已移至 store 统一管理

const menus = computed(() => [
  // 隐藏文档、GitHub、问题&帮助
  // {
  //   handler: () => {
  //     openWindow(VBEN_DOC_URL, {
  //       target: '_blank',
  //     });
  //   },
  //   icon: BookOpenText,
  //   text: $t('ui.widgets.document'),
  // },
  // {
  //   handler: () => {
  //     openWindow(VBEN_GITHUB_URL, {
  //       target: '_blank',
  //     });
  //   },
  //   icon: SvgGithubIcon,
  //   text: 'GitHub',
  // },
  // {
  //   handler: () => {
  //     openWindow(`${VBEN_GITHUB_URL}/issues`, {
  //       target: '_blank',
  //     });
  //   },
  //   icon: CircleHelp,
  //   text: $t('ui.widgets.qa'),
  // },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

// 加载通知列表
async function loadNotifications() {
  try {
    const res = await getNotificationList({
      pageIndex: 1,
      pageSize: 20,
    });

    // 转换为 NotificationItem 格式（保留 id 用于标记已读）
    notifications.value = res.items.map((item) => ({
      id: item.id,
      date: formatTime(item.createdAt),
      isRead: item.isRead,
      message: item.content,
      title: item.title,
    } as any));
  } catch (error) {
    console.error('加载通知失败:', error);
  }
}

// 格式化时间为相对时间
function formatTime(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

// 清空通知
async function handleNoticeClear() {
  try {
    const businessLineId = businessStore.currentBusinessLineId;
    await clearReadNotifications(businessLineId);
    // 重新加载通知列表
    await loadNotifications();
  } catch (error) {
    console.error('清空通知失败:', error);
  }
}

// 全部标记为已读
async function handleMakeAll() {
  try {
    const businessLineId = businessStore.currentBusinessLineId;
    await markAllAsRead(businessLineId);
    // 重新加载通知列表
    await loadNotifications();
  } catch (error) {
    console.error('标记已读失败:', error);
  }
}

// 查看所有通知（跳转到通知中心）
function handleViewAll() {
  // TODO: 如果有通知中心页面，在这里跳转
  console.log('跳转到通知中心');
}

// 点击通知，查看详情
async function handleNotificationRead(item: NotificationItem) {
  currentNotification.value = item;
  showNotificationDetail.value = true;

  // 标记为已读（如果尚未已读）
  if (!item.isRead && (item as any).id) {
    try {
      await markAsRead({ id: (item as any).id });
      // 更新本地状态
      const notification = notifications.value.find(
        (n) => (n as any).id === (item as any).id,
      );
      if (notification) {
        notification.isRead = true;
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  }
}

// 关闭通知详情弹窗
function closeNotificationDetail() {
  showNotificationDetail.value = false;
  currentNotification.value = null;
}

// 打开实时日志（顶部按钮）
async function openLogViewer() {
  // 获取当前业务线 ID
  const businessLineId = businessStore.currentBusinessLineId;
  if (!businessLineId) {
    console.warn('未选择业务线');
    return;
  }

  // 先订阅业务线日志
  await wsStore.subscribeBusinessLine(businessLineId);

  // 打开日志查看器（默认显示构建日志）
  wsStore.openGlobalLogViewer(1);
}

// 关闭实时日志
function closeLogViewer() {
  wsStore.closeGlobalLogViewer();
}

// 组件挂载时加载通知并订阅业务线日志
onMounted(async () => {
  loadNotifications();

  // 订阅当前业务线的 WebSocket 日志
  const businessLineId = businessStore.currentBusinessLineId;
  if (businessLineId) {
    await wsStore.subscribeBusinessLine(businessLineId);
  }
});

// 监听业务线切换，自动重新订阅
watch(
  () => businessStore.currentBusinessLineId,
  async (newBusinessLineId) => {
    if (newBusinessLineId) {
      await wsStore.subscribeBusinessLine(newBusinessLineId);
    }
  },
);

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
  }),
  async ({ enable, content }) => {
    if (enable) {
      await updateWatermark({
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <!-- 实时日志按钮 - 放在搜索框左边 (index=45 < REFERENCE_VALUE=50) -->
    <template #header-right-45>
      <Button type="primary" class="realtime-log-btn mr-6" @click="openLogViewer">
        📊 {{ $t('deploy.packageDeployManagement.projectPackage.realtimeLog') }}
      </Button>
    </template>

    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        description=""
        tag-text="VVVVIP"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @make-all="handleMakeAll"
        @read="handleNotificationRead"
        @refresh="loadNotifications"
        @view-all="handleViewAll"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>

      <!-- 通知详情弹窗 -->
      <Modal
        v-model:open="showNotificationDetail"
        :title="currentNotification?.title || '通知详情'"
        :width="800"
        :footer="null"
        @cancel="closeNotificationDetail"
      >
        <div class="notification-detail-content">
          <!-- Markdown 内容渲染 -->
          <div
            v-if="notificationContent"
            class="markdown-body"
            v-html="notificationContent"
          ></div>
          <!-- 通知元信息 -->
          <div class="notification-meta">
            <span class="notification-time">{{ currentNotification?.date }}</span>
          </div>
        </div>
      </Modal>

      <!-- 实时日志悬浮窗 -->
      <Teleport to="body">
        <div v-if="wsStore.showGlobalLogViewer" class="log-viewer-overlay">
          <div class="log-viewer-container">
            <LogViewer
              v-if="wsStore.globalLogViewerSubscriptionId"
              :subscription-id="wsStore.globalLogViewerSubscriptionId"
              :title="wsStore.globalLogViewerTitle"
              :task-type="wsStore.globalLogViewerTaskType"
              @close="closeLogViewer"
            />
          </div>
        </div>
      </Teleport>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>

<style scoped>
/* 实时日志按钮 - 简洁样式 */
.realtime-log-btn {
  font-weight: 500;
}

.log-viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--overlay));
}

.log-viewer-container {
  width: 90%;
  max-width: 1200px;
  height: 80%;
  max-height: 800px;
  overflow: hidden;
  background: hsl(var(--background-deep));
  border-radius: var(--radius);
  box-shadow: 0 4px 20px hsl(0deg 0% 0% / 30%);
}

/* 通知详情内容样式 */
.notification-detail-content {
  padding: 16px 0;
}

.notification-meta {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 14px;
}

.notification-time {
  display: inline-block;
}

/* Markdown 样式 */
.markdown-body {
  line-height: 1.8;
  color: hsl(var(--foreground));
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body h1 {
  font-size: 2em;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.3em;
}

.markdown-body h2 {
  font-size: 1.5em;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.3em;
}

.markdown-body h3 {
  font-size: 1.25em;
}

.markdown-body p {
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body a {
  color: hsl(var(--primary));
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body li {
  margin-bottom: 4px;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: hsl(var(--muted));
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
    'Liberation Mono', monospace;
}

.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: hsl(var(--muted));
  border-radius: 6px;
  margin-bottom: 16px;
}

.markdown-body pre code {
  display: inline;
  padding: 0;
  margin: 0;
  overflow: visible;
  line-height: inherit;
  word-wrap: normal;
  background-color: transparent;
  border: 0;
}

.markdown-body blockquote {
  padding: 0 1em;
  color: hsl(var(--muted-foreground));
  border-left: 0.25em solid hsl(var(--border));
  margin: 0 0 16px 0;
}

.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.markdown-body table th,
.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid hsl(var(--border));
}

.markdown-body table th {
  font-weight: 600;
  background-color: hsl(var(--muted));
}

.markdown-body img {
  max-width: 100%;
  height: auto;
  margin: 16px 0;
}

.markdown-body hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: hsl(var(--border));
  border: 0;
}
</style>
