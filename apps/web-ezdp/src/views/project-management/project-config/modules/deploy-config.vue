<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Select,
  SelectOption,
} from 'ant-design-vue';

import {
  createOrUpdateDeployConfig,
  getDeployConfigByProjectConfigId,
} from '#/api/project-management/deploy-config';
import { $t } from '#/locales';

interface Props {
  projectId: string;
}

const props = defineProps<Props>();

// 表单数据
const formState = reactive({
  deployType: 'k8s' as 'k8s' | 'oss', // 发布类型：k8s, oss
  k8sType: 'deployment' as 'cronjob' | 'deployment', // K8s 资源类型：deployment, cronjob
  k8sName: '', // K8s 资源名称
  ossName: '', // OSS 名称
});

const loading = ref(false);

// 发布类型选项
const deployTypeOptions = [
  { label: 'Kubernetes', value: 'k8s' },
  { label: 'OSS', value: 'oss' },
];

// K8s 资源类型选项
const k8sTypeOptions = [
  { label: 'Deployment', value: 'deployment' },
  { label: 'CronJob', value: 'cronjob' },
];

// 保存配置
async function handleSave() {
  try {
    loading.value = true;
    const data: any = {
      projectConfigId: props.projectId,
      deployType: formState.deployType,
    };

    if (formState.deployType === 'k8s') {
      data.k8sType = formState.k8sType;
      data.k8sName = formState.k8sName || undefined;
    } else {
      data.ossName = formState.ossName || undefined;
    }

    await createOrUpdateDeployConfig(data);
    message.success($t('ui.successMessage.save'));
  } catch (error) {
    console.error('保存配置失败:', error);
    message.error($t('ui.errorMessage.save'));
  } finally {
    loading.value = false;
  }
}

// 加载已有配置
async function loadConfig() {
  try {
    loading.value = true;
    const config = await getDeployConfigByProjectConfigId(props.projectId);
    if (config) {
      formState.deployType = config.deployType;
      formState.k8sType = config.k8sType || 'deployment';
      formState.k8sName = config.k8sName || '';
      formState.ossName = config.ossName || '';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  } finally {
    loading.value = false;
  }
}

// 组件挂载时加载配置
onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="deploy-config">
    <Form
      :model="formState"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 18 }"
      class="max-w-3xl"
    >
      <FormItem label="发布类型" name="deployType">
        <Select
          v-model:value="formState.deployType"
          placeholder="请选择发布类型"
        >
          <SelectOption
            v-for="option in deployTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectOption>
        </Select>
      </FormItem>

      <!-- K8s 发布配置 -->
      <template v-if="formState.deployType === 'k8s'">
        <FormItem label="资源类型" name="k8sType">
          <Select
            v-model:value="formState.k8sType"
            placeholder="请选择资源类型"
          >
            <SelectOption
              v-for="option in k8sTypeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectOption>
          </Select>
        </FormItem>

        <FormItem label="资源名称" name="k8sName">
          <Input
            v-model:value="formState.k8sName"
            placeholder="例如: myapp-deployment 或 myapp-cronjob"
          />
        </FormItem>
      </template>

      <!-- OSS 发布配置 -->
      <template v-if="formState.deployType === 'oss'">
        <FormItem label="名称" name="ossName">
          <Input
            v-model:value="formState.ossName"
            placeholder="例如: myapp-frontend"
          />
        </FormItem>
      </template>

      <FormItem :wrapper-col="{ offset: 6, span: 18 }">
        <Button type="primary" :loading="loading" @click="handleSave">
          保存配置
        </Button>
      </FormItem>
    </Form>
  </div>
</template>

<style scoped>
.deploy-config {
  padding: 24px 0;
}
</style>
