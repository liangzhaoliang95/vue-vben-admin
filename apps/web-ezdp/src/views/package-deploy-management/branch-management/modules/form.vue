<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, Input, message, Modal, Select } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  checkBranchVersionConflict,
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

// 起始版本号相关状态
const initialVersionInput = ref<string>('');
const initialVersionPrefix = ref<string>(''); // 模板前缀 或 分支名.
const initialVersionSuffix = ref<string>(''); // 模板后缀
const initialVersionWidth = ref<number>(0);
const hasVersionTemplate = ref<boolean>(false);
const isInitializingForm = ref(false);

const currentBranchName = computed(() =>
  String(formApi.form.values?.name || '').trim(),
);

const resolvedInitialVersionPrefix = computed(() => {
  if (initialVersionPrefix.value) {
    return initialVersionPrefix.value;
  }
  if (!hasVersionTemplate.value && currentBranchName.value) {
    return `${currentBranchName.value}.`;
  }
  return '';
});

// 解析版本号模板
function parseVersionTemplate(template: string): {
  prefix: string;
  suffix: string;
  valid: boolean;
  width: number;
} {
  if (!template) return { prefix: '', suffix: '', width: 0, valid: false };
  const match = template.match(/^(.*?)\{\{number:([1-9]\d*)\}\}(.*)$/);
  if (!match) return { prefix: '', suffix: '', width: 0, valid: false };
  const prefix = match[1] ?? '';
  const width = Number.parseInt(match[2] ?? '0', 10);
  const suffix = match[3] ?? '';
  if (!prefix && !suffix)
    return { prefix: '', suffix: '', width: 0, valid: false };
  return { prefix, suffix, width, valid: true };
}

// 完整起始版本号
const fullInitialVersion = computed(() => {
  if (!initialVersionInput.value) return '';
  return (
    resolvedInitialVersionPrefix.value +
    initialVersionInput.value +
    initialVersionSuffix.value
  );
});

// 占位符 placeholder
const initialVersionInputPlaceholder = computed(() => {
  if (hasVersionTemplate.value && initialVersionWidth.value > 0) {
    return '0'.repeat(initialVersionWidth.value);
  }
  return '数字';
});

// 当版本号模板或分支名变化时，更新前缀/后缀/宽度
function syncTemplateState(template: string, branchName: string) {
  const parsed = parseVersionTemplate(template || '');
  hasVersionTemplate.value = parsed.valid;
  if (parsed.valid) {
    initialVersionPrefix.value = parsed.prefix;
    initialVersionSuffix.value = parsed.suffix;
    initialVersionWidth.value = parsed.width;
  } else {
    // 无模板：前缀为 "分支名."
    initialVersionPrefix.value = branchName ? `${branchName}.` : '';
    initialVersionSuffix.value = '';
    initialVersionWidth.value = 0;
  }
}

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

function extractInitialVersionInput(savedInitialVersion: string) {
  if (!savedInitialVersion) {
    return '';
  }

  let numPart = savedInitialVersion;
  if (
    resolvedInitialVersionPrefix.value &&
    numPart.startsWith(resolvedInitialVersionPrefix.value)
  ) {
    numPart = numPart.slice(resolvedInitialVersionPrefix.value.length);
  }
  if (
    initialVersionSuffix.value &&
    numPart.endsWith(initialVersionSuffix.value)
  ) {
    numPart = numPart.slice(
      0,
      numPart.length - initialVersionSuffix.value.length,
    );
  }
  return numPart;
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
        placeholder: $t(
          'deploy.packageDeployManagement.branchManagement.versionTemplatePlaceholder',
        ),
      },
      fieldName: 'versionTemplate',
      help: $t(
        'deploy.packageDeployManagement.branchManagement.versionTemplateHelp',
      ),
      label: $t(
        'deploy.packageDeployManagement.branchManagement.versionTemplate',
      ),
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
  handleValuesChange: async (values, fieldsChanged) => {
    if (isInitializingForm.value) {
      return;
    }
    if (
      fieldsChanged.includes('name') ||
      fieldsChanged.includes('versionTemplate')
    ) {
      syncTemplateState(
        String(values.versionTemplate || ''),
        String(values.name || ''),
      );
      initialVersionInput.value = '';
    }
  },
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    await handleConfirm();
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      isInitializingForm.value = true;
      const data = drawerApi.getData<any>();
      formApi.resetForm();
      parentBranchId.value = undefined;
      initialVersionInput.value = '';
      initialVersionPrefix.value = '';
      initialVersionSuffix.value = '';
      initialVersionWidth.value = 0;
      hasVersionTemplate.value = false;

      await nextTick();
      await loadBranchOptions();

      if (data && data.id) {
        id.value = data.id;
        parentBranchId.value = data.parentBranchId || undefined;

        const template = data.versionTemplate || '';
        const branchName = data.name || '';

        await formApi.setValues({
          name: branchName,
          versionTemplate: template,
          sortOrder: data.sortOrder || 0,
          description: data.description || '',
          businessLineId: data.businessLineId,
        });
        syncTemplateState(template, branchName);
        initialVersionInput.value = extractInitialVersionInput(
          data.initialVersion || '',
        );
      } else {
        id.value = undefined;
        const defaultBusinessLineId =
          businessStore.currentBusinessLine?.businessLine.id;
        if (defaultBusinessLineId && isSuperAdmin) {
          formApi.setValues({ businessLineId: defaultBusinessLineId });
        }
      }
      await nextTick();
      isInitializingForm.value = false;
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

