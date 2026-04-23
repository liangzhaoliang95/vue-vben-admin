<script lang="ts" setup>
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'NoPermission' });

const authStore = useAuthStore();

function handleRefresh() {
  window.location.reload();
}

async function handleBackToLogin() {
  await authStore.logout(false);
}
</script>

<template>
  <div class="flex h-full w-full flex-col items-center justify-center">
    <div class="bg-card text-center rounded-lg border p-12 shadow-sm">
      <!-- 图标 -->
      <div class="mb-6 flex justify-center">
        <div class="bg-warning/10 text-warning flex h-20 w-20 items-center justify-center rounded-full">
          <svg class="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>

      <!-- 标题 -->
      <h1 class="text-2xl font-bold mb-3">
        {{ $t('authentication.noPermissionTitle') }}
      </h1>

      <!-- 描述 -->
      <p class="text-muted-foreground mb-8 max-w-md">
        {{ $t('authentication.noPermissionDescription') }}
      </p>

      <!-- 操作按钮 -->
      <div class="flex gap-4 justify-center">
        <button
          class="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-6 py-2.5 text-sm font-medium"
          type="button"
          @click="handleRefresh"
        >
          {{ $t('authentication.refreshPage') }}
        </button>
        <button
          class="border-input bg-background hover:bg-accent hover:text-accent-foreground rounded border px-6 py-2.5 text-sm font-medium"
          type="button"
          @click="handleBackToLogin"
        >
          {{ $t('authentication.goToLogin') }}
        </button>
      </div>
    </div>
  </div>
</template>
