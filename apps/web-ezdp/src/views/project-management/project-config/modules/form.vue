<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createProjectConfig,
  getProjectConfigDetail,
  updateProjectConfig,
} from '#/api/project-management/project-config';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const businessStore = useBusinessStore();

const formData = ref<any>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-12 gap-x-4 gap-y-4',
});

const id = ref<string>();
const loading = ref(false);
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
        // 编辑时，获取详情
        try {
          const detail = await getProjectConfigDetail(data.id);
          formApi.setValues({
            name: detail.name,
            projectId: detail.projectId,
            projectUrl: detail.projectUrl,
            type: detail.type,
            businessLineId: detail.businessLineId,
          });
        } catch (error: any) {
          console.error('获取详情失败:', error);
          // 如果获取详情失败，使用列表数据
          formApi.setValues({
            name: data.name,
            projectId: data.projectId,
            projectUrl: data.projectUrl,
            type: data.type,
            businessLineId: data.businessLineId,
          });
        }
      } else {
        // 新建时，设置业务线默认值（使用当前业务线ID）
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
    ? $t('ui.actionTitle.edit', [
        $t('deploy.projectManagement.projectConfig.title'),
      ])
    : $t('ui.actionTitle.create', [
        $t('deploy.projectManagement.projectConfig.title'),
      ]),
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();

  loading.value = true;

  // 构建提交数据，过滤空字符串的可选字段
  const submitData: any = {
    name: values.name,
    projectUrl: values.projectUrl,
    type: values.type,
  };

  // 业务线ID（如果表单中有，则使用；否则后端会从context自动获取）
  if (values.businessLineId) {
    submitData.businessLineId = values.businessLineId;
  }

  // 项目ID可选
  if (values.projectId) submitData.projectId = values.projectId;

  try {
    if (id.value) {
      // 更新
      await updateProjectConfig(id.value, submitData);
      message.success($t('ui.successMessage.update'));
    } else {
      // 创建
      await createProjectConfig(submitData);
      message.success($t('ui.successMessage.create'));
    }

    drawerApi.close();
    emits('success');
  } catch (error: any) {
    console.error('保存失败:', error);
    // 错误信息由全局拦截器处理
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
      <Button type="primary" :loading="loading" @click="handleConfirm">
        {{ $t('common.confirm') }}
      </Button>
    </template>
  </Drawer>
</template>
