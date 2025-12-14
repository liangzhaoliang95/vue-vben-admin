<script lang="ts" setup>
import type { NotificationChannelApi } from '#/api/core/notification-channel';
import type { NotificationScenarioApi } from '#/api/core/notification-scenario';

import { onMounted, ref } from 'vue';

import { Card, message, Select, Switch } from 'ant-design-vue';

import { getNotificationChannelList } from '#/api/core/notification-channel';
import {
  createNotificationScenario,
  getAvailableScenarios,
  getNotificationScenarioList,
  updateNotificationScenario,
} from '#/api/core/notification-scenario';
import { $t } from '#/locales';

// 扩展的场景配置项（用于前端显示）
interface DisplayScenarioItem {
  id?: string;
  scenarioType: string;
  name: string;
  channelIds: string[];
  enabled: boolean;
  isNew: boolean;
}

const scenarios = ref<DisplayScenarioItem[]>([]);
const channels = ref<NotificationChannelApi.NotificationChannelItem[]>([]);
const loading = ref(false);

// 渠道类型显示名称映射
const channelTypeMap: Record<string, string> = {
  wecom: $t('notification.channel.wecom'),
};

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  try {
    const [availableResult, savedResult, channelsResult] = await Promise.all([
      getAvailableScenarios(),
      getNotificationScenarioList(),
      getNotificationChannelList({ pageIndex: 1, pageSize: 100 }),
    ]);

    channels.value = channelsResult.items;

    const savedMap = new Map<string, NotificationScenarioApi.ScenarioItem>();
    savedResult.forEach((saved) => {
      savedMap.set(saved.scenarioType, saved);
    });

    scenarios.value = availableResult.scenarios.map((available) => {
      const saved = savedMap.get(available.scenarioType);
      return saved
        ? {
            id: saved.id,
            scenarioType: saved.scenarioType,
            name: available.name,
            channelIds: saved.channelIds,
            enabled: saved.enabled,
            isNew: false,
          }
        : {
            scenarioType: available.scenarioType,
            name: available.name,
            channelIds: [],
            enabled: false,
            isNew: true,
          };
    });
  } catch {
    message.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

async function handleSave(scenario: DisplayScenarioItem) {
  try {
    if (scenario.isNew) {
      await createNotificationScenario({
        scenarioType: scenario.scenarioType,
        channelIds: scenario.channelIds,
        enabled: scenario.enabled,
      });
      message.success($t('notification.scenario.createSuccess'));
    } else {
      await updateNotificationScenario({
        id: scenario.id!,
        channelIds: scenario.channelIds,
        enabled: scenario.enabled,
      });
      message.success($t('notification.scenario.updateSuccess'));
    }
    await loadData();
  } catch {
    message.error($t('notification.scenario.saveFailed'));
    await loadData();
  }
}

function handleChannelChange(scenario: DisplayScenarioItem) {
  handleSave(scenario);
}

function handleEnabledChange(scenario: DisplayScenarioItem) {
  handleSave(scenario);
}

// 获取渠道显示标签（渠道类型 - 渠道名称）
function getChannelLabel(
  channel: NotificationChannelApi.NotificationChannelItem,
): string {
  const typeName = channelTypeMap[channel.type] || channel.type;
  return `${typeName} - ${channel.name}`;
}
</script>

<template>
  <div class="p-4">
    <Card
      :title="$t('notification.scenario.title')"
      :bordered="false"
      :loading="loading"
    >
      <div class="space-y-4">
        <div
          v-for="scenario in scenarios"
          :key="scenario.scenarioType"
          class="border-border hover:bg-accent/50 flex items-center gap-4 rounded-lg border p-4 transition-colors"
        >
          <!-- 场景名称 -->
          <div class="w-40 flex-shrink-0">
            <div class="text-base font-medium">{{ scenario.name }}</div>
          </div>

          <!-- 渠道选择 -->
          <div class="flex-1">
            <Select
              v-model:value="scenario.channelIds"
              mode="multiple"
              :placeholder="$t('notification.scenario.selectChannel')"
              :options="
                channels.map((ch) => ({
                  label: getChannelLabel(ch),
                  value: ch.id,
                  disabled: !ch.enabled,
                }))
              "
              class="w-full"
              @change="handleChannelChange(scenario)"
            />
          </div>

          <!-- 启用开关 -->
          <div class="flex w-20 flex-shrink-0 items-center justify-center">
            <Switch
              v-model:checked="scenario.enabled"
              @change="handleEnabledChange(scenario)"
            />
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="scenarios.length === 0"
          class="text-muted-foreground py-12 text-center"
        >
          暂无场景配置
        </div>
      </div>
    </Card>
  </div>
</template>
