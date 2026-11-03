<script setup lang="ts">
import { nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import type { VbenFormSchema } from '@vben/common-ui';
import {
  createEventSubscription,
  testEventSubscriptionWebhook,
  updateEventSubscription,
} from '#/api/core/notification-event-subscription';
import { $t } from '#/locales';

const EVENT_TYPE_OPTIONS = [
  {
    label: $t('notification.eventSubscription.eventTypes.projectBuildCompleted'),
    value: 'project_build_completed',
  },
];

const emits = defineEmits(['success']);

const id = ref<string>();

const formSchema: VbenFormSchema[] = [
  {
    component: 'Select',
    componentProps: {
      options: EVENT_TYPE_OPTIONS,
      placeholder: $t('notification.eventSubscription.selectEventType'),
    },
    fieldName: 'eventType',
    label: $t('notification.eventSubscription.eventType'),
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: $t('notification.eventSubscription.webhookUrlPlaceholder'),
    },
    fieldName: 'webhookUrl',
    label: $t('notification.eventSubscription.webhookUrl'),
    rules: 'required',
  },
  {
    component: 'Checkbox',
    componentProps: {},
    fieldName: 'enabled',
    label: $t('notification.eventSubscription.enabled'),
  },
];

const [Form, formApi] = useVbenForm({
  schema: formSchema,
  showDefaultActions: false,
});

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

        await nextTick();

        formApi.setValues({
          eventType: data.eventType,
          webhookUrl: data.webhookUrl,
          enabled: data.enabled,
        });
      } else {
        // 新增模式
        id.value = undefined;
        formApi.setValues({
          enabled: true,
        });
      }
    }
  },
});

// 测试推送
async function handleTestWebhook() {
  const formData = await formApi.getValues();
  if (!formData.webhookUrl) {
    message.error($t('notification.eventSubscription.webhookUrlRequired'));
    return;
  }

  try {
    await testEventSubscriptionWebhook({
      webhookUrl: formData.webhookUrl,
    });
    message.success($t('notification.eventSubscription.testSuccess'));
  } catch (error: any) {
    message.error(
      error.message || $t('notification.eventSubscription.testFailed'),
    );
  }
}

// 提交表单
async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }

  const formData = await formApi.getValues();

  try {
    if (id.value) {
      await updateEventSubscription({
        id: id.value,
        ...formData,
      });
      message.success($t('notification.eventSubscription.updateSuccess'));
    } else {
      await createEventSubscription(formData);
      message.success($t('notification.eventSubscription.createSuccess'));
    }

    drawerApi.close();
    emits('success');
  } catch (error: any) {
    message.error(
      error.message || $t('notification.eventSubscription.submitFailed'),
    );
  }
}

defineExpose({
  drawerApi,
});
</script>

<template>
  <Drawer
    :footer-buttons="[
      {
        text: $t('notification.eventSubscription.testWebhook'),
        variant: 'default',
        onClick: handleTestWebhook,
      },
    ]"
  >
    <Form />
  </Drawer>
</template>
