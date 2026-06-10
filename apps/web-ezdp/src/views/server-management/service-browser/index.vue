<script lang="ts" setup>
import type { ServerManagementApi } from '#/api/server-management';

import { onMounted, ref } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { Button, Card, Empty, message, Space, Tag } from 'ant-design-vue';

import { ServerManagementApi as ServerManagementApiService } from '#/api/server-management';
import MFAVerify from '#/components/mfa-verify/index.vue';
import VNCPreview from '#/components/vnc-preview/index.vue';
import { $t } from '#/locales';

const profileLoading = ref(false);
const profile = ref<null | ServerManagementApi.VNCProfile>(null);
const previewKey = ref(0);
const connected = ref(false);
const mfaVerifyRef = ref<InstanceType<typeof MFAVerify> | null>(null);

function buildWSURL() {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken || '';
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  let wsURL: string;

  if (apiURL.startsWith('http://') || apiURL.startsWith('https://')) {
    wsURL = apiURL.replace(/^http/, 'ws');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const path = apiURL.startsWith('/') ? apiURL : `/${apiURL}`;
    wsURL = `${protocol}//${host}${path}`;
  }

  if (wsURL.endsWith('/')) wsURL = wsURL.slice(0, -1);
  return `${wsURL}/webVNC/websockify?token=${encodeURIComponent(token)}`;
}

async function loadProfile() {
  profileLoading.value = true;
  connected.value = false;
  try {
    const ok = await mfaVerifyRef.value?.checkMFA();
    if (!ok) return;
    profile.value = await ServerManagementApiService.getVNCProfile();
    previewKey.value += 1;
  } finally {
    profileLoading.value = false;
  }
}

onMounted(async () => {
  await loadProfile();
});
</script>

<template>
  <div class="service-browser-page">
    <Card
      :title="$t('serverManagement.serviceBrowser.title')"
      :bordered="false"
    >
      <div class="service-browser-main">
        <template v-if="profile">
          <div class="toolbar">
            <Space wrap>
              <Button
                type="primary"
                :loading="profileLoading"
                @click="loadProfile"
              >
                {{ $t('serverManagement.serviceBrowser.reconnect') }}
              </Button>
              <Tag :color="connected ? 'green' : 'default'">
                {{
                  connected
                    ? $t('serverManagement.serviceBrowser.connected')
                    : $t('serverManagement.serviceBrowser.disconnected')
                }}
              </Tag>
            </Space>
          </div>

          <div v-if="!profile.enabled" class="browser-empty">
            <Empty
              :description="$t('serverManagement.serviceBrowser.notConfigured')"
            />
          </div>
          <div v-else class="browser-preview">
            <VNCPreview
              :connection-key="previewKey"
              :password="profile.password"
              :username="profile.username"
              :ws-url="buildWSURL()"
              @connected="connected = true"
              @disconnected="connected = false"
              @error="
                (msg) => {
                  connected = false;
                  message.error(
                    msg ||
                      $t('serverManagement.serviceBrowser.connectionError'),
                  );
                }
              "
            />
          </div>
        </template>

        <div v-else class="browser-empty">
          <Empty
            :description="$t('serverManagement.serviceBrowser.loadingProfile')"
          />
        </div>
      </div>
    </Card>

    <MFAVerify ref="mfaVerifyRef" />
  </div>
</template>

<style scoped>
.service-browser-page {
  height: calc(100vh - 160px);
  min-height: 640px;
}

.service-browser-page :deep(.ant-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.service-browser-page :deep(.ant-card-body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.service-browser-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.toolbar {
  flex: none;
  margin-bottom: 12px;
}

.browser-preview,
.browser-empty {
  flex: 1;
  min-width: 0;
  min-height: 520px;
  min-height: 0;
}

.browser-preview {
  height: 0;
  overflow: hidden;
}

.browser-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px dashed #d9d9d9;
  border-radius: 12px;
}
</style>
