<script lang="ts" setup>
import { computed } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Copy } from '@vben/icons';

import { Alert, Button, Input, message } from 'ant-design-vue';

import { $t } from '#/locales';
import { copyToClipboard } from '#/utils/clipboard';

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

const configExample = computed(() => {
  return $t('deploy.tools.buildAgent.configExample').replace('{token}', token.value);
});

async function handleCopy() {
  try {
    await copyToClipboard(token.value);
    message.success($t('common.copySuccess'));
  } catch (error) {
    console.error('复制失败:', error);
    message.error($t('common.copyFailed'));
  }
}

defineExpose({
  drawerApi,
});
</script>

<template>
  <Drawer :title="$t('deploy.tools.buildAgent.tokenTitle')">
    <div class="p-4">
    <Alert
      :description="$t('deploy.tools.buildAgent.tokenWarning')"
      :message="$t('deploy.tools.buildAgent.tokenAlertTitle')"
      show-icon
      type="warning"
      class="mb-4"
    />

    <div class="mb-4">
      <div class="mb-2 font-medium">
        {{ $t('deploy.tools.buildAgent.agentToken') }}
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
        {{ $t('deploy.tools.buildAgent.nextSteps') }}:
      </div>
      <ol class="ml-4 space-y-1 list-decimal">
        <li>{{ $t('deploy.tools.buildAgent.step1') }}</li>
        <li>{{ $t('deploy.tools.buildAgent.step2') }}</li>
        <li>{{ $t('deploy.tools.buildAgent.step3') }}</li>
      </ol>
    </div>

    <div class="mt-4 p-3 bg-gray-50 rounded">
      <div class="text-xs font-mono text-gray-700 whitespace-pre-wrap">{{ configExample }}</div>
    </div>
    </div>
  </Drawer>
</template>
