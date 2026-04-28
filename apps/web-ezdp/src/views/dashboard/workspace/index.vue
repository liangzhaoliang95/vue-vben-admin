<script lang="ts" setup>
import type { WorkbenchProjectItem } from '@vben/common-ui';

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { WorkbenchHeader } from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useAccessStore, useBusinessStore, useUserStore } from '@vben/stores';

import { Card, message, Select, Spin } from 'ant-design-vue';
import { ArrowRight, Bell, Package, Rocket } from 'lucide-vue-next';
import { Solar } from 'lunar-javascript';

import { setUserDefaultBusinessLine } from '#/api/system/user';
import { getPublicAnnouncementList } from '#/api/core/announcement';
import type { AnnouncementApi } from '#/api/core/announcement';

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

// ---- 公告 ----

const announcements = ref<AnnouncementApi.AnnouncementItem[]>([]);
const announcementsLoading = ref(false);

async function fetchAnnouncements() {
  if (!businessStore.currentBusinessLineId) return;
  announcementsLoading.value = true;
  try {
    const res = await getPublicAnnouncementList({
      businessLineId: businessStore.currentBusinessLineId,
    });
    announcements.value = res ?? [];
  } catch {
    announcements.value = [];
  } finally {
    announcementsLoading.value = false;
  }
}

function handleAnnouncementClick(item: AnnouncementApi.AnnouncementItem) {
  if (!item.linkUrl) return;
  if (item.linkUrl.startsWith('http')) {
    window.open(item.linkUrl, '_blank');
  } else {
    router.push(item.linkUrl);
  }
}

onMounted(() => {
  if (defaultBusinessLine.value) {
    selectedBusinessLineId.value = defaultBusinessLine.value.businessLine.id;
  }
  fetchWeather();
  fetchHitokoto();
});

// 监听业务线变化，重新加载公告
watch(
  () => businessStore.currentBusinessLineId,
  (newId) => {
    if (newId) {
      fetchAnnouncements();
    }
  },
  { immediate: true }, // 立即执行一次，确保在业务线初始化后加载公告
);

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

interface WeatherInfo {
  desc: string;
  temp: string;
  feelsLike: string;
  humidity: string;
  windSpeed: string;
  iconUrl: string;
  city: string;
  region: string;
  minTemp: string;
  maxTemp: string;
}

const weather = ref<WeatherInfo | null>(null);

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

const hitokoto = ref('');

async function fetchHitokoto() {
  try {
    const res = await fetch('https://v1.hitokoto.cn/?c=b&c=d&c=h', { cache: 'no-cache' });
    const data = await res.json();
    hitokoto.value = data.hitokoto ?? '';
  } catch {
    hitokoto.value = '';
  }
}

async function fetchWeather() {
  try {
    const res = await fetch('https://wttr.in/?format=j1', { cache: 'no-cache' });
    const data = await res.json();
    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0];
    if (!current) return;

    const todayWeather = data.weather?.[0];
    weather.value = {
      desc: current.weatherDesc?.[0]?.value ?? '',
      temp: current.temp_C ?? '',
      feelsLike: current.FeelsLikeC ?? '',
      humidity: current.humidity ?? '',
      windSpeed: current.windspeedKmph ?? '',
      iconUrl: current.weatherIconUrl?.[0]?.value ?? '',
      city: area?.areaName?.[0]?.value ?? '',
      region: area?.region?.[0]?.value ?? area?.country?.[0]?.value ?? '',
      minTemp: todayWeather?.mintempC ?? '',
      maxTemp: todayWeather?.maxtempC ?? '',
    };
  } catch {
    weather.value = null;
  }
}

// ---- 日期 & 黄历（lunar-javascript 真实数据）----

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const today = new Date();
const solar = Solar.fromDate(today);
const lunar = solar.getLunar();

