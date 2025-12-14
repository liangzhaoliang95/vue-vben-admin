<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createNotificationChannel,
  updateNotificationChannel,
} from '#/api/core/notification-channel';
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
        // 编辑模式
        id.value = data.id;

        // Wait for Vue to flush DOM updates (form fields mounted)
        await nextTick();

        // 设置表单值
        formApi.setValues({
          businessLineId: data.businessLineId,
          name: data.name,
          type: data.type,
          webhookUrl: data.config?.webhookUrl || '',
          enabled: data.enabled,
        });
      } else {
        // 新建模式
        id.value = undefined;

        await nextTick();

        // 设置业务线默认值（使用当前业务线ID）
        const currentBusinessLine = businessStore.currentBusinessLine;
        const defaultBusinessLineId = currentBusinessLine?.businessLine.id;
        if (defaultBusinessLineId) {
          formApi.setValues({
            businessLineId: defaultBusinessLineId,
          });
        }
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('notification.channel.name')])
    : $t('ui.actionTitle.create', [$t('notification.channel.name')]),
);

// 手动触发确认
async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  const values = await formApi.getValues();
  drawerApi.lock();

  try {
    if (id.value) {
      // 更新
      await updateNotificationChannel({
        id: id.value,
        name: values.name,
        type: values.type,
        config: {
          webhookUrl: values.webhookUrl,
        },
        enabled: values.enabled ?? true,
      });
      message.success($t('ui.successMessage.update'));
    } else {
      // 创建
      // 如果没有 businessLineId（非超级管理员），使用当前业务线 ID
      const businessLineId =
        values.businessLineId ||
        businessStore.currentBusinessLine?.businessLine.id;

      if (!businessLineId) {
        message.error('无法获取业务线信息');
        drawerApi.unlock();
        return;
      }

      await createNotificationChannel({
        businessLineId,
        name: values.name,
        type: values.type,
        config: {
          webhookUrl: values.webhookUrl,
        },
        enabled: values.enabled ?? true,
      });
      message.success($t('ui.successMessage.create'));
    }
    emits('success');
    drawerApi.close();
  } catch (error: any) {
    console.error('保存失败:', error);
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
