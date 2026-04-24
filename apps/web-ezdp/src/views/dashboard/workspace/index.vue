<script lang="ts" setup>
import type {
  WorkbenchProjectItem,
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  AnalysisChartCard,
  WorkbenchHeader,
  WorkbenchProject,
  WorkbenchQuickNav,
  WorkbenchTodo,
  WorkbenchTrends,
} from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useBusinessStore, useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { Card, message, Select, Spin } from 'ant-design-vue';

import { setUserDefaultBusinessLine } from '#/api/system/user';

import AnalyticsVisitsSource from '../analytics/analytics-visits-source.vue';

const userStore = useUserStore();
const businessStore = useBusinessStore();

// 默认业务线设置
const loading = ref(false);
const selectedBusinessLineId = ref<number | undefined>();

// 计算当前默认业务线
const defaultBusinessLine = computed(() => {
  return businessStore.businessLines.find((item) => item.businessLine.isDefault);
});

// 初始化选中的业务线
onMounted(() => {
  if (defaultBusinessLine.value) {
    selectedBusinessLineId.value = defaultBusinessLine.value.businessLine.id;
  }
});

// 设置默认业务线
async function handleSetDefaultBusinessLine(businessLineId: number) {
  if (businessLineId === defaultBusinessLine.value?.businessLine.id) {
    return;
  }

  loading.value = true;
  try {
    await setUserDefaultBusinessLine(businessLineId);
    message.success('设置默认业务线成功');

    // 刷新业务线数据
    await businessStore.init(true);

    // 更新选中的业务线
    selectedBusinessLineId.value = businessLineId;
  } catch (error: any) {
    message.error(error.message || '设置默认业务线失败');
    // 恢复之前的选择
    if (defaultBusinessLine.value) {
      selectedBusinessLineId.value = defaultBusinessLine.value.businessLine.id;
    }
  } finally {
    loading.value = false;
  }
}

// 这是一个示例数据，实际项目中需要根据实际情况进行调整
// url 也可以是内部路由，在 navTo 方法中识别处理，进行内部跳转
// 例如：url: /dashboard/workspace
const projectItems: WorkbenchProjectItem[] = [
  {
    color: '',
    content: '不要等待机会，而要创造机会。',
    date: '2021-04-01',
    group: '开源组',
    icon: 'carbon:logo-github',
    title: 'Github',
    url: 'https://github.com',
  },
  {
    color: '#3fb27f',
    content: '现在的你决定将来的你。',
    date: '2021-04-01',
    group: '算法组',
    icon: 'ion:logo-vue',
    title: 'Vue',
    url: 'https://vuejs.org',
  },
  {
    color: '#e18525',
    content: '没有什么才能比努力更重要。',
    date: '2021-04-01',
    group: '上班摸鱼',
    icon: 'ion:logo-html5',
    title: 'Html5',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTML',
  },
  {
    color: '#bf0c2c',
    content: '热情和欲望可以突破一切难关。',
    date: '2021-04-01',
    group: 'UI',
    icon: 'ion:logo-angular',
    title: 'Angular',
    url: 'https://angular.io',
  },
  {
    color: '#00d8ff',
    content: '健康的身体是实现目标的基石。',
    date: '2021-04-01',
    group: '技术牛',
    icon: 'bx:bxl-react',
    title: 'React',
    url: 'https://reactjs.org',
  },
  {
    color: '#EBD94E',
    content: '路是走出来的，而不是空想出来的。',
    date: '2021-04-01',
    group: '架构组',
    icon: 'ion:logo-javascript',
    title: 'Js',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript',
  },
];

// 同样，这里的 url 也可以使用以 http 开头的外部链接
const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#1fdaca',
    icon: 'ion:home-outline',
    title: '首页',
    url: '/',
  },
  {
    color: '#bf0c2c',
    icon: 'ion:grid-outline',
    title: '仪表盘',
    url: '/dashboard',
  },
  {
    color: '#e18525',
    icon: 'ion:layers-outline',
    title: '组件',
    url: '/demos/features/icons',
  },
  {
    color: '#3fb27f',
    icon: 'ion:settings-outline',
    title: '系统管理',
    url: '/demos/features/login-expired', // 这里的 URL 是示例，实际项目中需要根据实际情况进行调整
  },
  {
    color: '#4daf1bc9',
    icon: 'ion:key-outline',
    title: '权限管理',
    url: '/demos/access/page-control',
  },
  {
    color: '#00d8ff',
    icon: 'ion:bar-chart-outline',
    title: '图表',
    url: '/analytics',
  },
];

