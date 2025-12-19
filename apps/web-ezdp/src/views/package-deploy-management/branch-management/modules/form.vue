<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createBranchManagement,
  updateBranchManagement,
} from '#/api/package-deploy-management/branch-management';
import { $t } from '#/locales';

interface Emits {
  (e: 'success'): void;
}

const emits = defineEmits<Emits>();

const businessStore = useBusinessStore();
const isSuperAdmin = businessStore.currentRole?.isSuper === true;

const id = ref<string>();
const loading = ref(false);

const formSchema = computed(() => [
  {
    component: 'Input',
    componentProps: {
      placeholder: $t(
        'deploy.packageDeployManagement.branchManagement.namePlaceholder',
      ),
    },
    fieldName: 'name',
    label: $t('deploy.packageDeployManagement.branchManagement.name'),
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: {
      placeholder: $t(
        'deploy.packageDeployManagement.branchManagement.sortOrderPlaceholder',
      ),
      min: 0,
      style: { width: '100%' },
    },
    fieldName: 'sortOrder',
    label: $t('deploy.packageDeployManagement.branchManagement.sortOrder'),
  },
  {
    component: 'Textarea',
    componentProps: {
      placeholder: $t(
        'deploy.packageDeployManagement.branchManagement.descriptionPlaceholder',
      ),
      rows: 3,
    },
    fieldName: 'description',
    label: $t('deploy.packageDeployManagement.branchManagement.description'),
    rules: 'required',
  },
]);

const [Form, formApi] = useVbenForm({
  schema: formSchema.value,
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

      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();

      if (data && data.id) {
        // 编辑时，设置表单数据
        id.value = data.id;
        formApi.setValues({
          name: data.name,
          sortOrder: data.sortOrder || 0,
          description: data.description || '',
          businessLineId: data.businessLineId,
        });
      } else {
        // 新建时，设置业务线默认值（使用当前业务线ID）
        id.value = undefined;
        const currentBusinessLine = businessStore.currentBusinessLine;
        const defaultBusinessLineId = currentBusinessLine?.businessLine.id;
        if (defaultBusinessLineId && isSuperAdmin) {
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
        $t('deploy.packageDeployManagement.branchManagement.title'),
      ])
    : $t('ui.actionTitle.create', [
        $t('deploy.packageDeployManagement.branchManagement.title'),
      ]),
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();

  loading.value = true;

  // 构建提交数据
  const submitData: any = {
    name: values.name,
    description: values.description,
  };

  // sortOrder字段（如果提供了则使用，否则后端会自动设置）
  if (values.sortOrder !== undefined && values.sortOrder !== null) {
    submitData.sortOrder = values.sortOrder;
  }

  // 业务线ID（如果表单中有，则使用；否则后端会从token自动获取）
  if (values.businessLineId) {
    submitData.businessLineId = values.businessLineId;
  }

  try {
    if (id.value) {
      await updateBranchManagement(id.value, submitData);
      message.success($t('ui.successMessage.update'));
    } else {
      await createBranchManagement(submitData);
      message.success($t('ui.successMessage.create'));
    }
    emits('success');
    drawerApi.close();
  } catch (error: any) {
    console.error('保存失败:', error);
    message.error(error?.message || '保存失败');
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <Drawer :title="title">
    <Form />
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
        <Button type="primary" :loading="loading" @click="handleConfirm">
          {{ $t('common.confirm') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
