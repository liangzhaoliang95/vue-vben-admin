<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { $t } from '#/locales';

defineOptions({ name: 'About' });

// 后端技术列表
const backendTechs = [
  'demos.vben.about.backendTech.item1',
  'demos.vben.about.backendTech.item2',
  'demos.vben.about.backendTech.item3',
  'demos.vben.about.backendTech.item4',
  'demos.vben.about.backendTech.item5',
];

// 前端技术列表
const frontendTechs = [
  'demos.vben.about.frontendTech.item1',
  'demos.vben.about.frontendTech.item2',
  'demos.vben.about.frontendTech.item3',
  'demos.vben.about.frontendTech.item4',
  'demos.vben.about.frontendTech.item5',
  'demos.vben.about.frontendTech.item6',
];
</script>

<template>
  <Page :title="$t('demos.vben.about.pageTitle')">
    <template #description>
      <p class="text-foreground mt-3 text-sm leading-6">
        {{ $t('demos.vben.about.description') }}
      </p>
    </template>

    <!-- 核心功能 -->
    <div class="card-box p-5">
      <div>
        <h5 class="text-foreground text-lg">
          {{ $t('demos.vben.about.coreFeatures') }}
        </h5>
      </div>
      <div class="mt-4">
        <dl class="grid grid-cols-1 md:grid-cols-2">
          <div class="border-border border-t px-4 py-6 sm:col-span-1 sm:px-0">
            <dt class="text-foreground text-sm font-medium leading-6">
              {{ $t('demos.vben.about.features.projectManagement.title') }}
            </dt>
            <dd class="text-foreground mt-1 text-sm leading-6 sm:mt-2">
              {{ $t('demos.vben.about.features.projectManagement.desc') }}
            </dd>
          </div>
          <div class="border-border border-t px-4 py-6 sm:col-span-1 sm:px-0">
            <dt class="text-foreground text-sm font-medium leading-6">
              {{ $t('demos.vben.about.features.packageDeploy.title') }}
            </dt>
            <dd class="text-foreground mt-1 text-sm leading-6 sm:mt-2">
              {{ $t('demos.vben.about.features.packageDeploy.desc') }}
            </dd>
          </div>
          <div class="border-border border-t px-4 py-6 sm:col-span-1 sm:px-0">
            <dt class="text-foreground text-sm font-medium leading-6">
              {{ $t('demos.vben.about.features.deployTools.title') }}
            </dt>
            <dd class="text-foreground mt-1 text-sm leading-6 sm:mt-2">
              {{ $t('demos.vben.about.features.deployTools.desc') }}
            </dd>
          </div>
          <div class="border-border border-t px-4 py-6 sm:col-span-1 sm:px-0">
            <dt class="text-foreground text-sm font-medium leading-6">
              {{ $t('demos.vben.about.features.notification.title') }}
            </dt>
            <dd class="text-foreground mt-1 text-sm leading-6 sm:mt-2">
              {{ $t('demos.vben.about.features.notification.desc') }}
            </dd>
          </div>
          <div class="border-border border-t px-4 py-6 sm:col-span-1 sm:px-0">
            <dt class="text-foreground text-sm font-medium leading-6">
              {{ $t('demos.vben.about.features.userManagement.title') }}
            </dt>
            <dd class="text-foreground mt-1 text-sm leading-6 sm:mt-2">
              {{ $t('demos.vben.about.features.userManagement.desc') }}
            </dd>
          </div>
          <div class="border-border border-t px-4 py-6 sm:col-span-1 sm:px-0">
            <dt class="text-foreground text-sm font-medium leading-6">
              {{ $t('demos.vben.about.features.businessLine.title') }}
            </dt>
            <dd class="text-foreground mt-1 text-sm leading-6 sm:mt-2">
              {{ $t('demos.vben.about.features.businessLine.desc') }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- 技术架构 -->
    <div class="card-box mt-6 p-5">
      <div>
        <h5 class="text-foreground text-lg">
          {{ $t('demos.vben.about.architecture') }}
        </h5>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- 后端架构 -->
        <div class="border-border border-t px-4 py-6 sm:px-0">
          <dt class="text-foreground mb-3 text-sm font-medium leading-6">
            {{ $t('demos.vben.about.backend') }}
          </dt>
          <dd class="text-foreground space-y-2 text-sm leading-6">
            <div
              v-for="techKey in backendTechs"
              :key="techKey"
              class="flex items-start"
            >
              <span class="mr-2">•</span>
              <span>{{ $t(techKey) }}</span>
            </div>
          </dd>
        </div>

        <!-- 前端架构 -->
        <div class="border-border border-t px-4 py-6 sm:px-0">
          <dt class="text-foreground mb-3 text-sm font-medium leading-6">
            {{ $t('demos.vben.about.frontend') }}
          </dt>
          <dd class="text-foreground space-y-2 text-sm leading-6">
            <div
              v-for="techKey in frontendTechs"
              :key="techKey"
              class="flex items-start"
            >
              <span class="mr-2">•</span>
              <span>{{ $t(techKey) }}</span>
            </div>
          </dd>
        </div>
      </div>
    </div>
  </Page>
</template>
