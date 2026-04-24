<script lang="ts" setup>
import type { WorkbenchProjectItem } from '@vben/common-ui';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { WorkbenchHeader, WorkbenchProject } from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useAccessStore, useBusinessStore, useUserStore } from '@vben/stores';

import { Card, message, Select, Spin } from 'ant-design-vue';

import { setUserDefaultBusinessLine } from '#/api/system/user';

const userStore = useUserStore();
const businessStore = useBusinessStore();
const accessStore = useAccessStore();
const router = useRouter();

// 默认业务线设置
const loading = ref(false);
const selectedBusinessLineId = ref<number | undefined>();

const defaultBusinessLine = computed(() => {
  return businessStore.businessLines.find(
    (item) => item.businessLine.isDefault,
  );
});

onMounted(() => {
  if (defaultBusinessLine.value) {
    selectedBusinessLineId.value = defaultBusinessLine.value.businessLine.id;
  }
  fetchWeather();
});

async function handleSetDefaultBusinessLine(businessLineId: number) {
  if (businessLineId === defaultBusinessLine.value?.businessLine.id) {
    return;
  }
  loading.value = true;
  try {
    await setUserDefaultBusinessLine(businessLineId);
    message.success('设置默认业务线成功');
    await businessStore.init(true);
    selectedBusinessLineId.value = businessLineId;
  } catch (error: any) {
    message.error(error.message || '设置默认业务线失败');
    if (defaultBusinessLine.value) {
      selectedBusinessLineId.value = defaultBusinessLine.value.businessLine.id;
    }
  } finally {
    loading.value = false;
  }
}

// ---- 天气 & 问候语 ----

const WMO_CODES: Record<number, string> = {
  0: '晴',
  1: '晴间多云',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '大毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '冰粒',
  80: '阵雨',
  81: '中阵雨',
  82: '强阵雨',
  85: '阵雪',
  86: '强阵雪',
  95: '雷阵雨',
  96: '雷阵雨伴冰雹',
  99: '强雷阵雨伴冰雹',
};

const weatherDesc = ref('');
const weatherTemp = ref('');

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return '早安';
  if (hour >= 9 && hour < 12) return '上午好';
  if (hour >= 12 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  if (hour >= 18 && hour < 22) return '晚上好';
  return '夜深了';
}

const greeting = computed(() => getGreeting());

async function fetchWeather() {
  try {
    const geoRes = await fetch('https://ipapi.co/json/');
    const geo = await geoRes.json();
    const { latitude: lat, longitude: lon } = geo;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weathercode&temperature_unit=celsius&timezone=auto`;
    const weatherRes = await fetch(url);
    const data = await weatherRes.json();

    const code: number = data.current.weathercode;
    const temp: number = Math.round(data.current.temperature_2m);
    const feelsLike: number = Math.round(data.current.apparent_temperature);

    weatherDesc.value = WMO_CODES[code] ?? '未知';
    weatherTemp.value = `${temp}℃（体感 ${feelsLike}℃）`;
  } catch {
    weatherDesc.value = '';
    weatherTemp.value = '';
  }
}

// ---- 快捷入口（使用 WorkbenchProject 样式）----

const hasPackagePermission = computed(
  () =>
    !!accessStore.getMenuByPath('/package-deploy-management/project-package'),
);

const hasDeployPermission = computed(
  () =>
    !!accessStore.getMenuByPath('/package-deploy-management/project-deploy'),
);

const quickEntryItems = computed(() => {
  const items: WorkbenchProjectItem[] = [];
  if (hasPackagePermission.value) {
    items.push({
      color: '#1890ff',
      content: '构建项目，生成可部署的版本包',
      date: '',
      group: '打包发布',
      icon: 'lucide:package',
      title: '项目打包',
      url: '/package-deploy-management/project-package',
    });
  }
  if (hasDeployPermission.value) {
    items.push({
      color: '#52c41a',
      content: '将版本包发布到目标环境',
      date: '',
      group: '打包发布',
      icon: 'lucide:rocket',
      title: '项目发布',
      url: '/package-deploy-management/project-deploy',
    });
  }
  return items;
});

function navTo(nav: WorkbenchProjectItem) {
  if (nav.url?.startsWith('/')) {
    router.push(nav.url);
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>
        {{ greeting }}, {{ userStore.userInfo?.realName }}, 开始您一天的工作吧！
      </template>
      <template #description>
        <span v-if="weatherDesc">{{ weatherDesc }}，{{ weatherTemp }}</span>
        <span v-else>加载天气中...</span>
      </template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col gap-5 lg:flex-row">
      <!-- 快捷入口 -->
      <div v-if="quickEntryItems.length > 0" class="w-full lg:w-3/5">
        <WorkbenchProject
          :items="quickEntryItems"
          title="快捷入口"
          @click="navTo"
        />
      </div>

      <!-- 默认业务线设置 -->
      <div class="w-full lg:w-2/5">
        <Card title="默认业务线设置">
          <Spin :spinning="loading">
            <div v-if="businessStore.businessLines.length > 0">
              <div class="mb-2 text-sm text-gray-500">
                选择您的默认业务线，登录后将自动切换到该业务线
              </div>
              <Select
                v-model:value="selectedBusinessLineId"
                class="w-full"
                placeholder="请选择默认业务线"
                size="large"
                @change="handleSetDefaultBusinessLine"
              >
                <template #suffixIcon>
                  <span class="text-gray-400">▼</span>
                </template>
                <template #labelRender="{ label, value }">
                  <div class="flex h-full items-center gap-2">
                    <template
                      v-for="item in businessStore.businessLines"
                      :key="item.businessLine.id"
                    >
                      <template v-if="item.businessLine.id === value">
                        <img
                          v-if="item.businessLine.logoUrl"
                          :src="item.businessLine.logoUrl"
                          alt=""
                          class="h-5 w-5 flex-shrink-0 rounded"
                        />
                      </template>
                    </template>
                    <span class="font-medium leading-none">{{ label }}</span>
                  </div>
                </template>
                <Select.Option
                  v-for="item in businessStore.businessLines"
                  :key="item.businessLine.id"
                  :value="item.businessLine.id"
                >
                  <div class="flex items-center gap-2">
                    <img
                      v-if="item.businessLine.logoUrl"
                      :src="item.businessLine.logoUrl"
                      alt=""
                      class="h-5 w-5 flex-shrink-0 rounded"
                    />
                    <span class="font-medium">
                      {{ item.businessLine.name }}
                    </span>
                  </div>
                </Select.Option>
              </Select>
            </div>
            <div v-else class="text-center text-gray-500">暂无业务线</div>
          </Spin>
        </Card>
      </div>
    </div>
  </div>
</template>
