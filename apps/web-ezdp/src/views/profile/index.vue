<script lang="ts" setup>
import { Card, Tabs, TabPane } from 'ant-design-vue';
import { $t } from '#/locales';
import MFASettings from '#/components/mfa-settings/index.vue';

defineOptions({ name: 'ProfilePage' });
</script>

<template>
  <div class="p-4 max-w-2xl mx-auto">
    <Card :title="$t('system.mfa.personalSettings')">
      <Tabs default-active-key="mfa">
        <TabPane key="mfa" :tab="$t('system.mfa.title')">
          <MFASettings />
        </TabPane>
      </Tabs>
    </Card>
  </div>
</template>
