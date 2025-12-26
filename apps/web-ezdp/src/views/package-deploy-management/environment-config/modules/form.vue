<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createDeployEnvironment,
  getDeployEnvironmentDetail,
  updateDeployEnvironment,
} from '#/api/project-management/deploy-environment';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const businessStore = useBusinessStore();

const formData = ref<any>();

const id = ref<string>();
const loading = ref(false);

// 保存上一次的业务线ID，用于判断是否变化
const previousBusinessLineId = ref<number | undefined>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    // 监听业务线ID变化，清空前端环境和后端集群的已选择值
    if (changedFields.includes('businessLineId')) {
      const newBusinessLineId = values.businessLineId;
      // 如果业务线ID发生变化（且不是初始化时），清空前端环境和后端集群
      if (
        previousBusinessLineId.value !== undefined &&
        newBusinessLineId !== previousBusinessLineId.value
      ) {
        await formApi.setFieldValue('frontendStorageId', undefined);
        await formApi.setFieldValue('backendSecretId', undefined);
      }
      previousBusinessLineId.value = newBusinessLineId;
    }
  },
});
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
          const detail = await getDeployEnvironmentDetail(data.id);
          // 重置 previousBusinessLineId
          previousBusinessLineId.value = detail.businessLineId;
          formApi.setValues({
            name: detail.name,
            sortOrder: detail.sortOrder || 0,
            description: detail.description || '',
            frontendStorageId: detail.frontendStorageId || '',
            frontendBaseUrl: detail.frontendBaseUrl || '',
            backendSecretId: detail.backendSecretId || '',
            backendNamespace: detail.backendNamespace || '',
            businessLineId: detail.businessLineId,
            isAgentDeploy: detail.isAgentDeploy || false,
          });
        } catch (error: any) {
          console.error('获取详情失败:', error);
          message.error('获取详情失败，请重试');
          // 如果获取详情失败，使用列表数据
          previousBusinessLineId.value = data.businessLineId;
          formApi.setValues({
            name: data.name,
            sortOrder: data.sortOrder || 0,
            description: data.description || '',
            frontendStorageId: data.frontendStorageId || '',
            frontendBaseUrl: data.frontendBaseUrl || '',
            backendSecretId: data.backendSecretId || '',
            backendNamespace: data.backendNamespace || '',
            businessLineId: data.businessLineId,
            isAgentDeploy: data.isAgentDeploy || false,
          });
        }
      } else {
        // 新建时，设置业务线默认值（使用当前业务线ID）
        const currentBusinessLine = businessStore.currentBusinessLine;
        const defaultBusinessLineId = currentBusinessLine?.businessLine.id;
        if (defaultBusinessLineId) {
          previousBusinessLineId.value = defaultBusinessLineId;
          formApi.setValues({
            businessLineId: defaultBusinessLineId,
            isAgentDeploy: false, // 默认为非Agent环境
          });
        } else {
          previousBusinessLineId.value = undefined;
        }
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', ['发布环境配置'])
    : $t('ui.actionTitle.create', ['发布环境配置']),
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();

  // isAgentDeploy字段（默认为false）
  const isAgentDeploy = values.isAgentDeploy || false;

  // 验证逻辑：
  // - 如果是Agent环境：不允许配置前端/后端
  // - 如果不是Agent环境：必须配置前端或后端之一
  if (isAgentDeploy) {
    // Agent环境：检查是否尝试配置了前端/后端
    if (values.frontendStorageId || values.frontendBaseUrl ||
        values.backendSecretId || values.backendNamespace) {
      message.error(
        $t('deploy.packageDeployManagement.environmentConfig.agentEnvNotAllowedFrontendBackend'),
      );
      return;
    }
  } else {
    // 非Agent环境：必须配置前端或后端之一
    const hasFrontend = !!(values.frontendStorageId || values.frontendBaseUrl);
    const hasBackend = !!(values.backendSecretId && values.backendNamespace);

    if (!hasFrontend && !hasBackend) {
      message.error(
        $t(
          'deploy.packageDeployManagement.environmentConfig.atLeastOneTargetRequired',
        ),
      );
      return;
    }
  }

  loading.value = true;

  // 构建提交数据
  const submitData: any = {
    name: values.name,
  };

  // sortOrder字段（如果提供了则使用，否则后端会自动设置）
  if (values.sortOrder !== undefined && values.sortOrder !== null) {
    submitData.sortOrder = values.sortOrder;
  }

  // 只在有值时提交
  if (values.description) {
    submitData.description = values.description;
  }

  // Agent环境不提交前端/后端字段，非Agent环境正常提交
  if (!isAgentDeploy) {
    if (values.frontendStorageId) {
      submitData.frontendStorageId = values.frontendStorageId;
    }
    if (values.frontendBaseUrl) {
      submitData.frontendBaseUrl = values.frontendBaseUrl;
    }
    if (values.backendSecretId) {
      submitData.backendSecretId = values.backendSecretId;
    }
    if (values.backendNamespace) {
      submitData.backendNamespace = values.backendNamespace;
    }
  }

  // isAgentDeploy字段
  submitData.isAgentDeploy = isAgentDeploy;

  // 业务线ID（如果表单中有，则使用；否则后端会从token自动获取）
  if (values.businessLineId) {
    submitData.businessLineId = values.businessLineId;
  }

  try {
    if (id.value) {
      await updateDeployEnvironment(id.value, submitData);
      message.success($t('ui.successMessage.update'));
    } else {
      await createDeployEnvironment(submitData);
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
