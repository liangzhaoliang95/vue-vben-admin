<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createAnnouncement,
  updateAnnouncement,
} from '#/api/core/announcement';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const businessStore = useBusinessStore();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const id = ref<string>();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    await handleConfirm();
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<any>();
      formApi.resetForm();

      if (data && data.id) {
        id.value = data.id;
        await nextTick();
        formApi.setValues({
          title: data.title,
          content: data.content,
          linkUrl: data.linkUrl || '',
          sortOrder: data.sortOrder ?? 0,
          isEnabled: data.isEnabled ?? true,
        });
      } else {
        id.value = undefined;
        await nextTick();
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('notification.announcement.name')])
    : $t('ui.actionTitle.create', [$t('notification.announcement.name')]),
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  const values = await formApi.getValues();
  drawerApi.lock();

  try {
    if (id.value) {
      await updateAnnouncement({
        id: id.value,
        title: values.title,
        content: values.content,
        linkUrl: values.linkUrl || undefined,
        sortOrder: values.sortOrder ?? 0,
        isEnabled: values.isEnabled ?? true,
      });
      message.success($t('ui.successMessage.update'));
    } else {
      await createAnnouncement({
        title: values.title,
        content: values.content,
        linkUrl: values.linkUrl || undefined,
        isEnabled: values.isEnabled ?? true,
      });
      message.success($t('ui.successMessage.create'));
    }
    emits('success');
    drawerApi.close();
  } catch (error: any) {
    message.error(error?.message || '保存失败');
    drawerApi.unlock();
  }
}
</script>
<template>
  <Drawer :title="title">
    <Form />
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
        <Button type="primary" @click="handleConfirm">
          {{ $t('common.confirm') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
