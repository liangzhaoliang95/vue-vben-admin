<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Card, Empty, message, Space, Button, Tag } from 'ant-design-vue';
import { useAccessStore } from '@vben/stores';

import MFAVerify from '#/components/mfa-verify/index.vue';
import { $t } from '#/locales';

const loading = ref(false);
const iframeUrl = ref('');
const mfaVerifyRef = ref<InstanceType<typeof MFAVerify> | null>(null);
const connected = ref(false);

function buildDBXURL() {
  // 构建DBX代理地址
  // 前端通过代理API访问DBX
  const protocol = window.location.protocol;
  const host = window.location.host;
  const path = '/server/ezdp/dbx/';
  // iframe 无法自动携带 Authorization 头，通过 query 参数传递 token，
  // 后端 tokenChecker 中间件已支持从 ?token= 读取（用于 WebSocket/iframe 场景）
  const token = useAccessStore().accessToken || '';
  return `${protocol}//${host}${path}?token=${encodeURIComponent(token)}`;
}

async function loadDatabase() {
  loading.value = true;
  connected.value = false;
  try {
    const ok = await mfaVerifyRef.value?.checkMFA();
    if (!ok) {
      return;
    }

    // 构建iframe URL
    iframeUrl.value = buildDBXURL();
    connected.value = true;
    message.success($t('serverManagement.databaseManagement.loadSuccess'));
  } catch (error) {
    message.error($t('serverManagement.databaseManagement.loadError'));
    console.error('Failed to load database management:', error);
  } finally {
    loading.value = false;
  }
}

function refreshDatabase() {
  if (iframeUrl.value) {
    // 刷新iframe
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.src = iframeUrl.value;
    }
  }
}

onMounted(async () => {
  await loadDatabase();
});
</script>

<template>
  <div class="database-management-page">
    <Card
      :title="$t('serverManagement.databaseManagement.title')"
      :bordered="false"
    >
      <div class="database-management-main">
        <template v-if="iframeUrl">
          <div class="toolbar">
            <Space wrap>
              <Button
                type="primary"
                :loading="loading"
                @click="refreshDatabase"
              >
                {{ $t('serverManagement.databaseManagement.refresh') }}
              </Button>
              <Tag :color="connected ? 'green' : 'default'">
                {{
                  connected
                    ? $t('serverManagement.databaseManagement.connected')
                    : $t('serverManagement.databaseManagement.disconnected')
                }}
              </Tag>
            </Space>
          </div>

          <div class="database-preview">
            <iframe
              :src="iframeUrl"
              frameborder="0"
              class="database-iframe"
              @load="() => (connected = true)"
              @error="
                () =>
                  message.error(
                    $t('serverManagement.databaseManagement.loadError'),
                  )
              "
            />
          </div>
        </template>

        <div v-else class="database-empty">
          <Empty
            :description="$t('serverManagement.databaseManagement.loading')"
          />
        </div>
      </div>
    </Card>

    <MFAVerify ref="mfaVerifyRef" />
  </div>
</template>

<style scoped>
.database-management-page {
  height: calc(100vh - 160px);
  min-height: 640px;
}

.database-management-page :deep(.ant-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.database-management-page :deep(.ant-card-body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.database-management-main {
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

.database-preview,
.database-empty {
  flex: 1;
  min-width: 0;
  min-height: 520px;
}

.database-preview {
  overflow: hidden;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

.database-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.database-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px dashed #d9d9d9;
  border-radius: 12px;
}
</style>
