<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createDockerSecret,
  getDockerSecretDetail,
  testDockerConnection,
  updateDockerSecret,
} from '#/api/deploy-tools/docker-secret';
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
        // 编辑时，获取详情以获取 password
        try {
          const detail = await getDockerSecretDetail(data.id);
          formApi.setValues({
            ...detail,
            password: detail.password || '', // 显示 password（如果是旧数据可能为空）
          });
        } catch (error: any) {
          console.error('获取详情失败:', error);
          message.error('获取详情失败，请重试');
          // 如果获取详情失败，使用列表数据（不包含 password）
          formApi.setValues({
            ...data,
            password: '',
          });
        }
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('deploy.tools.dockerSecret.name')])
    : $t('ui.actionTitle.create', [$t('deploy.tools.dockerSecret.name')]),
);

// 测试连接
async function handleTestConnection() {
  const values = await formApi.getValues();
  if (!values.host || values.host.trim() === '') {
    message.error(`${$t('deploy.tools.dockerSecret.host')}不能为空`);
    return;
  }

  testing.value = true;

  try {
    await testDockerConnection({
      host: values.host,
      username: values.username || '',
      password: values.password || '',
    });
    message.success('连接测试成功');
  } catch (error: any) {
    message.error(error?.message || '连接测试失败');
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

  // 只发送必要的字段
  const submitData: any = {
    name: values.name,
    host: values.host,
    username: values.username || '',
    password: values.password || '',
    status: values.status ?? 1,
  };

  try {
    if (id.value) {
      await updateDockerSecret(id.value, submitData);
      message.success($t('ui.successMessage.update'));
    } else {
      await createDockerSecret(submitData);
      message.success($t('ui.successMessage.create'));
    }
    emits('success');
    drawerApi.close();
  } catch (error: any) {
    console.error('保存失败:', error);
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
          {{ $t('deploy.tools.dockerSecret.testConnection') }}
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
