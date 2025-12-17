<script lang="ts" setup>
import type { NotificationItem } from './types';

import { nextTick, ref, watch } from 'vue';

import { Bell, MailCheck, RotateCw } from '@vben/icons';
import { $t } from '@vben/locales';

import {
  VbenButton,
  VbenIconButton,
  VbenPopover,
  VbenScrollbar,
} from '@vben-core/shadcn-ui';

import { useToggle } from '@vueuse/core';

interface Props {
  /**
   * 显示圆点
   */
  dot?: boolean;
  /**
   * 消息列表
   */
  notifications?: NotificationItem[];
}

defineOptions({ name: 'NotificationPopup' });

withDefaults(defineProps<Props>(), {
  dot: false,
  notifications: () => [],
});

const emit = defineEmits<{
  clear: [];
  makeAll: [];
  read: [NotificationItem];
  refresh: [];
  viewAll: [];
}>();

const [open, toggle] = useToggle();
const refreshing = ref(false);
const preventClose = ref(false);

// 监听弹窗打开，自动刷新
watch(open, (newValue) => {
  if (newValue) {
    handleRefresh();
  } else if (preventClose.value) {
    // 如果是点击通知项导致的关闭，立即重新打开
    preventClose.value = false;
    nextTick(() => {
      open.value = true;
    });
  }
});

function close() {
  open.value = false;
}

function handleViewAll() {
  emit('viewAll');
  // 不关闭弹窗，让用户可以继续查看通知
}

function handleMakeAll() {
  emit('makeAll');
}

function handleClear() {
  emit('clear');
}

async function handleRefresh() {
  refreshing.value = true;
  emit('refresh');
  // 给用户一个视觉反馈
  setTimeout(() => {
    refreshing.value = false;
  }, 500);
}

function handleClick(item: NotificationItem) {
  // 标记不要关闭 popover
  preventClose.value = true;
  emit('read', item);
}
</script>
<template>
  <VbenPopover
    v-model:open="open"
    content-class="relative right-2 w-[360px] p-0"
  >
    <template #trigger>
      <div class="flex-center mr-2 h-full" @click.stop="toggle()">
        <VbenIconButton class="bell-button text-foreground relative">
          <span
            v-if="dot"
            class="bg-primary absolute right-0.5 top-0.5 h-2 w-2 rounded"
          ></span>
          <Bell class="size-4" />
        </VbenIconButton>
      </div>
    </template>

    <div class="relative">
      <div class="flex items-center justify-between p-4 py-3">
        <div class="text-foreground">{{ $t('ui.widgets.notifications') }}</div>
        <div class="flex items-center gap-2">
          <VbenIconButton
            :class="{ 'animate-spin': refreshing }"
            :tooltip="$t('ui.widgets.refresh')"
            @click="handleRefresh"
          >
            <RotateCw class="size-4" />
          </VbenIconButton>
          <VbenIconButton
            :disabled="notifications.length <= 0"
            :tooltip="$t('ui.widgets.markAllAsRead')"
            @click="handleMakeAll"
          >
            <MailCheck class="size-4" />
          </VbenIconButton>
        </div>
      </div>
      <VbenScrollbar v-if="notifications.length > 0">
        <ul class="!flex max-h-[360px] w-full flex-col">
          <template v-for="item in notifications" :key="item.title">
            <li
              class="notification-item hover:bg-accent border-border relative flex w-full cursor-pointer items-start gap-5 border-t px-3 py-3"
              @click.stop="handleClick(item)"
            >
              <span
                v-if="!item.isRead"
                class="bg-primary absolute right-2 top-2 h-2 w-2 rounded"
              ></span>

              <div class="flex flex-col gap-1 leading-none">
                <p class="font-semibold">{{ item.title }}</p>
                <p class="text-muted-foreground my-1 line-clamp-2 text-xs">
                  {{ item.message }}
                </p>
                <p class="text-muted-foreground line-clamp-2 text-xs">
                  {{ item.date }}
                </p>
              </div>
            </li>
          </template>
        </ul>
      </VbenScrollbar>

      <template v-else>
        <div class="flex-center text-muted-foreground min-h-[150px] w-full">
          {{ $t('common.noData') }}
        </div>
      </template>

      <div
        class="border-border flex items-center justify-between border-t px-4 py-3"
      >
        <VbenButton
          :disabled="notifications.length <= 0"
          size="sm"
          variant="ghost"
          @click="handleClear"
        >
          {{ $t('ui.widgets.clearNotifications') }}
        </VbenButton>
        <VbenButton size="sm" @click="handleViewAll">
          {{ $t('ui.widgets.viewAll') }}
        </VbenButton>
      </div>
    </div>
  </VbenPopover>
</template>

<style scoped>
:deep(.bell-button) {
  &:hover {
    svg {
      animation: bell-ring 1s both;
    }
  }
}

@keyframes bell-ring {
  0%,
  100% {
    transform-origin: top;
  }

  15% {
    transform: rotateZ(10deg);
  }

  30% {
    transform: rotateZ(-10deg);
  }

  45% {
    transform: rotateZ(5deg);
  }

  60% {
    transform: rotateZ(-5deg);
  }

  75% {
    transform: rotateZ(2deg);
  }
}
</style>
