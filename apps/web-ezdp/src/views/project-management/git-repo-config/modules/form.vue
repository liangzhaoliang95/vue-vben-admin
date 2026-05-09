<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Alert, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createGitRepoConfig,
  getGitRepoConfigDetail,
  testGitRepoConnection,
  updateGitRepoConfig,
} from '#/api/project-management/git-repo-config';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const businessStore = useBusinessStore();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-12 gap-x-4 gap-y-4',
});

const id = ref<string>();
const loading = ref(false);
const testLoading = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    await handleConfirm();
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<any>();
      formApi.resetForm();
      testResult.value = null;

      if (data && data.id) {
        id.value = data.id;
        await nextTick();
        try {
          const detail = await getGitRepoConfigDetail(data.id);
          formApi.setValues({
            name: detail.name,
            type: detail.type,
            baseUrl: detail.baseUrl,
            apiToken: detail.apiToken,
            committerName: detail.committerName,
            committerEmail: detail.committerEmail,
            businessLineId: detail.businessLineId,
          });
        } catch {
          formApi.setValues({
            name: data.name,
            type: data.type,
            baseUrl: data.baseUrl,
            committerName: data.committerName,
            committerEmail: data.committerEmail,
            businessLineId: data.businessLineId,
          });
        }
      } else {
        id.value = undefined;
        await nextTick();
        const currentBusinessLine = businessStore.currentBusinessLine;
        const defaultBusinessLineId = currentBusinessLine?.businessLine.id;
        if (defaultBusinessLineId) {
          formApi.setValues({ businessLineId: defaultBusinessLineId });
        }
        // 新建时默认类型为 gitlab
        formApi.setValues({ type: 'gitlab' });
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [
        $t('deploy.projectManagement.gitRepoConfig.title'),
      ])
    : $t('ui.actionTitle.create', [
        $t('deploy.projectManagement.gitRepoConfig.title'),
      ]),
);

async function handleTestConnection() {
  const values = await formApi.getValues();
  if (!values.baseUrl || !values.apiToken) {
    message.warning(
      $t('deploy.projectManagement.gitRepoConfig.baseUrlRequired') +
        ' / ' +
        $t('deploy.projectManagement.gitRepoConfig.apiTokenRequired'),
    );
    return;
  }

  testLoading.value = true;
  testResult.value = null;

  try {
    const result = await testGitRepoConnection({
      baseUrl: values.baseUrl,
      apiToken: values.apiToken,
    });
    testResult.value = result;
  } catch (error: any) {
    testResult.value = {
      success: false,
      message: error?.message || $t('deploy.projectManagement.gitRepoConfig.testFailed'),
    };
  } finally {
    testLoading.value = false;
  }
}

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();

  loading.value = true;

  const submitData: any = {
    name: values.name,
    type: values.type,
    baseUrl: values.baseUrl,
    apiToken: values.apiToken,
    committerName: values.committerName,
    committerEmail: values.committerEmail,
  };

  if (values.businessLineId) {
    submitData.businessLineId = values.businessLineId;
  }

  try {
    if (id.value) {
      await updateGitRepoConfig(id.value, submitData);
      message.success($t('ui.successMessage.update'));
    } else {
      await createGitRepoConfig(submitData);
      message.success($t('ui.successMessage.create'));
    }

    drawerApi.close();
    emits('success');
  } catch {
    // 错误信息由全局拦截器处理
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Drawer :title="title">
    <Form />

    <!-- 测试连接区域 -->
    <div class="mt-2 px-1">
      <Button
        :loading="testLoading"
        type="default"
        @click="handleTestConnection"
      >
        {{
          testLoading
            ? $t('deploy.projectManagement.gitRepoConfig.testing')
            : $t('deploy.projectManagement.gitRepoConfig.testConnection')
        }}
      </Button>

      <Alert
        v-if="testResult"
        :message="testResult.message"
        :type="testResult.success ? 'success' : 'error'"
        class="mt-3"
        show-icon
      />
    </div>

    <template #footer>
      <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
      <Button :loading="loading" type="primary" @click="handleConfirm">
        {{ $t('common.confirm') }}
      </Button>
    </template>
  </Drawer>
</template>