// 校验起始版本号输入
function validateInitialVersionInput(): null | string {
  const input = initialVersionInput.value;
  if (!input) return null;

  if (hasVersionTemplate.value) {
    if (
      initialVersionWidth.value > 0 &&
      input.length !== initialVersionWidth.value
    ) {
      return `占位符部分长度应为 ${initialVersionWidth.value} 位`;
    }
    if (!/^\d+$/.test(input)) {
      return '占位符部分必须为数字';
    }
  } else {
    if (!/^\d+$/.test(input)) {
      return '起始版本号数字部分必须为纯数字';
    }
  }
  return null;
}

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  const inputError = validateInitialVersionInput();
  if (inputError) {
    message.error(inputError);
    return;
  }

  const values = await formApi.getValues();

  const submitData: any = {
    name: values.name,
    versionTemplate: values.versionTemplate?.trim() || '',
    initialVersion: fullInitialVersion.value,
    description: values.description,
    parentBranchId: parentBranchId.value ?? '',
  };

  if (values.sortOrder !== undefined && values.sortOrder !== null) {
    submitData.sortOrder = values.sortOrder;
  }

  if (values.businessLineId) {
    submitData.businessLineId = values.businessLineId;
  }

  // 提交前调用检查接口
  try {
    const checkResult = await checkBranchVersionConflict({
      id: id.value,
      name: submitData.name,
      versionTemplate: submitData.versionTemplate,
      initialVersion: submitData.initialVersion,
      businessLineId: submitData.businessLineId,
    });

    if (checkResult.hasConflict) {
      // 有冲突，弹出确认框让用户决定
      Modal.confirm({
        title: '版本号冲突提示',
        content: checkResult.message,
        okText: '忽略冲突，继续提交',
        cancelText: '取消',
        onOk: () => doSubmit(submitData),
      });
      return;
    }
  } catch {
    // 检查接口失败不阻断提交流程
  }

  await doSubmit(submitData);
}

async function doSubmit(submitData: any) {
  loading.value = true;
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
  } catch {
    // 错误已由请求拦截器统一弹出，此处无需重复提示
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <Drawer :title="title">
    <Form />

    <!-- 起始版本号输入框（在版本号模板下方） -->
    <div class="mb-5 flex items-start gap-2 px-2">
      <label class="w-[100px] shrink-0 pt-1 text-right text-sm">
        {{
          $t('deploy.packageDeployManagement.branchManagement.initialVersion')
        }}
      </label>
      <div class="flex-1">
        <Input
          v-model:value="initialVersionInput"
          :addon-before="resolvedInitialVersionPrefix || undefined"
          :addon-after="initialVersionSuffix || undefined"
          :placeholder="initialVersionInputPlaceholder"
          :maxlength="
            hasVersionTemplate && initialVersionWidth > 0
              ? initialVersionWidth
              : undefined
          "
        />
        <div class="mt-1 text-xs text-gray-400">
          {{
            $t(
              'deploy.packageDeployManagement.branchManagement.initialVersionHelp',
            )
          }}
        </div>
      </div>
    </div>

    <div class="mb-5 flex items-start gap-2 px-2">
      <label class="w-[100px] shrink-0 pt-1 text-right text-sm">
        {{ $t('deploy.packageDeployManagement.branchManagement.parentBranch') }}
      </label>
      <div class="flex-1">
        <Select
          v-model:value="parentBranchId"
          :options="branchOptions"
          :placeholder="
            $t(
              'deploy.packageDeployManagement.branchManagement.parentBranchPlaceholder',
            )
          "
          :allow-clear="true"
          :show-search="true"
          :filter-option="
            (input: string, option: any) =>
              option.label.toLowerCase().includes(input.toLowerCase())
          "
          class="w-full"
        />
        <div class="mt-1 text-xs text-gray-400">
          {{
            $t(
              'deploy.packageDeployManagement.branchManagement.parentBranchHelp',
            )
          }}
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
