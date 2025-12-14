<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { Card, Empty } from 'ant-design-vue';

import { $t } from '#/locales';
</script>

<template>
  <Page auto-content-height>
    <Card>
      <div class="flex h-96 items-center justify-center">
        <Empty :description="`${$t('notification.scenario.title')} - 开发中`" />
      </div>
    </Card>
  </Page>
</template>

<style scoped></style>