const todoItems = ref<WorkbenchTodoItem[]>([
  {
    completed: false,
    content: `审查最近提交到Git仓库的前端代码，确保代码质量和规范。`,
    date: '2024-07-30 11:00:00',
    title: '审查前端代码提交',
  },
  {
    completed: true,
    content: `检查并优化系统性能，降低CPU使用率。`,
    date: '2024-07-30 11:00:00',
    title: '系统性能优化',
  },
  {
    completed: false,
    content: `进行系统安全检查，确保没有安全漏洞或未授权的访问。 `,
    date: '2024-07-30 11:00:00',
    title: '安全检查',
  },
  {
    completed: false,
    content: `更新项目中的所有npm依赖包，确保使用最新版本。`,
    date: '2024-07-30 11:00:00',
    title: '更新项目依赖',
  },
  {
    completed: false,
    content: `修复用户报告的页面UI显示问题，确保在不同浏览器中显示一致。 `,
    date: '2024-07-30 11:00:00',
    title: '修复UI显示问题',
  },
]);
const trendItems: WorkbenchTrendItem[] = [
  {
    avatar: 'svg:avatar-1',
    content: `在 <a>开源组</a> 创建了项目 <a>Vue</a>`,
    date: '刚刚',
    title: '威廉',
  },
  {
    avatar: 'svg:avatar-2',
    content: `关注了 <a>威廉</a> `,
    date: '1个小时前',
    title: '艾文',
  },
  {
    avatar: 'svg:avatar-3',
    content: `发布了 <a>个人动态</a> `,
    date: '1天前',
    title: '克里斯',
  },
  {
    avatar: 'svg:avatar-4',
    content: `发表文章 <a>如何编写一个Vite插件</a> `,
    date: '2天前',
    title: 'Vben',
  },
  {
    avatar: 'svg:avatar-1',
    content: `回复了 <a>杰克</a> 的问题 <a>如何进行项目优化？</a>`,
    date: '3天前',
    title: '皮特',
  },
  {
    avatar: 'svg:avatar-2',
    content: `关闭了问题 <a>如何运行项目</a> `,
    date: '1周前',
    title: '杰克',
  },
  {
    avatar: 'svg:avatar-3',
    content: `发布了 <a>个人动态</a> `,
    date: '1周前',
    title: '威廉',
  },
  {
    avatar: 'svg:avatar-4',
    content: `推送了代码到 <a>Github</a>`,
    date: '2021-04-01 20:00',
    title: '威廉',
  },
  {
    avatar: 'svg:avatar-4',
    content: `发表文章 <a>如何编写使用 Admin Vben</a> `,
    date: '2021-03-01 20:00',
    title: 'Vben',
  },
];

const router = useRouter();

// 这是一个示例方法，实际项目中需要根据实际情况进行调整
// This is a sample method, adjust according to the actual project requirements
function navTo(nav: WorkbenchProjectItem | WorkbenchQuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  } else {
    console.warn(`Unknown URL for navigation item: ${nav.title} -> ${nav.url}`);
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>
        早安, {{ userStore.userInfo?.realName }}, 开始您一天的工作吧！
      </template>
      <template #description> 今日晴，20℃ - 32℃！ </template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <WorkbenchProject :items="projectItems" title="项目" @click="navTo" />
        <WorkbenchTrends :items="trendItems" class="mt-5" title="最新动态" />
      </div>
      <div class="w-full lg:w-2/5">
        <!-- 默认业务线设置 -->
        <Card class="mt-5 lg:mt-0" title="默认业务线设置">
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
                    <span class="font-medium">{{ item.businessLine.name }}</span>
                  </div>
                </Select.Option>
              </Select>
            </div>
            <div v-else class="text-center text-gray-500">暂无业务线</div>
          </Spin>
        </Card>

        <WorkbenchQuickNav
          :items="quickNavItems"
          class="mt-5"
          title="快捷导航"
          @click="navTo"
        />
        <WorkbenchTodo :items="todoItems" class="mt-5" title="待办事项" />
        <AnalysisChartCard class="mt-5" title="访问来源">
          <AnalyticsVisitsSource />
        </AnalysisChartCard>
      </div>
    </div>
  </div>
</template>
