<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Button, Form, FormItem, Input, message } from 'ant-design-vue';

import {
  createOrUpdateBuildConfig,
  getBuildConfigByProjectConfigId,
} from '#/api/project-management/build-config';
import { $t } from '#/locales';

interface Props {
  projectId: string;
}

const props = defineProps<Props>();

// 表单数据
const formState = reactive({
  dockerfile: '', // Dockerfile 路径
  buildContext: '.', // 构建上下文路径
  buildArgs: '', // 构建参数（JSON格式）
  imageName: '', // 镜像名称
});

const loading = ref(false);

// 构建参数的 placeholder（使用计算属性避免引号冲突）
const buildArgsPlaceholder = computed(
  () => 'JSON格式，例如: {"ENV": "production", "VERSION": "1.0.0"}',
);

// 保存配置
async function handleSave() {
  try {
    loading.value = true;
    await createOrUpdateBuildConfig({
      projectConfigId: props.projectId,
      dockerfile: formState.dockerfile || undefined,
      buildContext: formState.buildContext || undefined,
      buildArgs: formState.buildArgs || undefined,
      imageName: formState.imageName || undefined,
    });
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
    const config = await getBuildConfigByProjectConfigId(props.projectId);
    if (config) {
      formState.dockerfile = config.dockerfile || '';
      formState.buildContext = config.buildContext || '.';
      formState.buildArgs = config.buildArgs || '';
      formState.imageName = config.imageName || '';
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
  <div class="build-config">
    <Form
      :model="formState"
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
