<script lang="ts" setup>
import type { SystemStatusApi } from '#/api/system/system-status';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  message,
} from 'ant-design-vue';

import { checkDependencies, getSystemStatus } from '#/api/system/system-status';
import { $t } from '#/locales';
import { formatDateTime } from '@vben/utils';
import { ref, onMounted, computed } from 'vue';

const loading = ref(false);
const checking = ref(false);
const dependencies = ref<Record<string, SystemStatusApi.BinaryDependency>>({});
const lastCheckAt = ref<number>(0);

// 加载系统状态
async function loadSystemStatus() {
  loading.value = true;
  try {
    const res = await getSystemStatus();
    dependencies.value = res.dependencies || {};
    lastCheckAt.value = res.lastCheckAt || 0;
  } catch (error) {
    message.error($t('system.systemStatus.loadFailed'));
  } finally {
    loading.value = false;
  }
}

// 立即检查依赖
async function handleCheckDependencies() {
  checking.value = true;
  try {
    const res = await checkDependencies();
    dependencies.value = res.dependencies || {};
    lastCheckAt.value = res.checkedAt || 0;
    message.success($t('system.systemStatus.checkSuccess'));
  } catch (error) {
    message.error($t('system.systemStatus.checkFailed'));
  } finally {
    checking.value = false;
  }
}

onMounted(() => {
  loadSystemStatus();
});

// 获取依赖列表（按名称排序）
const dependencyList = computed(() => {
  return Object.values(dependencies.value).sort((a, b) => {
    // 必需的在前
    if (a.required !== b.required) {
      return a.required ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
});

// 统计信息
const statistics = computed(() => {
  const list = dependencyList.value;
  const total = list.length;
  const available = list.filter((d) => d.available).length;
  const unavailable = total - available;
  const requiredTotal = list.filter((d) => d.required).length;
  const requiredAvailable = list.filter(
    (d) => d.required && d.available,
  ).length;

  return {
    total,
    available,
    unavailable,
    requiredTotal,
    requiredAvailable,
    requiredUnavailable: requiredTotal - requiredAvailable,
  };
});
</script>

<template>
  <Page
    :content-full-height="true"
    :title="$t('system.systemStatus.title')"
    description=""
  >
    <Card :loading="loading" :title="$t('system.systemStatus.overview')">
      <template #extra>
        <Space>
          <span v-if="lastCheckAt" class="text-sm text-gray-500">
            {{ $t('system.systemStatus.lastCheckAt') }}:
            {{ formatDateTime(lastCheckAt) }}
          </span>
          <Button
            :loading="checking"
            type="primary"
            @click="handleCheckDependencies"
          >
            <template #icon>
              <IconifyIcon icon="mdi:refresh" />
            </template>
            {{ $t('system.systemStatus.checkNow') }}
          </Button>
        </Space>
      </template>

      <!-- 统计卡片 -->
      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card size="small">
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">
              {{ statistics.total }}
            </div>
            <div class="text-sm text-gray-500">
              {{ $t('system.systemStatus.totalDependencies') }}
            </div>
          </div>
        </Card>
        <Card size="small">
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">
              {{ statistics.available }}
            </div>
            <div class="text-sm text-gray-500">
              {{ $t('system.systemStatus.availableDependencies') }}
            </div>
          </div>
        </Card>
        <Card size="small">
          <div class="text-center">
            <div
              :class="
                statistics.requiredUnavailable > 0
                  ? 'text-red-600'
                  : 'text-gray-400'
              "
              class="text-2xl font-bold"
            >
              {{ statistics.requiredUnavailable }}
            </div>
            <div class="text-sm text-gray-500">
              {{ $t('system.systemStatus.requiredUnavailable') }}
            </div>
          </div>
        </Card>
      </div>

      <!-- 依赖列表 -->
      <div class="space-y-4">
        <div
          v-for="dep in dependencyList"
          :key="dep.name"
          class="rounded-lg border p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="mb-2 flex items-center gap-2">
                <IconifyIcon
                  v-if="dep.available"
                  icon="mdi:check-circle"
                  class="text-lg text-green-600"
                />
                <IconifyIcon
                  v-else
                  icon="mdi:close-circle"
                  class="text-lg text-red-600"
                />
                <span class="font-mono text-lg font-bold">
                  {{ dep.name }}
                </span>
                <Tag v-if="dep.required" color="orange">
                  {{ $t('system.systemStatus.required') }}
                </Tag>
                <Tag v-else color="default">
                  {{ $t('system.systemStatus.optional') }}
                </Tag>
                <Tag :color="dep.available ? 'success' : 'error'">
                  {{
                    dep.available
                      ? $t('system.systemStatus.available')
                      : $t('system.systemStatus.unavailable')
                  }}
                </Tag>
              </div>

              <Descriptions :column="1" size="small">
                <Descriptions.Item
                  :label="$t('system.systemStatus.description')"
                >
                  {{ dep.description }}
                </Descriptions.Item>
                <Descriptions.Item
                  v-if="dep.available"
                  :label="$t('system.systemStatus.version')"
                >
                  <span class="font-mono text-sm">{{ dep.version }}</span>
                </Descriptions.Item>
                <Descriptions.Item
                  v-if="dep.available"
                  :label="$t('system.systemStatus.path')"
                >
                  <span class="font-mono text-sm text-gray-600">{{
                    dep.path
                  }}</span>
                </Descriptions.Item>
                <Descriptions.Item
                  v-if="!dep.available"
                  :label="$t('system.systemStatus.status')"
                >
                  <span class="text-red-600">
                    {{ $t('system.systemStatus.notFound') }}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="dependencyList.length === 0 && !loading"
        class="py-12 text-center text-gray-400"
      >
        {{ $t('system.systemStatus.noDependencies') }}
      </div>
    </Card>
  </Page>
</template>

<style scoped>
.ant-descriptions-item-label {
  width: 120px;
}
</style>
