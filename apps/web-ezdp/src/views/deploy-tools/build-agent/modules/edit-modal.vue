<script lang="ts" setup>
import type { BuildAgentApi } from '#/api/deploy-tools/build-agent';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { updateBuildAgent } from '#/api/deploy-tools/build-agent';
import { $t } from '#/locales';

const emits = defineEmits(['success']);

const agentId = ref<string>('');

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('deploy.tools.buildAgent.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('deploy.tools.buildAgent.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('deploy.tools.buildAgent.descriptionPlaceholder'),
        rows: 3,
      },
      fieldName: 'description',
      label: $t('deploy.tools.buildAgent.description'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 10,
        placeholder: $t('deploy.tools.buildAgent.maxConcurrentTasksPlaceholder'),
        style: { width: '100%' },
      },
      fieldName: 'maxConcurrentTasks',
      label: $t('deploy.tools.buildAgent.maxConcurrentTasks'),
    },
    {
      component: 'Switch',
      fieldName: 'sharedEnabled',
      label: $t('deploy.tools.buildAgent.sharedEnabled'),
      help: $t('deploy.tools.buildAgent.sharedEnabledHelp'),
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    modalApi.lock();
    try {
      await updateBuildAgent(agentId.value, {
        name: values.name,
        description: values.description || '',
        maxConcurrentTasks: values.maxConcurrentTasks,
        sharedEnabled: values.sharedEnabled ?? false,
      });
      message.success($t('common.updateSuccess'));
      emits('success');
      modalApi.close();
    } catch (error: any) {
      message.error(error.message || $t('common.operationFailed'));
      modalApi.unlock();
    }
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<BuildAgentApi.BuildAgent>();
      if (data) {
        agentId.value = data.id;
        await formApi.setValues({
          name: data.name,
          description: data.description,
          maxConcurrentTasks: data.maxConcurrentTasks,
          sharedEnabled: data.sharedEnabled ?? false,
        });
      }
    }
  },
});

defineExpose({ modalApi });
</script>

<template>
  <Modal :title="$t('deploy.tools.buildAgent.edit')">
    <Form />
  </Modal>
</template>
