<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import {
  createDeployAgent,
  getDeployAgentDetail,
  updateDeployAgent,
} from '#/api/deploy-tools/deploy-agent';
import type {
  CreateDeployAgentParams,
  UpdateDeployAgentParams,
} from '#/api/deploy-tools/deploy-agent';
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

      // 只有在编辑时（有 id）才获取详情
      if (data && data.id) {
        try {
          const detail = await getDeployAgentDetail(data.id);
          formApi.setValues({
            ...detail,
            businessLineId: detail.businessLineId,
          });
        } catch {
          message.error('获取详情失败，请重试');
          formApi.setValues({
            ...data,
            businessLineId: data.businessLineId,
          });
        }
      } else {
        // 新建时，设置业务线默认值
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
    ? $t('ui.actionTitle.edit', [$t('deploy.tools.deployAgent.name')])
    : $t('ui.actionTitle.create', [$t('deploy.tools.deployAgent.name')]),
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
      const updateData: UpdateDeployAgentParams = {
        id: id.value,
        name: values.name,
        description: values.description,
        deployEnvironmentIds: values.deployEnvironmentIds || [],
      };
      await updateDeployAgent(updateData);
      message.success($t('ui.successMessage.update'));
      emits('success');
    } else {
      // 创建
      const createData: CreateDeployAgentParams = {
        businessLineId: values.businessLineId,
        name: values.name,
        description: values.description,
        deployEnvironmentIds: values.deployEnvironmentIds || [],
      };
      const result = await createDeployAgent(createData);
      message.success($t('ui.successMessage.create'));

      // 触发成功事件，传递 token 给父组件显示（仅创建时有 token）
      emits('success', result.token);
    }
    drawerApi.close();
  } catch (error: any) {
    message.error(error?.message || '保存失败');
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
