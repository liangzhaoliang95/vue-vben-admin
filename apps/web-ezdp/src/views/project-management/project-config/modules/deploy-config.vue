<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Select,
  SelectOption,
  Textarea,
} from 'ant-design-vue';

import {
  createOrUpdateDeployConfig,
  getDeployConfigByProjectConfigId,
} from '#/api/project-management/deploy-config';
import { $t } from '#/locales';

interface Props {
  projectId: string;
  projectType?: string; // 项目类型: frontend/backend/submodule
}

const props = defineProps<Props>();

// 判断是否为前端项目
const isFrontendProject = computed(() => props.projectType === 'frontend');

// 表单数据
const formState = reactive({
  deployType: (isFrontendProject.value ? 'ossutil' : 'k8s') as
    | 'k8s'
    | 'ossutil'
    | 'script', // 发布类型：k8s, ossutil, script
  k8sType: 'deployment' as 'cronjob' | 'deployment', // K8s 资源类型：deployment, cronjob
  k8sName: '', // K8s 资源名称
  containerName: 'main', // K8s 容器名称（默认为main）
  ossName: '', // OSS 名称
  scriptContent: '', // 脚本内容
});

const loading = ref(false);
const formRef = ref();

// 表单验证规则
const rules: Record<string, any> = computed(() => ({
  k8sName: [
    {
      required: true,
      message: $t('deploy.projectManagement.projectConfig.deployConfig.k8sName') + $t('ui.inputRequired'),
      trigger: 'blur',
    },
  ],
  containerName: [
    {
      required: true,
      message: $t('deploy.projectManagement.projectConfig.deployConfig.containerName') + $t('ui.inputRequired'),
      trigger: 'blur',
    },
  ],
  ossName: [
    {
      required: true,
      message: $t('deploy.projectManagement.projectConfig.deployConfig.ossName') + $t('ui.inputRequired'),
      trigger: 'blur',
    },
  ],
  scriptContent: [
    {
      required: true,
      message: $t('deploy.projectManagement.projectConfig.deployConfig.scriptContent') + $t('ui.inputRequired'),
      trigger: 'blur',
    },
  ],
}));

// 发布类型选项(根据项目类型动态显示)
const deployTypeOptions = computed(() => {
  if (isFrontendProject.value) {
    // 前端项目支持对象存储发布和Shell发布
    return [
      { label: $t('deploy.packageDeployManagement.deployHistory.type.ossutil'), value: 'ossutil' },
      { label: $t('deploy.projectManagement.projectConfig.deployConfig.shell'), value: 'script' },
    ];
  }
  // 后端项目支持 K8s 发布和Shell发布
  return [
    { label: 'Kubernetes', value: 'k8s' },
    { label: $t('deploy.projectManagement.projectConfig.deployConfig.shell'), value: 'script' },
  ];
});

// K8s 资源类型选项
const k8sTypeOptions = [
  { label: 'Deployment', value: 'deployment' },
  { label: 'CronJob', value: 'cronjob' },
];

// 保存配置
async function handleSave() {
  try {
    // 表单验证
    await formRef.value?.validate();

    loading.value = true;
    const data: any = {
      projectConfigId: props.projectId,
      deployType: formState.deployType,
    };

    if (formState.deployType === 'k8s') {
      data.k8sType = formState.k8sType;
      data.k8sName = formState.k8sName;
      data.containerName = formState.containerName;
    } else if (formState.deployType === 'ossutil') {
      data.ossName = formState.ossName;
    } else if (formState.deployType === 'script') {
      data.scriptContent = formState.scriptContent;
    }

    await createOrUpdateDeployConfig(data);
    message.success($t('ui.successMessage.save'));
  } catch (error: any) {
    // 如果是表单验证错误，不显示错误消息（Ant Design已经显示了）
    if (error?.errorFields) {
      console.log('表单验证失败:', error);
      return;
    }
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
      formState.containerName = config.containerName || 'main';
      formState.ossName = config.ossName || '';
      formState.scriptContent = config.scriptContent || '';
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
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 18 }"
      class="max-w-3xl"
    >
      <FormItem
        :label="$t('deploy.projectManagement.projectConfig.deployConfig.deployType')"
        name="deployType"
      >
        <Select
          v-model:value="formState.deployType"
          :placeholder="$t('deploy.projectManagement.projectConfig.deployConfig.deployTypePlaceholder')"
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
        <FormItem
          :label="$t('deploy.projectManagement.projectConfig.deployConfig.k8sType')"
          name="k8sType"
        >
          <Select
            v-model:value="formState.k8sType"
            :placeholder="$t('deploy.projectManagement.projectConfig.deployConfig.k8sTypePlaceholder')"
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

        <FormItem
          :label="$t('deploy.projectManagement.projectConfig.deployConfig.k8sName')"
          name="k8sName"
        >
          <Input
            v-model:value="formState.k8sName"
            :placeholder="$t('deploy.projectManagement.projectConfig.deployConfig.k8sNamePlaceholder')"
          />
        </FormItem>

        <FormItem
          :label="$t('deploy.projectManagement.projectConfig.deployConfig.containerName')"
          name="containerName"
        >
          <Input
            v-model:value="formState.containerName"
            :placeholder="$t('deploy.projectManagement.projectConfig.deployConfig.containerNamePlaceholder')"
          />
          <div class="text-gray-500 text-xs mt-1">
            {{ $t('deploy.projectManagement.projectConfig.deployConfig.containerNameTip') }}
          </div>
        </FormItem>
      </template>

      <!-- 对象存储发布配置 -->
      <template v-if="formState.deployType === 'ossutil'">
        <FormItem
          :label="$t('deploy.projectManagement.projectConfig.deployConfig.ossName')"
          name="ossName"
        >
          <Input
            v-model:value="formState.ossName"
            :placeholder="$t('deploy.projectManagement.projectConfig.deployConfig.ossNamePlaceholder')"
          />
        </FormItem>
      </template>

      <!-- 脚本发布配置 -->
      <template v-if="formState.deployType === 'script'">
        <FormItem
          :label="$t('deploy.projectManagement.projectConfig.deployConfig.scriptContent')"
          name="scriptContent"
        >
          <Textarea
            v-model:value="formState.scriptContent"
            :placeholder="$t('deploy.projectManagement.projectConfig.deployConfig.scriptContentPlaceholder')"
            :rows="10"
            :auto-size="{ minRows: 10, maxRows: 20 }"
            style="font-family: 'Consolas', 'Monaco', 'Courier New', monospace"
          />
          <div class="text-gray-500 text-xs mt-1">
            {{ $t('deploy.projectManagement.projectConfig.deployConfig.scriptContentTip') }}
          </div>
        </FormItem>
      </template>

      <FormItem :wrapper-col="{ offset: 6, span: 18 }">
        <Button type="primary" :loading="loading" @click="handleSave">
          {{ $t('deploy.projectManagement.projectConfig.deployConfig.saveConfig') }}
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
