<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { ServerManagementApi } from '#/api/server-management';
import { $t } from '#/locales';

const emits = defineEmits<{
  success: [token?: string];
}>();

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('serverManagement.environmentAgent.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('serverManagement.environmentAgent.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('serverManagement.environmentAgent.descriptionPlaceholder'),
        rows: 3,
      },
      fieldName: 'description',
      label: $t('serverManagement.environmentAgent.description'),
    },
  ],
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

      if (data) {
        id.value = data.id;
      } else {
        id.value = undefined;
      }

      await nextTick();

      if (data && data.id) {
        formApi.setValues({
          name: data.name,
          description: data.description,
        });
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('serverManagement.environmentAgent.edit')
    : $t('serverManagement.environmentAgent.create'),
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  const values = await formApi.getValues();
  drawerApi.lock();

  try {
    if (id.value) {
      await ServerManagementApi.updateEnvironmentAgent({
        id: id.value,
        name: values.name,
        description: values.description,
      });
      message.success($t('serverManagement.environmentAgent.updateSuccess'));
      emits('success');
    } else {
      const result = await ServerManagementApi.createEnvironmentAgent({
        name: values.name,
        description: values.description,
      });
      message.success($t('serverManagement.environmentAgent.createSuccess'));
      emits('success', result.token);
    }
    drawerApi.close();
  } catch (error: any) {
    message.error(error?.message || $t('common.saveFailed'));
    drawerApi.unlock();
  }
}

defineExpose({
  drawerApi,
  formApi,
});
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
