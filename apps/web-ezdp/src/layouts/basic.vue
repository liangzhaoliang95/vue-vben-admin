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

import { Button } from 'ant-design-vue';

import {
  clearReadNotifications,
  getNotificationList,
  markAllAsRead,
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

// 实时日志相关
const showLogViewer = ref(false);
const logViewerSubscriptionId = ref<string>('');
const logViewerTitle = ref('');
const logViewerTaskType = ref<1 | 2>(1); // 当前日志类型: 1=构建, 2=部署

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

    // 转换为 NotificationItem 格式
    notifications.value = res.items.map((item) => ({
      date: formatTime(item.createdAt),
      isRead: item.isRead,
      message: item.content,
      title: item.title,
    }));
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
    await clearReadNotifications();
    notifications.value = [];
  } catch (error) {
    console.error('清空通知失败:', error);
  }
}

// 全部标记为已读
async function handleMakeAll() {
  try {
    await markAllAsRead();
    notifications.value.forEach((item) => (item.isRead = true));
  } catch (error) {
    console.error('标记已读失败:', error);
  }
}

// 查看所有通知（跳转到通知中心）
function handleViewAll() {
  // TODO: 如果有通知中心页面，在这里跳转
  console.log('跳转到通知中心');
}

// 打开实时日志
async function openLogViewer() {
  // 获取当前业务线 ID
  const businessLineId = businessStore.currentBusinessLineId;
  if (!businessLineId) {
    console.warn('未选择业务线');
    return;
  }

  // 先订阅业务线日志（这会生成订阅信息消息并缓存）
  await wsStore.subscribeBusinessLine(businessLineId);

  // 设置订阅 ID 为业务线 ID
  logViewerSubscriptionId.value = String(businessLineId);
  logViewerTitle.value = $t(
    'deploy.packageDeployManagement.projectPackage.realtimeLog',
  );
  // 默认显示构建日志，可以根据需要调整
  logViewerTaskType.value = 1;

  // 打开日志查看器
  showLogViewer.value = true;
}

// 关闭实时日志
function closeLogViewer() {
  showLogViewer.value = false;
  // 可选：清空订阅 ID
  // logViewerSubscriptionId.value = '';
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

      <!-- 实时日志悬浮窗 -->
      <Teleport to="body">
        <div v-if="showLogViewer" class="log-viewer-overlay">
          <div class="log-viewer-container">
            <LogViewer
              v-if="logViewerSubscriptionId"
              :subscription-id="logViewerSubscriptionId"
              :title="logViewerTitle"
              :task-type="logViewerTaskType"
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
</style>
