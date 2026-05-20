<script lang="ts" setup>
import type { NotificationChannelApi } from '#/api/core/notification-channel';
import type { NotificationScenarioApi } from '#/api/core/notification-scenario';

import { computed, onMounted, ref } from 'vue';

import { Card, message, Select, Switch, Tag } from 'ant-design-vue';

import { getNotificationChannelList } from '#/api/core/notification-channel';
import {
  createNotificationScenario,
  getAvailableScenarios,
  getNotificationScenarioList,
  updateNotificationScenario,
} from '#/api/core/notification-scenario';
import { $t } from '#/locales';

interface DisplayScenarioItem {
  id?: string;
  scenarioType: string;
  name: string;
  channelIds: string[];
  enabled: boolean;
  isNew: boolean;
}

interface ScenarioGroup {
  key: string;
  label: string;
  color: string;
  types: string[];
  items: DisplayScenarioItem[];
}

const scenarios = ref<DisplayScenarioItem[]>([]);
const channels = ref<NotificationChannelApi.NotificationChannelItem[]>([]);
const loading = ref(false);

const channelTypeMap: Record<string, string> = {
  wecom: $t('notification.channel.wecom'),
};

// 场景分组定义，顺序固定
const GROUP_DEFINITIONS: Omit<ScenarioGroup, 'items'>[] = [
  {
    key: 'deploy',
    label: $t('notification.scenario.groupDeploy'),
    color: 'blue',
    types: ['deploy_completed', 'deploy_failed'],
  },
  {
    key: 'release',
    label: $t('notification.scenario.groupRelease'),
    color: 'purple',
    types: ['release_completed', 'release_failed'],
  },
  {
    key: 'build',
    label: $t('notification.scenario.groupBuild'),
    color: 'green',
    types: ['build_start', 'build_completed', 'build_failed', 'build_locked'],
  },
  {
    key: 'alert',
    label: $t('notification.scenario.groupAlert'),
    color: 'red',
    types: ['ssl_cert_alert', 'image_check_alert'],
  },
];

const scenarioGroups = computed<ScenarioGroup[]>(() => {
  return GROUP_DEFINITIONS.map((group) => ({
    ...group,
    items: group.types
      .map((type) => scenarios.value.find((s) => s.scenarioType === type))
      .filter((s): s is DisplayScenarioItem => s !== undefined),
  })).filter((group) => group.items.length > 0);
});

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

function getChannelLabel(
  channel: NotificationChannelApi.NotificationChannelItem,
): string {
  const typeName = channelTypeMap[channel.type] || channel.type;
  return `${typeName} - ${channel.name}`;
}
</script>

<template>
  <div class="p-4">
    <div class="grid grid-cols-2 gap-4">
    <Card
      v-for="group in scenarioGroups"
      :key="group.key"
      :bordered="false"
      :loading="loading"
    >
      <template #title>
        <div class="flex items-center gap-2">
          <Tag :color="group.color" class="m-0 text-sm font-medium">
            {{ group.label }}
          </Tag>
        </div>
      </template>

      <div class="space-y-3">
        <div
          v-for="scenario in group.items"
          :key="scenario.scenarioType"
          class="border-border hover:bg-accent/50 flex items-center gap-4 rounded-lg border p-4 transition-colors"
        >
          <!-- 场景名称 -->
          <div class="w-36 flex-shrink-0">
            <div class="text-sm font-medium">{{ scenario.name }}</div>
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
          <div class="flex w-16 flex-shrink-0 items-center justify-center">
            <Switch
              v-model:checked="scenario.enabled"
              @change="handleEnabledChange(scenario)"
            />
          </div>
        </div>
      </div>
    </Card>
    </div>

    <!-- 空状态 -->
    <Card v-if="scenarioGroups.length === 0 && !loading" :bordered="false">
      <div class="text-muted-foreground py-12 text-center">
        {{ $t('notification.scenario.title') }}
      </div>
    </Card>
  </div>
</template>
