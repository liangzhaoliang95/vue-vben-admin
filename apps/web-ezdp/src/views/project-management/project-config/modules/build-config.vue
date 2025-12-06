<script lang="ts" setup>
import { reactive, ref } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Select,
  SelectOption,
  Space,
} from 'ant-design-vue';

import { $t } from '#/locales';

interface Props {
  projectId: string;
}

const props = defineProps<Props>();

// 表单数据
const formState = reactive({
  buildType: 'docker', // 打包类型：docker, maven, npm, go等
  dockerfile: '', // Dockerfile 路径
  buildContext: '.', // 构建上下文路径
  buildArgs: '', // 构建参数（JSON格式）
  imageName: '', // 镜像名称
  imageTag: 'latest', // 镜像标签
  buildCommand: '', // 构建命令
  outputPath: '', // 输出路径
});

const loading = ref(false);

// 打包类型选项
const buildTypeOptions = [
  { label: 'Docker', value: 'docker' },
  { label: 'Maven', value: 'maven' },
  { label: 'NPM', value: 'npm' },
  { label: 'Go', value: 'go' },
  { label: 'Custom', value: 'custom' },
];

// 保存配置
async function handleSave() {
  try {
    loading.value = true;
    // TODO: 调用保存接口
    // await saveBuildConfig(props.projectId, formState);
    message.success($t('ui.successMessage.save'));
  } catch {
    message.error($t('ui.errorMessage.save'));
  } finally {
    loading.value = false;
  }
}

// 测试构建
async function handleTestBuild() {
  try {
    loading.value = true;
    // TODO: 调用测试构建接口
    message.success('构建测试已启动');
  } catch {
    message.error('构建测试失败');
  } finally {
    loading.value = false;
  }
}

// 加载已有配置
async function loadConfig() {
  try {
    loading.value = true;
    // TODO: 调用获取配置接口
    // const config = await getBuildConfig(props.projectId);
    // Object.assign(formState, config);
  } catch (error) {
    console.error('加载配置失败:', error);
  } finally {
    loading.value = false;
  }
}

// 组件挂载时加载配置
loadConfig();
</script>

<template>
  <div class="build-config">
    <Form
      :model="formState"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 18 }"
      class="max-w-3xl"
    >
      <FormItem label="打包类型" name="buildType">
        <Select
          v-model:value="formState.buildType"
          placeholder="请选择打包类型"
        >
          <SelectOption
            v-for="option in buildTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectOption>
        </Select>
      </FormItem>

      <!-- Docker 特定配置 -->
      <template v-if="formState.buildType === 'docker'">
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

        <FormItem label="镜像标签" name="imageTag">
          <Input
            v-model:value="formState.imageTag"
            placeholder="例如: latest 或 v1.0.0"
          />
        </FormItem>

        <FormItem label="构建参数" name="buildArgs">
          <Input.TextArea
            v-model:value="formState.buildArgs"
            :rows="4"
            placeholder="JSON格式，例如: {&quot;ENV&quot;: &quot;production&quot;, &quot;VERSION&quot;: &quot;1.0.0&quot;}"
          />
        </FormItem>
      </template>

      <!-- 通用构建命令配置 -->
      <FormItem label="构建命令" name="buildCommand">
        <Input.TextArea
          v-model:value="formState.buildCommand"
          :rows="4"
          placeholder="例如: npm run build 或 go build -o main ."
        />
      </FormItem>

      <FormItem label="输出路径" name="outputPath">
        <Input
          v-model:value="formState.outputPath"
          placeholder="例如: ./dist 或 ./build"
        />
      </FormItem>

      <FormItem :wrapper-col="{ offset: 6, span: 18 }">
        <Space>
          <Button type="primary" :loading="loading" @click="handleSave">
            保存配置
          </Button>
          <Button :loading="loading" @click="handleTestBuild">
            测试构建
          </Button>
        </Space>
      </FormItem>
    </Form>
  </div>
</template>

<style scoped>
.build-config {
  padding: 24px 0;
}
</style>
