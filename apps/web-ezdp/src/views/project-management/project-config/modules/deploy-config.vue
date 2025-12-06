<script lang="ts" setup>
import { reactive, ref } from 'vue';

import { Button, Card, Checkbox, Form, FormItem, Input, InputNumber, message, Select, SelectOption, Space } from 'ant-design-vue';

import { $t } from '#/locales';

interface Props {
  projectId: string;
}

const props = defineProps<Props>();

// 表单数据
const formState = reactive({
  deployType: 'kubernetes', // 发布类型：kubernetes, docker, ssh等
  namespace: 'default', // K8s 命名空间
  deploymentName: '', // Deployment 名称
  serviceName: '', // Service 名称
  containerPort: 8080, // 容器端口
  replicas: 1, // 副本数
  cpuLimit: '500m', // CPU限制
  memoryLimit: '512Mi', // 内存限制
  cpuRequest: '100m', // CPU请求
  memoryRequest: '128Mi', // 内存请求
  imagePullSecret: '', // 镜像拉取密钥
  configMapName: '', // ConfigMap 名称
  secretName: '', // Secret 名称
  envVars: '', // 环境变量（JSON格式）
  volumeMounts: '', // 卷挂载（JSON格式）
  ingressEnabled: false, // 是否启用 Ingress
  ingressHost: '', // Ingress 主机名
  ingressPath: '/', // Ingress 路径
  healthCheckPath: '/health', // 健康检查路径
  readinessCheckPath: '/ready', // 就绪检查路径
});

const loading = ref(false);

// 发布类型选项
const deployTypeOptions = [
  { label: 'Kubernetes', value: 'kubernetes' },
  { label: 'Docker', value: 'docker' },
  { label: 'SSH', value: 'ssh' },
  { label: 'Custom', value: 'custom' },
];

// 保存配置
async function handleSave() {
  try {
    loading.value = true;
    // TODO: 调用保存接口
    // await saveDeployConfig(props.projectId, formState);
    message.success($t('ui.successMessage.save'));
  } catch (error) {
    message.error($t('ui.errorMessage.save'));
  } finally {
    loading.value = false;
  }
}

// 测试部署
async function handleTestDeploy() {
  try {
    loading.value = true;
    // TODO: 调用测试部署接口
    message.success('部署测试已启动');
  } catch (error) {
    message.error('部署测试失败');
  } finally {
    loading.value = false;
  }
}

