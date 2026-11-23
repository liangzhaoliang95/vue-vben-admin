<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createScheduledTaskApi,
  updateScheduledTaskApi,
} from '#/api/package-deploy-management/scheduled-task';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const businessStore = useBusinessStore();
const isSuperAdmin = businessStore.currentRole?.isSuper === true;

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

    if (data && data.id) {
      id.value = data.id;
      await nextTick();
      formApi.setValues({
        name: data.name,
        cronExpression: data.cronExpression,
        taskType: data.taskType,
        businessLineId: data.businessLineId,
        branchId: data.branchId,
      });
    } else {
      id.value = undefined;
      await nextTick();
      const defaultBusinessLineId =
        businessStore.currentBusinessLine?.businessLine.id ??
        businessStore.currentBusinessLineId;
      if (defaultBusinessLineId && isSuperAdmin) {
        formApi.setValues({ businessLineId: defaultBusinessLineId });
      }
      formApi.setValues({ enabled: true });
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('scheduledTask.title')])
    : $t('ui.actionTitle.create', [$t('scheduledTask.title')]),
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  const values = await formApi.getValues();
  loading.value = true;

  try {
    if (id.value) {
      await updateScheduledTaskApi({
        id: id.value,
        name: values.name,
        cronExpression: values.cronExpression,
        taskType: values.taskType,
        branchId: values.branchId,
      });
      message.success($t('scheduledTask.message.updateSuccess'));
    } else {
      await createScheduledTaskApi({
        name: values.name,
        cronExpression: values.cronExpression,
        taskType: values.taskType,
        branchId: values.branchId,
        enabled: values.enabled ?? true,
        businessLineId: values.businessLineId,
      });
      message.success($t('scheduledTask.message.createSuccess'));
    }

    drawerApi.close();
    emits('success');
  } catch {
    // 错误信息由全局拦截器统一处理
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Drawer :title="title">
    <Form />

    <template #footer>
      <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
      <Button :loading="loading" type="primary" @click="handleConfirm">
        {{ $t('common.confirm') }}
      </Button>
    </template>
  </Drawer>
</template>