const dateStr = computed(() => {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}年${m}月${d}日`;
});
const weekStr = computed(() => `星期${WEEK_DAYS[today.getDay()]}`);
const lunarDate = computed(() => ({
  year: `${lunar.getYearInGanZhi()}${lunar.getYearShengXiao()}年`,
  month: `${lunar.getMonthInChinese()}月`,
  day: lunar.getDayInChinese(),
}));
const luckyList = computed(() => lunar.getDayYi().slice(0, 2).join('、') || '诸事不宜');
const unluckyList = computed(() => lunar.getDayJi().slice(0, 2).join('、') || '百无禁忌');

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
        {{ greeting }}, {{ userStore.userInfo?.realName }}，{{ hitokoto || '开始您一天的工作吧！' }}
      </template>
      <template #description>
        <div v-if="weather" class="flex items-center gap-3">
          <img
            v-if="weather.iconUrl"
            :src="weather.iconUrl"
            class="h-8 w-8"
            alt="weather icon"
          />
          <div class="flex flex-col">
            <span class="text-sm">
              {{ weather.city }}{{ weather.region ? `，${weather.region}` : '' }}
            </span>
            <span class="text-foreground/70 text-xs">
              {{ weather.desc }} {{ weather.temp }}℃ · {{ weather.minTemp }}~{{ weather.maxTemp }}℃ · 湿度 {{ weather.humidity }}% · 风速 {{ weather.windSpeed }} km/h
            </span>
          </div>
        </div>
        <span v-else class="text-foreground/50 text-sm">加载天气中...</span>
      </template>
      <template #extra>
        <div class="flex flex-col justify-center text-right">
          <span class="text-foreground/80">{{ dateStr }}</span>
          <span class="text-lg">{{ weekStr }}</span>
        </div>

        <div class="mx-8 flex flex-col justify-center text-right md:mx-12">
          <span class="text-foreground/80">{{ lunarDate.year }}</span>
          <span class="text-lg">{{ lunarDate.month }}{{ lunarDate.day }}</span>
        </div>

        <div class="mr-4 flex flex-col justify-center text-right md:mr-10">
          <span class="text-foreground/80">宜</span>
          <span class="text-sm">{{ luckyList }}</span>
        </div>

        <div class="mr-4 flex flex-col justify-center text-right md:mr-10">
          <span class="text-foreground/80">忌</span>
          <span class="text-sm">{{ unluckyList }}</span>
        </div>
      </template>
    </WorkbenchHeader>

    <!-- 公告栏 -->
    <div class="mt-5 w-full">
      <Card>
        <template #title>
          <div class="flex items-center gap-2">
            <Bell class="h-5 w-5 text-blue-500" />
            <span>公告栏</span>
          </div>
        </template>

        <Spin :spinning="announcementsLoading">
          <div v-if="announcements.length > 0" class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div
              v-for="(item, index) in announcements"
              :key="item.id"
              :class="[
                'group rounded-lg border border-gray-200 bg-gray-50 p-4 transition-all dark:border-gray-700 dark:bg-gray-800/50',
                item.linkUrl
                  ? 'cursor-pointer hover:border-blue-400 hover:bg-white hover:shadow-md dark:hover:border-blue-500 dark:hover:bg-gray-800'
                  : ''
              ]"
              @click="handleAnnouncementClick(item)"
            >
              <div class="flex items-start gap-3">
                <!-- 序号徽标 -->
                <div class="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  {{ index + 1 }}
                </div>

                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-6">
                    {{ item.title }}
                  </h3>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {{ item.content }}
                  </p>
                </div>

                <!-- 右侧箭头图标 -->
                <div
                  v-if="item.linkUrl"
                  class="flex-shrink-0 self-center text-gray-300 group-hover:text-blue-500 transition-colors dark:text-gray-600"
                >
                  <ArrowRight class="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          <div
            v-else
            class="flex flex-col items-center justify-center rounded-lg bg-gray-50 py-12 dark:bg-gray-800/50"
          >
            <Bell class="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p class="text-sm text-gray-500 dark:text-gray-400">暂无公告</p>
          </div>
        </Spin>
      </Card>
    </div>

    <div class="mt-5 flex flex-col gap-5 lg:flex-row">
      <!-- 快捷入口 -->
      <div v-if="quickEntryItems.length > 0" class="w-full lg:w-3/5">
        <Card title="快捷入口">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              v-for="item in quickEntryItems"
              :key="item.title"
              class="group cursor-pointer rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:hover:border-blue-500"
              @click="navTo(item)"
            >
              <div class="flex items-start gap-3">
                <div
                  :style="{ backgroundColor: item.color }"
                  class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                >
                  <Package
                    v-if="item.icon === 'lucide:package'"
                    class="h-5 w-5 text-white"
                  />
                  <Rocket
                    v-else-if="item.icon === 'lucide:rocket'"
                    class="h-5 w-5 text-white"
                  />
                </div>
                <div class="flex-1">
                  <h3 class="mb-1 font-medium text-gray-900 dark:text-gray-100">
                    {{ item.title }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ item.content }}
                  </p>
                  <div class="mt-2 text-xs text-gray-400">
                    {{ item.group }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- 默认业务线设置 -->
      <div class="w-full lg:w-2/5">
        <Card title="默认业务线设置">
          <Spin :spinning="loading">
            <div v-if="businessStore.businessLines.length > 0">
              <div class="mb-4 text-sm text-gray-500 dark:text-gray-400">
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
