<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createCdnConfig,
  getCdnConfigDetail,
  updateCdnConfig,
} from '#/api/deploy-tools/cdn-config';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const businessStore = useBusinessStore();
const id = ref<string>();
const loading = ref(false);

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    await handleConfirm();
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<any>();
    formApi.resetForm();
    id.value = data?.id;

    await nextTick();

    if (data?.id) {
      try {
        const detail = await getCdnConfigDetail(data.id);
        formApi.setValues({
          name: detail.name,
          provider: detail.provider,
          businessLineId: detail.businessLineId,
          aliAccessKey: detail.aliAccessKey || '',
          aliAccessSecret: detail.aliAccessSecret || '',
          ecloudDomain: detail.ecloudDomain || '',
          ecloudId: detail.ecloudId || '',
          ecloudKey: detail.ecloudKey || '',
          cdnDomains: detail.cdnDomains || '',
        });
      } catch {
        message.error('获取详情失败');
      }
    } else {
      const currentBusinessLine = businessStore.currentBusinessLine;
      const defaultBusinessLineId = currentBusinessLine?.businessLine.id;
      formApi.setValues({
        provider: 'ali',
        ...(defaultBusinessLineId ? { businessLineId: defaultBusinessLineId } : {}),
      });
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('deploy.tools.cdnConfig.name')])
    : $t('ui.actionTitle.create', [$t('deploy.tools.cdnConfig.name')]),
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  const values = await formApi.getValues();
  loading.value = true;
  drawerApi.lock();

  try {
    if (id.value) {
      await updateCdnConfig(id.value, values);
      message.success($t('ui.successMessage.update'));
    } else {
      await createCdnConfig(values);
      message.success($t('ui.successMessage.create'));
    }
    emits('success');
    drawerApi.close();
  } catch {
    drawerApi.unlock();
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <Drawer :title="title">
    <Form />
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
        <Button type="primary" :loading="loading" @click="handleConfirm">
          {{ $t('common.confirm') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
