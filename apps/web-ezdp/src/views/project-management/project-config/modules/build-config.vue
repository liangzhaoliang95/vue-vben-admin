<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Button, Form, FormItem, Input, message, Select } from 'ant-design-vue';

import { getDockerSecretList } from '#/api/deploy-tools/docker-secret';
import {
  createOrUpdateBuildConfig,
  getBuildConfigByProjectConfigId,
} from '#/api/project-management/build-config';
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
  dockerfile: './Dockerfile', // Dockerfile 路径 (默认值)
  buildContext: '.', // 构建上下文路径 (默认值)
  buildArgs: '', // 构建参数（JSON格式）
  imageName: '', // 镜像名称
  dockerSecretId: '', // Docker 仓库配置ID
  ossName: '', // OSS 名称（前端项目构建资源上传目录）
});

const loading = ref(false);
const dockerSecretList = ref<Array<{ id: string; name: string }>>([]);

// 构建参数的 placeholder（使用计算属性避免引号冲突）
const buildArgsPlaceholder = computed(
  () => $t('deploy.projectManagement.projectConfig.buildConfig.buildArgsPlaceholder'),
);

// 表单验证规则(根据项目类型动态生成)
const formRules = computed(() => {
  const baseRules = {
    dockerfile: [
      {
        required: true,
        message: $t('deploy.projectManagement.projectConfig.buildConfig.dockerfile') + $t('ui.inputRequired'),
        trigger: 'blur'
      },
    ],
    buildContext: [
      {
        required: true,
        message: $t('deploy.projectManagement.projectConfig.buildConfig.buildContext') + $t('ui.inputRequired'),
        trigger: 'blur'
      },
    ],
    imageName: [
      {
        required: true,
        message: $t('deploy.projectManagement.projectConfig.buildConfig.imageName') + $t('ui.inputRequired'),
        trigger: 'blur'
      }
    ],
    dockerSecretId: [
      {
        required: true,
        message: $t('deploy.projectManagement.projectConfig.buildConfig.dockerSecret') + $t('ui.selectRequired'),
        trigger: 'change'
      },
    ],
  };

  if (isFrontendProject.value) {
    // 前端项目: dockerfile, buildContext, imageName, dockerSecretId, ossName 都必填
    return {
      ...baseRules,
      ossName: [
        {
          required: true,
          message: $t('deploy.projectManagement.projectConfig.buildConfig.ossName') + $t('ui.inputRequired'),
          trigger: 'blur'
        },
      ],
    };
  }

  // 后端项目: dockerfile, buildContext, imageName, dockerSecretId 必填
  return baseRules;
});

// Form 实例引用
const formRef = ref();

// 保存配置
async function handleSave() {
  try {
    // 先验证表单
    await formRef.value?.validate();

    loading.value = true;
    await createOrUpdateBuildConfig({
      projectConfigId: props.projectId,
      dockerfile: formState.dockerfile || undefined,
      buildContext: formState.buildContext || undefined,
      buildArgs: formState.buildArgs || undefined,
      imageName: formState.imageName || undefined,
      dockerSecretId: formState.dockerSecretId || undefined,
      ossName: formState.ossName || undefined,
    });
    message.success($t('ui.successMessage.save'));
  } catch (error) {
    console.error('保存配置失败:', error);
    // 区分验证错误和保存错误
    if (error && typeof error === 'object' && 'errorFields' in error) {
      message.error($t('deploy.projectManagement.projectConfig.buildConfig.fillRequired'));
    } else {
      message.error($t('ui.errorMessage.save'));
    }
  } finally {
    loading.value = false;
  }
}

// 加载已有配置
async function loadConfig() {
  try {
    loading.value = true;
    const config = await getBuildConfigByProjectConfigId(props.projectId);
    if (config) {
      formState.dockerfile = config.dockerfile || './Dockerfile';
      formState.buildContext = config.buildContext || '.';
      formState.buildArgs = config.buildArgs || '';
      formState.imageName = config.imageName || '';
      formState.dockerSecretId = config.dockerSecretId || '';
      formState.ossName = config.ossName || '';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  } finally {
    loading.value = false;
  }
}

// 加载 Docker 仓库配置列表
async function loadDockerSecretList() {
  try {
    const response = await getDockerSecretList({
      page: 1,
      pageSize: 100,
      status: 1, // 只加载启用状态的配置
    });
    dockerSecretList.value = response.items.map((item: any) => ({
      id: item.id,
      name: item.name,
    }));
  } catch (error) {
    console.error('加载 Docker 仓库配置失败:', error);
  }
}

// 组件挂载时加载配置
onMounted(() => {
  loadConfig();
  loadDockerSecretList();
});
</script>

<template>
  <div class="build-config">
    <Form
      ref="formRef"
      :model="formState"
      :rules="formRules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 18 }"
      class="max-w-3xl"
    >
      <FormItem
        :label="$t('deploy.projectManagement.projectConfig.buildConfig.dockerfile')"
        name="dockerfile"
      >
        <Input
          v-model:value="formState.dockerfile"
          :placeholder="$t('deploy.projectManagement.projectConfig.buildConfig.dockerfilePlaceholder')"
        />
      </FormItem>

      <FormItem
        :label="$t('deploy.projectManagement.projectConfig.buildConfig.buildContext')"
        name="buildContext"
      >
        <Input
          v-model:value="formState.buildContext"
          :placeholder="$t('deploy.projectManagement.projectConfig.buildConfig.buildContextPlaceholder')"
        />
      </FormItem>

      <FormItem
        :label="$t('deploy.projectManagement.projectConfig.buildConfig.imageName')"
        name="imageName"
      >
        <Input
          v-model:value="formState.imageName"
          :placeholder="$t('deploy.projectManagement.projectConfig.buildConfig.imageNamePlaceholder')"
        />
      </FormItem>

      <FormItem
        :label="$t('deploy.projectManagement.projectConfig.buildConfig.dockerSecret')"
        name="dockerSecretId"
      >
        <Select
          v-model:value="formState.dockerSecretId"
          :placeholder="$t('deploy.projectManagement.projectConfig.buildConfig.dockerSecretPlaceholder')"
          allow-clear
        >
          <Select.Option
            v-for="item in dockerSecretList"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </Select.Option>
        </Select>
      </FormItem>

      <FormItem
        v-if="isFrontendProject"
        :label="$t('deploy.projectManagement.projectConfig.buildConfig.ossName')"
        name="ossName"
      >
        <Input
          v-model:value="formState.ossName"
          :placeholder="$t('deploy.projectManagement.projectConfig.buildConfig.ossNamePlaceholder')"
        />
      </FormItem>

      <FormItem
        :label="$t('deploy.projectManagement.projectConfig.buildConfig.buildArgs')"
        name="buildArgs"
      >
        <Input.TextArea
          v-model:value="formState.buildArgs"
          :rows="4"
          :placeholder="buildArgsPlaceholder"
        />
      </FormItem>

      <FormItem :wrapper-col="{ offset: 6, span: 18 }">
        <Button type="primary" :loading="loading" @click="handleSave">
          {{ $t('deploy.projectManagement.projectConfig.buildConfig.saveConfig') }}
        </Button>
      </FormItem>
    </Form>
  </div>
</template>

<style scoped>
.build-config {
  padding: 24px 0;
}
</style>
