<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Button, Input, message, Spin, Tag, Alert } from 'ant-design-vue';
import { $t } from '#/locales';
import { MFAApi } from '#/api/mfa';

const loading = ref(false);
const statusLoading = ref(false);
const mfaEnabled = ref(false);
const hasKey = ref(false);

// 设置流程状态
const setupStep = ref<'idle' | 'scanning' | 'disabling'>('idle');
const qrCodeUrl = ref('');
const secretKey = ref('');
const verifyCode = ref('');
const verifyLoading = ref(false);

const fetchStatus = async () => {
  statusLoading.value = true;
  try {
    const res = await MFAApi.getStatus();
    mfaEnabled.value = res.enabled;
    hasKey.value = res.hasKey;
  } catch {
    // 静默处理
  } finally {
    statusLoading.value = false;
  }
};

const startSetup = async () => {
  loading.value = true;
  try {
    const res = await MFAApi.generateSecret();
    qrCodeUrl.value = res.qrCodeUrl;
    secretKey.value = res.secret;
    verifyCode.value = '';
    setupStep.value = 'scanning';
  } catch {
    message.error($t('system.mfa.generateFailed'));
  } finally {
    loading.value = false;
  }
};

const confirmEnable = async () => {
  if (!verifyCode.value || verifyCode.value.length !== 6) {
    message.warning($t('system.mfa.verifyCodeRequired'));
    return;
  }
  verifyLoading.value = true;
  try {
    await MFAApi.confirmEnable(verifyCode.value);
    message.success($t('system.mfa.enableSuccess'));
    setupStep.value = 'idle';
    verifyCode.value = '';
    await fetchStatus();
  } catch (e: any) {
    message.error(e?.message || $t('system.mfa.enableFailed'));
  } finally {
    verifyLoading.value = false;
  }
};

const startDisable = () => {
  verifyCode.value = '';
  setupStep.value = 'disabling';
};

const confirmDisable = async () => {
  if (!verifyCode.value || verifyCode.value.length !== 6) {
    message.warning($t('system.mfa.verifyCodeRequired'));
    return;
  }
  verifyLoading.value = true;
  try {
    await MFAApi.disable(verifyCode.value);
    message.success($t('system.mfa.disableSuccess'));
    setupStep.value = 'idle';
    verifyCode.value = '';
    await fetchStatus();
  } catch (e: any) {
    message.error(e?.message || $t('system.mfa.disableFailed'));
  } finally {
    verifyLoading.value = false;
  }
};

const cancelSetup = () => {
  setupStep.value = 'idle';
  verifyCode.value = '';
  qrCodeUrl.value = '';
  secretKey.value = '';
};

onMounted(() => {
  fetchStatus();
});
</script>

<template>
  <div class="mfa-settings">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium">{{ $t('system.mfa.status') }}：</span>
        <Spin v-if="statusLoading" size="small" />
        <Tag v-else :color="mfaEnabled ? 'success' : 'default'">
          {{ mfaEnabled ? $t('system.mfa.enabled') : $t('system.mfa.disabled') }}
        </Tag>
      </div>
    </div>

    <!-- 空闲状态 -->
    <template v-if="setupStep === 'idle'">
      <div v-if="!mfaEnabled">
        <Alert
          type="info"
          show-icon
          :message="$t('system.mfa.setupTitle')"
          :description="$t('system.mfa.setupDesc')"
          class="mb-4"
        />
        <div class="text-sm text-gray-500 mb-4 space-y-1">
          <div>{{ $t('system.mfa.step1') }}</div>
          <div>{{ $t('system.mfa.step2') }}</div>
          <div>{{ $t('system.mfa.step3') }}</div>
        </div>
        <Button type="primary" :loading="loading" @click="startSetup">
          {{ $t('system.mfa.enableMFA') }}
        </Button>
      </div>
      <div v-else>
        <Alert
          type="success"
          show-icon
          :message="$t('system.mfa.enabled')"
          :description="$t('system.mfa.setupDesc')"
          class="mb-4"
        />
        <Button danger @click="startDisable">
          {{ $t('system.mfa.disableMFA') }}
        </Button>
      </div>
    </template>

    <!-- 扫码绑定步骤 -->
    <template v-if="setupStep === 'scanning'">
      <div class="space-y-4">
        <div class="flex flex-col items-center gap-3">
          <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="MFA QR Code" class="w-48 h-48 border rounded" />
          <div class="text-sm text-gray-500">
            <span>{{ $t('system.mfa.secretKey') }}：</span>
            <code class="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs select-all">{{ secretKey }}</code>
          </div>
        </div>
        <div>
          <div class="text-sm mb-1">{{ $t('system.mfa.verifyCode') }}</div>
          <Input
            v-model:value="verifyCode"
            :placeholder="$t('system.mfa.verifyCodePlaceholder')"
            :maxlength="6"
            class="w-48"
            @press-enter="confirmEnable"
          />
        </div>
        <div class="flex gap-2">
          <Button type="primary" :loading="verifyLoading" @click="confirmEnable">
            {{ $t('system.mfa.enableMFA') }}
          </Button>
          <Button @click="cancelSetup">{{ $t('common.cancel') }}</Button>
          <Button type="link" :loading="loading" @click="startSetup">
            {{ $t('system.mfa.regenerate') }}
          </Button>
        </div>
      </div>
    </template>

    <!-- 禁用确认步骤 -->
    <template v-if="setupStep === 'disabling'">
      <div class="space-y-4">
        <Alert
          type="warning"
          show-icon
          :message="$t('system.mfa.disableConfirmTitle')"
          :description="$t('system.mfa.disableConfirmDesc')"
        />
        <div>
          <div class="text-sm mb-1">{{ $t('system.mfa.verifyCode') }}</div>
          <Input
            v-model:value="verifyCode"
            :placeholder="$t('system.mfa.verifyCodePlaceholder')"
            :maxlength="6"
            class="w-48"
            @press-enter="confirmDisable"
          />
        </div>
        <div class="flex gap-2">
          <Button danger :loading="verifyLoading" @click="confirmDisable">
            {{ $t('system.mfa.disableMFA') }}
          </Button>
          <Button @click="cancelSetup">{{ $t('common.cancel') }}</Button>
        </div>
      </div>
    </template>
  </div>
</template>
