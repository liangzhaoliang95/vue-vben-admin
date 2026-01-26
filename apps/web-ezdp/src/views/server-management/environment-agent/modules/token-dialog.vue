<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, Button, message } from 'ant-design-vue';

import { $t } from '#/locales';
import { copyToClipboard } from '#/utils/clipboard';

defineOptions({
  name: 'TokenDialog',
});

const [Drawer, drawerApi] = useVbenDrawer({
  class: 'w-full md:w-3/5 lg:w-2/5',
  closeOnClickModal: true,
  closeOnPressEscape: true,
  connectedComponent: true,
  footer: false,
  title: $t('serverManagement.environmentAgent.tokenTitle'),
});

const token = computed(() => drawerApi.getData()?.token || '');

async function handleCopyToken() {
  try {
    await copyToClipboard(token.value);
    message.success($t('serverManagement.environmentAgent.copySuccess'));
  } catch {
    message.error($t('common.copyFailed'));
  }
}

defineExpose({
  drawerApi,
});
</script>

<template>
  <Drawer>
    <div class="space-y-4">
      <Alert
        :message="$t('serverManagement.environmentAgent.tokenAlertTitle')"
        :description="$t('serverManagement.environmentAgent.tokenWarning')"
        type="warning"
        show-icon
      />

      <div class="space-y-2">
        <div class="text-sm font-medium">
          {{ $t('serverManagement.environmentAgent.token') }}
        </div>
        <div class="flex items-center gap-2">
          <a-input
            :value="token"
            readonly
            class="font-mono"
          />
          <Button type="primary" @click="handleCopyToken">
            {{ $t('serverManagement.environmentAgent.copyToken') }}
          </Button>
        </div>
      </div>

      <div class="space-y-2">
        <div class="text-sm font-medium">
          {{ $t('serverManagement.environmentAgent.nextSteps') }}
        </div>
        <ol class="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>{{ $t('serverManagement.environmentAgent.step1') }}</li>
          <li>{{ $t('serverManagement.environmentAgent.step2') }}</li>
          <li>{{ $t('serverManagement.environmentAgent.step3') }}</li>
        </ol>
      </div>
    </div>
  </Drawer>
</template>
