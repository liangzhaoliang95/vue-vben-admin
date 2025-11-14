<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createK8sSecret,
  getK8sSecretDetail,
  testK8sConnection,
  updateK8sSecret,
} from '#/api/deploy-tools/k8s-secret';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<any>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const id = ref<number>();
const testing = ref(false);
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
      if (data) {
        // 编辑时，获取详情以获取 kubeconfig
        try {
          const detail = await getK8sSecretDetail(data.id);
          // 将 namespaces 数组转换为逗号分隔的字符串
          const namespacesStr =
            Array.isArray(detail.namespaces) && detail.namespaces.length > 0
              ? detail.namespaces.join(', ')
              : '';
          formApi.setValues({
            ...detail,
            namespaces: namespacesStr,
            kubeconfig: detail.kubeconfig || '', // 显示 kubeconfig
          });
        } catch {
          message.error('获取详情失败，请重试');
          // 如果获取详情失败，使用列表数据（不包含 kubeconfig）
          const namespacesStr =
            Array.isArray(data.namespaces) && data.namespaces.length > 0
              ? data.namespaces.join(', ')
              : '';
          formApi.setValues({
            ...data,
            namespaces: namespacesStr,
            kubeconfig: '',
          });
        }
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('deploy.tools.k8sSecret.name')])
    : $t('ui.actionTitle.create', [$t('deploy.tools.k8sSecret.name')]),
);

// 测试连接
async function handleTestConnection() {
  const values = await formApi.getValues();
  if (!values.kubeconfig || values.kubeconfig.trim() === '') {
    message.error(`${$t('deploy.tools.k8sSecret.kubeconfig')}不能为空`);
    return;
  }

  if (!values.namespaces || values.namespaces.trim() === '') {
    message.error(`${$t('deploy.tools.k8sSecret.namespaces')}不能为空`);
    return;
  }

  testing.value = true;

  try {
    // 将 namespaces 字符串转换为数组（按逗号分割，去除空白）
    const namespacesArray =
      typeof values.namespaces === 'string' && values.namespaces.trim()
        ? values.namespaces
            .split(',')
            .map((ns: string) => ns.trim())
            .filter((ns: string) => ns.length > 0)
        : [];

    if (namespacesArray.length === 0) {
      message.error(`${$t('deploy.tools.k8sSecret.namespaces')}不能为空`);
      testing.value = false;
      return;
    }

    await testK8sConnection({
      kubeconfig: values.kubeconfig,
      namespaces: namespacesArray,
    });
    message.success('连接测试成功');
  } catch {
    // 错误消息已由全局拦截器处理，这里不需要再次显示
    // 测试失败，不抛出错误，让 UI 显示错误消息
  } finally {
    testing.value = false;
  }
}

// 手动触发确认
async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();
  drawerApi.lock();

  // 将 namespaces 字符串转换为数组（按逗号分割，去除空白）
  const namespacesArray =
    typeof values.namespaces === 'string' && values.namespaces.trim()
      ? values.namespaces
          .split(',')
          .map((ns: string) => ns.trim())
          .filter((ns: string) => ns.length > 0)
      : [];

  // 只发送必要的字段
  const submitData: any = {
    name: values.name,
    server: values.server || '',
    namespaces: namespacesArray,
    kubeconfig: values.kubeconfig || '',
    status: values.status ?? 1,
  };

  try {
    // 保存前先测试连接
    testing.value = true;
    try {
      await testK8sConnection({
        kubeconfig: submitData.kubeconfig,
        namespaces: submitData.namespaces,
      });
    } catch {
      // 测试失败，阻止保存
      // 错误消息已由全局拦截器处理，这里不需要再次显示
      drawerApi.unlock();
      testing.value = false;
      return;
    } finally {
      testing.value = false;
    }

    // 测试通过，执行保存
    if (id.value) {
      await updateK8sSecret(id.value, submitData);
      message.success($t('ui.successMessage.update'));
    } else {
      await createK8sSecret(submitData);
      message.success($t('ui.successMessage.create'));
    }
    emits('success');
    drawerApi.close();
  } catch (error: any) {
    message.error(error?.message || '保存失败');
    drawerApi.unlock();
  }
}
</script>
<template>
  <Drawer :title="title">
    <Form />
    <template #footer>
      <div class="flex justify-between">
        <Button :loading="testing" @click="handleTestConnection">
          {{ $t('deploy.tools.k8sSecret.testConnection') }}
        </Button>
        <div class="flex gap-2">
          <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
          <Button type="primary" @click="handleConfirm">
            {{ $t('common.confirm') }}
          </Button>
        </div>
      </div>
    </template>
  </Drawer>
</template>
