<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createBuildAgent,
  getBuildAgentDetail,
  updateBuildAgent,
} from '#/api/deploy-tools/build-agent';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

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
      formApi.resetForm();

      // 设置业务线默认值（使用当前业务线ID）
      await nextTick();
      const currentBusinessLine = businessStore.currentBusinessLine;
      const defaultBusinessLineId = currentBusinessLine?.businessLine.id;
      if (defaultBusinessLineId) {
        formApi.setValues({
          businessLineId: defaultBusinessLineId,
        });
      }
    }
  },
});

const title = computed(() => '创建Agent Token');

// 手动触发确认
async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();
  drawerApi.lock();

  // 如果表单中没有 businessLineId（非超级管理员），使用当前业务线ID
  const businessLineId = values.businessLineId || businessStore.currentBusinessLine?.businessLine?.id;

  if (!businessLineId) {
    message.error('无法获取业务线ID，请刷新页面重试');
    drawerApi.unlock();
    return;
  }

  const submitData: any = {
    businessLineId: businessLineId,
    description: values.description || '',
  };

  try {
    // 创建Token
    const response = await createBuildAgent(submitData);
    message.success('Token创建成功！Agent使用此Token连接并上报信息后完成注册');
    // 传递 token 给父组件显示
    emits('success', response.token);
    drawerApi.close();
  } catch (error: any) {
    console.error('创建失败:', error);
    drawerApi.unlock();
  }
}

defineExpose({
  drawerApi,
});
</script>
<template>
  <Drawer :title="title">
    <Form />
  </Drawer>
</template>

