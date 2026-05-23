<script lang="ts" setup>
import { ref } from 'vue';
import { Modal, Input, Button, message } from 'ant-design-vue';
import { $t } from '#/locales';
import { MFAApi } from '#/api/mfa';

// 验证弹窗状态
const verifyVisible = ref(false);
const verifyCode = ref('');
const verifyLoading = ref(false);
let resolveVerify: ((ok: boolean) => void) | null = null;

// 未配置MFA提醒弹窗
const notConfiguredVisible = ref(false);
let resolveNotConfigured: (() => void) | null = null;

// 打开个人设置的回调（由父组件注入）
const emit = defineEmits<{
  openSettings: [];
}>();

/**
 * 验证MFA，返回 true 表示验证通过，false 表示取消或失败
 * 如果用户未配置MFA，弹出提醒并返回 false
 */
const checkMFA = async (): Promise<boolean> => {
  // 先查询MFA状态
  let status: MFAApi.MFAStatusResult;
  try {
    status = await MFAApi.getStatus();
  } catch {
    // 查询失败时放行（避免因网络问题阻断操作）
    return true;
  }

  if (!status.enabled) {
    // 未配置MFA，弹出提醒
    return new Promise((resolve) => {
      resolveNotConfigured = () => resolve(false);
      notConfiguredVisible.value = true;
    });
  }

  // 已配置，弹出验证框
  verifyCode.value = '';
  return new Promise((resolve) => {
    resolveVerify = resolve;
    verifyVisible.value = true;
  });
};

const handleVerifyOk = async () => {
  if (!verifyCode.value || verifyCode.value.length !== 6) {
    message.warning($t('system.mfa.verifyCodeRequired'));
    return;
  }
  verifyLoading.value = true;
  try {
    await MFAApi.verify(verifyCode.value);
    verifyVisible.value = false;
    resolveVerify?.(true);
    resolveVerify = null;
  } catch (e: any) {
    message.error(e?.message || $t('system.mfa.verifyFailed'));
  } finally {
    verifyLoading.value = false;
  }
};

const handleVerifyCancel = () => {
  verifyVisible.value = false;
  resolveVerify?.(false);
  resolveVerify = null;
};

const handleNotConfiguredOk = () => {
  notConfiguredVisible.value = false;
  resolveNotConfigured?.();
  resolveNotConfigured = null;
  emit('openSettings');
};

const handleNotConfiguredCancel = () => {
  notConfiguredVisible.value = false;
  resolveNotConfigured?.();
  resolveNotConfigured = null;
};

defineExpose({ checkMFA });
</script>

<template>
  <!-- MFA验证弹窗 -->
  <Modal
    v-model:open="verifyVisible"
    :title="$t('system.mfa.verifyTitle')"
    :mask-closable="false"
    :keyboard="false"
    @cancel="handleVerifyCancel"
  >
    <div class="py-2">
      <p class="text-sm text-gray-500 mb-3">{{ $t('system.mfa.verifyDesc') }}</p>
      <Input
        v-model:value="verifyCode"
        :placeholder="$t('system.mfa.verifyCodePlaceholder')"
        :maxlength="6"
        size="large"
        class="text-center text-xl tracking-widest"
        @press-enter="handleVerifyOk"
      />
    </div>
    <template #footer>
      <Button @click="handleVerifyCancel">{{ $t('common.cancel') }}</Button>
      <Button type="primary" :loading="verifyLoading" @click="handleVerifyOk">
        {{ $t('common.confirm') }}
      </Button>
    </template>
  </Modal>

  <!-- 未配置MFA提醒弹窗 -->
  <Modal
    v-model:open="notConfiguredVisible"
    :title="$t('system.mfa.notConfigured')"
    :mask-closable="false"
    @cancel="handleNotConfiguredCancel"
  >
    <p class="text-sm text-gray-600 dark:text-gray-400">
      {{ $t('system.mfa.notConfiguredDesc') }}
    </p>
    <template #footer>
      <Button @click="handleNotConfiguredCancel">{{ $t('common.cancel') }}</Button>
      <Button type="primary" @click="handleNotConfiguredOk">
        {{ $t('system.mfa.goToSettings') }}
      </Button>
    </template>
  </Modal>
</template>
