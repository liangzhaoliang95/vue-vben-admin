<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { ArrowLeft } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

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
const businessStore = useBusinessStore();

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
  businessLineId: route.query.businessLineId as string,
  name: route.query.name as string,
  projectId: route.query.projectId as string,
  projectUrl: route.query.projectUrl as string,
  type: route.query.type as string,
});

// 获取业务线名称
const businessLineName = computed(() => {
  if (!projectInfo.businessLineId) return '';
  const businessLineId = Number(projectInfo.businessLineId);
  const businessLine = businessStore.businessLines.find(
    (item) => item.businessLine.id === businessLineId,
  );
  return businessLine?.businessLine.name || projectInfo.businessLineId;
});

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
        {{ $t('ui.button.backToList') }}
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
          {{ businessLineName }}
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
          :tab="$t('deploy.projectManagement.projectConfig.buildConfig.title')"
        >
          <BuildConfig
            :project-id="projectId"
            :project-type="projectInfo.type"
          />
        </TabPane>
        <TabPane
          key="deploy"
          :tab="$t('deploy.projectManagement.projectConfig.deployConfig.title')"
        >
          <DeployConfig
            :project-id="projectId"
            :project-type="projectInfo.type"
          />
        </TabPane>
      </Tabs>
    </Card>
  </Page>
</template>
