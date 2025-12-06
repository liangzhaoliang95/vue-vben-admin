<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { ArrowLeft } from '@vben/icons';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import { $t } from '#/locales';

import BuildConfig from './modules/build-config.vue';
import DeployConfig from './modules/deploy-config.vue';

const route = useRoute();
const router = useRouter();

// 从路由参数或 query 获取项目信息
const projectId = computed(() => route.query.id as string);

// 返回列表页
function handleBack() {
  router.push('/project-management/project-config');
}

// 使用 ref 管理当前活动的 tab，初始值从 query 中获取
const activeTab = ref((route.query.tab as string) || 'build');

// 项目基本信息（实际应该从接口获取）
const projectInfo = reactive({
  group: route.query.group as string,
  name: route.query.name as string,
  projectId: route.query.projectId as string,
  projectUrl: route.query.projectUrl as string,
  type: route.query.type as string,
});

// Tab 切换处理 - 只更新本地状态，不触发路由跳转
function handleTabChange(key: string) {
  activeTab.value = key;
}

// 项目类型显示文本
const projectTypeText = computed(() => {
  const typeMap: Record<string, string> = {
    backend: $t('deploy.projectManagement.projectConfig.type.backend'),
    frontend: $t('deploy.projectManagement.projectConfig.type.frontend'),
    submodule: $t('deploy.projectManagement.projectConfig.type.submodule'),
  };
  return typeMap[projectInfo.type] || projectInfo.type;
});
</script>

<template>
  <Page auto-content-height>
    <!-- 返回按钮 -->
    <div class="mb-4">
      <Button type="link" @click="handleBack">
        <template #icon>
          <ArrowLeft class="size-4" />
        </template>
        返回列表
      </Button>
    </div>

    <!-- 项目基本信息展示区 -->
    <Card
      :title="$t('deploy.projectManagement.projectConfig.basicInfo')"
      class="mb-4"
    >
      <Descriptions :column="2" bordered>
        <DescriptionsItem
          :label="$t('deploy.projectManagement.projectConfig.group')"
        >
          {{ projectInfo.group }}
        </DescriptionsItem>
        <DescriptionsItem
          :label="$t('deploy.projectManagement.projectConfig.name')"
        >
          {{ projectInfo.name }}
        </DescriptionsItem>
        <DescriptionsItem
          :label="$t('deploy.projectManagement.projectConfig.projectId')"
        >
          {{ projectInfo.projectId }}
        </DescriptionsItem>
        <DescriptionsItem
          :label="$t('deploy.projectManagement.projectConfig.type.label')"
        >
          {{ projectTypeText }}
        </DescriptionsItem>
        <DescriptionsItem
          :label="$t('deploy.projectManagement.projectConfig.projectUrl')"
          :span="2"
        >
          {{ projectInfo.projectUrl }}
        </DescriptionsItem>
      </Descriptions>
    </Card>

    <!-- 配置区域 -->
    <Card>
      <Tabs v-model:active-key="activeTab">
        <TabPane
          key="build"
          :tab="$t('deploy.projectManagement.projectConfig.buildConfig')"
        >
          <BuildConfig :project-id="projectId" />
        </TabPane>
        <TabPane
          key="deploy"
          :tab="$t('deploy.projectManagement.projectConfig.deployConfig')"
        >
          <DeployConfig :project-id="projectId" />
        </TabPane>
      </Tabs>
    </Card>
  </Page>
</template>
