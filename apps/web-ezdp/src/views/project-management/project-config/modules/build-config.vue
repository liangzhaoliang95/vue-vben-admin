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
  () => 'JSON格式，例如: {"ENV": "production", "VERSION": "1.0.0"}',
);

// 表单验证规则(根据项目类型动态生成)
const formRules = computed(() => {
  const baseRules = {
    dockerfile: [
      { required: true, message: '请输入 Dockerfile 路径', trigger: 'blur' },
    ],
    buildContext: [
      { required: true, message: '请输入构建上下文', trigger: 'blur' },
    ],
    imageName: [{ required: true, message: '请输入镜像名称', trigger: 'blur' }],
    dockerSecretId: [
      { required: true, message: '请选择仓库配置', trigger: 'change' },
    ],
  };

  if (isFrontendProject.value) {
    // 前端项目: dockerfile, buildContext, imageName, dockerSecretId, ossName 都必填
    return {
      ...baseRules,
      ossName: [
        { required: true, message: '请输入 OSS 名称', trigger: 'blur' },
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
      message.error('请填写必填项');
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
      <FormItem label="Dockerfile 路径" name="dockerfile">
        <Input
          v-model:value="formState.dockerfile"
          placeholder="例如: ./Dockerfile 或 ./docker/Dockerfile"
        />
      </FormItem>

      <FormItem label="构建上下文" name="buildContext">
        <Input
          v-model:value="formState.buildContext"
          placeholder="例如: . 或 ./app"
        />
      </FormItem>

      <FormItem label="镜像名称" name="imageName">
        <Input
          v-model:value="formState.imageName"
          placeholder="例如: myapp 或 registry.example.com/myapp"
        />
      </FormItem>

      <FormItem label="仓库配置" name="dockerSecretId">
        <Select
          v-model:value="formState.dockerSecretId"
          placeholder="请选择 Docker 仓库配置（可选）"
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

      <FormItem v-if="isFrontendProject" label="OSS 名称" name="ossName">
        <Input
          v-model:value="formState.ossName"
          placeholder="前端项目构建资源上传目录，例如: my-frontend-app"
        />
      </FormItem>

      <FormItem label="构建参数" name="buildArgs">
        <Input.TextArea
          v-model:value="formState.buildArgs"
          :rows="4"
          :placeholder="buildArgsPlaceholder"
        />
      </FormItem>

      <FormItem :wrapper-col="{ offset: 6, span: 18 }">
        <Button type="primary" :loading="loading" @click="handleSave">
          保存配置
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
