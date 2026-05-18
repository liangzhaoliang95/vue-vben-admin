<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Select } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createBranchManagement,
  getBranchManagementList,
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
const parentBranchId = ref<string | undefined>(undefined);
const branchOptions = ref<{ label: string; value: string }[]>([]);

async function loadBranchOptions() {
  const businessLineId =
    businessStore.currentBusinessLine?.businessLine.id ??
    businessStore.currentBusinessLineId;
  const res = await getBranchManagementList({
    page: 1,
    pageSize: 1000,
    businessLineId,
  });
  branchOptions.value = (res.items || []).map((item: any) => ({
    label: item.name,
    value: item.id,
  }));
}

const [Form, formApi] = useVbenForm({
  schema: [
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
      component: 'Input',
      componentProps: {
        placeholder: '可选：如 5.66.4{{number:3}}',
      },
      fieldName: 'versionTemplate',
      help: '仅支持 {{number:N}}，如 {{number:3}} -> 001',
      label: '版本号模板',
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
  ],
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
      parentBranchId.value = undefined;

      await nextTick();
      await loadBranchOptions();

      if (data && data.id) {
        id.value = data.id;
        parentBranchId.value = data.parentBranchId || undefined;
        formApi.setValues({
          name: data.name,
          versionTemplate: data.versionTemplate || '',
          sortOrder: data.sortOrder || 0,
          description: data.description || '',
          businessLineId: data.businessLineId,
        });
      } else {
        id.value = undefined;
        const defaultBusinessLineId =
          businessStore.currentBusinessLine?.businessLine.id;
        if (defaultBusinessLineId && isSuperAdmin) {
          formApi.setValues({ businessLineId: defaultBusinessLineId });
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

  const submitData: any = {
    name: values.name,
    versionTemplate: values.versionTemplate?.trim() || '',
    description: values.description,
    parentBranchId: parentBranchId.value ?? '',
  };

  if (values.sortOrder !== undefined && values.sortOrder !== null) {
    submitData.sortOrder = values.sortOrder;
  }

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
    <div class="mb-5 flex items-start gap-2 px-2">
      <label class="w-[100px] shrink-0 pt-1 text-right text-sm">
        {{ $t('deploy.packageDeployManagement.branchManagement.parentBranch') }}
      </label>
      <div class="flex-1">
        <Select
          v-model:value="parentBranchId"
          :options="branchOptions"
          :placeholder="$t('deploy.packageDeployManagement.branchManagement.parentBranchPlaceholder')"
          :allow-clear="true"
          :show-search="true"
          :filter-option="(input: string, option: any) => option.label.toLowerCase().includes(input.toLowerCase())"
          class="w-full"
        />
        <div class="mt-1 text-xs text-gray-400">
          {{ $t('deploy.packageDeployManagement.branchManagement.parentBranchHelp') }}
        </div>
      </div>
    </div>
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