// 加载已有配置
async function loadConfig() {
  try {
    loading.value = true;
    // TODO: 调用获取配置接口
    // const config = await getDeployConfig(props.projectId);
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
  <div class="deploy-config">
    <Form
      :model="formState"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 18 }"
      class="max-w-3xl"
    >
      <FormItem
        label="发布类型"
        name="deployType"
      >
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

      <!-- Kubernetes 特定配置 -->
      <template v-if="formState.deployType === 'kubernetes'">
        <Card title="基本配置" class="mb-4" size="small">
          <FormItem
            label="命名空间"
            name="namespace"
          >
            <Input
              v-model:value="formState.namespace"
              placeholder="例如: default 或 production"
            />
          </FormItem>

          <FormItem
            label="Deployment 名称"
            name="deploymentName"
          >
            <Input
              v-model:value="formState.deploymentName"
              placeholder="例如: myapp-deployment"
            />
          </FormItem>

          <FormItem
            label="Service 名称"
            name="serviceName"
          >
            <Input
              v-model:value="formState.serviceName"
              placeholder="例如: myapp-service"
            />
          </FormItem>

          <FormItem
            label="容器端口"
            name="containerPort"
          >
            <InputNumber
              v-model:value="formState.containerPort"
              :min="1"
              :max="65535"
              class="w-full"
            />
          </FormItem>

          <FormItem
            label="副本数"
            name="replicas"
          >
            <InputNumber
              v-model:value="formState.replicas"
              :min="1"
              :max="100"
              class="w-full"
            />
          </FormItem>
        </Card>

        <Card title="资源配置" class="mb-4" size="small">
          <FormItem
            label="CPU 限制"
            name="cpuLimit"
          >
            <Input
              v-model:value="formState.cpuLimit"
              placeholder="例如: 500m 或 1"
            />
          </FormItem>

          <FormItem
            label="内存限制"
            name="memoryLimit"
          >
            <Input
              v-model:value="formState.memoryLimit"
              placeholder="例如: 512Mi 或 1Gi"
            />
          </FormItem>

          <FormItem
            label="CPU 请求"
            name="cpuRequest"
          >
            <Input
              v-model:value="formState.cpuRequest"
              placeholder="例如: 100m 或 0.5"
            />
          </FormItem>

          <FormItem
            label="内存请求"
            name="memoryRequest"
          >
            <Input
              v-model:value="formState.memoryRequest"
              placeholder="例如: 128Mi 或 256Mi"
            />
          </FormItem>
        </Card>

        <Card title="配置管理" class="mb-4" size="small">
          <FormItem
            label="镜像拉取密钥"
            name="imagePullSecret"
          >
            <Input
              v-model:value="formState.imagePullSecret"
              placeholder="例如: registry-secret"
            />
          </FormItem>

          <FormItem
            label="ConfigMap 名称"
            name="configMapName"
          >
            <Input
              v-model:value="formState.configMapName"
              placeholder="例如: myapp-config"
            />
          </FormItem>

          <FormItem
            label="Secret 名称"
            name="secretName"
          >
            <Input
              v-model:value="formState.secretName"
              placeholder="例如: myapp-secret"
            />
          </FormItem>

          <FormItem
            label="环境变量"
            name="envVars"
          >
            <Input.TextArea
              v-model:value="formState.envVars"
              :rows="4"
              placeholder='JSON格式，例如: {"NODE_ENV": "production", "PORT": "8080"}'
            />
          </FormItem>

          <FormItem
            label="卷挂载"
            name="volumeMounts"
          >
            <Input.TextArea
              v-model:value="formState.volumeMounts"
              :rows="4"
              placeholder='JSON格式，例如: [{"name": "config", "mountPath": "/etc/config"}]'
            />
          </FormItem>
        </Card>

        <Card title="网络配置" class="mb-4" size="small">
          <FormItem
            label="启用 Ingress"
            name="ingressEnabled"
          >
            <Checkbox v-model:checked="formState.ingressEnabled">
              启用 Ingress 访问
            </Checkbox>
          </FormItem>

          <template v-if="formState.ingressEnabled">
            <FormItem
              label="Ingress 主机名"
              name="ingressHost"
            >
              <Input
                v-model:value="formState.ingressHost"
                placeholder="例如: myapp.example.com"
              />
            </FormItem>

            <FormItem
              label="Ingress 路径"
              name="ingressPath"
            >
              <Input
                v-model:value="formState.ingressPath"
                placeholder="例如: / 或 /api"
              />
            </FormItem>
          </template>
        </Card>

        <Card title="健康检查" class="mb-4" size="small">
          <FormItem
            label="健康检查路径"
            name="healthCheckPath"
          >
            <Input
              v-model:value="formState.healthCheckPath"
              placeholder="例如: /health 或 /healthz"
            />
          </FormItem>

          <FormItem
            label="就绪检查路径"
            name="readinessCheckPath"
          >
            <Input
              v-model:value="formState.readinessCheckPath"
              placeholder="例如: /ready 或 /readiness"
            />
          </FormItem>
        </Card>
      </template>

      <FormItem :wrapper-col="{ offset: 6, span: 18 }">
        <Space>
          <Button
            type="primary"
            :loading="loading"
            @click="handleSave"
          >
            保存配置
          </Button>
          <Button
            :loading="loading"
            @click="handleTestDeploy"
          >
            测试部署
          </Button>
        </Space>
      </FormItem>
    </Form>
  </div>
</template>

<style scoped>
.deploy-config {
  padding: 24px 0;
}
</style>
