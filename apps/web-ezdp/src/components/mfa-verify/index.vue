<script lang="ts" setup>
import { ref, watch } from 'vue';
import { Modal, Input, Button, message } from 'ant-design-vue';
import { $t } from '#/locales';
import { MFAApi } from '#/api/mfa';

const props = defineProps<{
  // 由外部 store 驱动直接弹出验证框（全局拦截器模式）
  forceVisible?: boolean;
}>();

const emit = defineEmits<{
  openSettings: [];
  verifySuccess: [];
  verifyCancel: [];
}>();

// 验证弹窗状态
const verifyVisible = ref(false);
const verifyCode = ref('');
const verifyLoading = ref(false);
let resolveVerify: ((ok: boolean) => void) | null = null;

// 未配置MFA提醒弹窗
const notConfiguredVisible = ref(false);
let resolveNotConfigured: (() => void) | null = null;

// 监听外部强制显示（全局拦截器触发）
watch(
  () => props.forceVisible,
  (val) => {
    if (val) {
      verifyCode.value = '';
      verifyVisible.value = true;
    }
  },
);

/**
 * 验证MFA，返回 true 表示验证通过，false 表示取消或失败
 * 如果用户未配置MFA，弹出提醒并返回 false
 */
const checkMFA = async (): Promise<boolean> => {
  let status: MFAApi.MFAStatusResult;
  try {
    status = await MFAApi.getStatus();
  } catch {
    return true;
  }

  if (!status.enabled) {
    return new Promise((resolve) => {
      resolveNotConfigured = () => resolve(false);
      notConfiguredVisible.value = true;
    });
  }

  // 30分钟内已验证过，直接放行
  if (status.verified) {
    return true;
  }

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
    // 主动模式：resolve Promise
    resolveVerify?.(true);
    resolveVerify = null;
    // 被动模式：emit 事件通知 store
    emit('verifySuccess');
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
  emit('verifyCancel');
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
