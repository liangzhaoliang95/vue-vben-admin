<script lang="ts" setup>
import { computed } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Copy } from '@vben/icons';

import { Alert, Button, Input, message } from 'ant-design-vue';

import { $t } from '#/locales';

defineOptions({
  name: 'TokenDialog',
});

const [Drawer, drawerApi] = useVbenDrawer({
  footer: false,
});

const token = computed(() => {
  const data = drawerApi.getData<{ token: string }>();
  return data?.token || '';
});

function handleCopy() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(token.value).then(() => {
      message.success($t('common.copySuccess'));
    });
  } else {
    // Fallback for browsers that don't support clipboard API
    const textarea = document.createElement('textarea');
    textarea.value = token.value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    message.success($t('common.copySuccess'));
  }
}

defineExpose({
  drawerApi,
});
</script>

<template>
  <Drawer :title="$t('deploy.tools.deployAgent.tokenTitle')">
    <div class="p-4">
      <Alert
        :description="$t('deploy.tools.deployAgent.tokenWarning')"
        :message="$t('deploy.tools.deployAgent.tokenAlertTitle')"
        show-icon
        type="warning"
        class="mb-4"
      />

      <div class="mb-4">
        <div class="mb-2 font-medium">
          {{ $t('deploy.tools.deployAgent.agentToken') }}
        </div>
        <Input.TextArea
          :value="token"
          :auto-size="{ minRows: 3, maxRows: 5 }"
          readonly
          class="font-mono text-sm"
        />
      </div>

      <div class="flex justify-end">
        <Button type="primary" @click="handleCopy">
          <template #icon>
            <Copy class="size-4" />
          </template>
          {{ $t('common.copy') }}
        </Button>
      </div>

      <div class="mt-4 space-y-2 text-sm text-gray-600">
        <div class="font-medium">
          {{ $t('deploy.tools.deployAgent.nextSteps') }}:
        </div>
        <ol class="ml-4 space-y-1 list-decimal">
          <li>{{ $t('deploy.tools.deployAgent.step1') }}</li>
          <li>{{ $t('deploy.tools.deployAgent.step2') }}</li>
          <li>{{ $t('deploy.tools.deployAgent.step3') }}</li>
        </ol>
      </div>
    </div>
  </Drawer>
</template>
