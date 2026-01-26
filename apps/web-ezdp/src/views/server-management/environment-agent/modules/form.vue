<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { ServerManagementApi } from '#/api/server-management';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits<{
  success: [token?: string];
}>();

const businessStore = useBusinessStore();
const formData = ref<any>();

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

      if (data) {
        formData.value = data;
        id.value = data.id;
      } else {
        id.value = undefined;
      }

      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();

      // 编辑时设置表单值
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

// 手动触发确认
async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  const values = await formApi.getValues();
  drawerApi.lock();

  try {
    if (id.value) {
      // 编辑
      await ServerManagementApi.updateEnvironmentAgent({
        id: id.value,
        name: values.name,
        description: values.description,
      });
      message.success($t('serverManagement.environmentAgent.updateSuccess'));
      emits('success');
    } else {
      // 创建
      const result = await ServerManagementApi.createEnvironmentAgent({
        name: values.name,
        description: values.description,
      });
      message.success($t('serverManagement.environmentAgent.createSuccess'));

      // 触发成功事件，传递 token 给父组件显示（仅创建时有 token）
      emits('success', result.token);
    }
    drawerApi.close();
  } catch (error: any) {
    message.error(error?.message || $t('common.saveFailed'));
    drawerApi.unlock();
  }
}

// 暴露方法给父组件
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
