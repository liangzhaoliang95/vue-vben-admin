<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Select,
  Switch,
} from 'ant-design-vue';

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
  buildMode: 1, // 构建模式：1=Dockerfile，2=Shell (默认值)
  // Dockerfile 构建字段
  dockerfile: './Dockerfile', // Dockerfile 路径 (默认值)
  buildContext: '.', // 构建上下文路径 (默认值)
  buildArgs: '', // 构建参数（JSON格式）
  imageName: '', // 镜像名称
  dockerSecretId: '', // Docker 仓库配置ID
  ossName: '', // OSS 名称（前端项目构建资源上传目录）
  // Shell 构建字段
  artifactName: '', // 产物名称
  buildScript: '', // 构建脚本
  uploadScript: '', // 上传脚本
  buildCheckMode: 1, // 构建检查模式（默认1）
  // Monorepo 配置
  isMonorepo: false, // 是否为 Monorepo 子项目（默认false）
  packagePath: '', // 包目录路径
});

const loading = ref(false);
const dockerSecretList = ref<Array<{ id: string; name: string }>>([]);

// 构建模式选项
const buildModeOptions = computed(() => [
  {
    value: 1,
    label: $t(
      'deploy.projectManagement.projectConfig.buildConfig.buildModeDockerfile',
    ),
  },
  {
    value: 2,
    label: $t(
      'deploy.projectManagement.projectConfig.buildConfig.buildModeShell',
    ),
  },
]);

// 构建参数的 placeholder（使用计算属性避免引号冲突）
const buildArgsPlaceholder = computed(() =>
  $t('deploy.projectManagement.projectConfig.buildConfig.buildArgsPlaceholder'),
);

// 构建检查模式选项
const buildCheckModeOptions = computed(() => [
  {
    value: 1,
    label: $t(
      'deploy.projectManagement.projectConfig.buildConfig.buildCheckModeNeedBuild',
    ),
  },
  {
    value: 2,
    label: $t(
      'deploy.projectManagement.projectConfig.buildConfig.buildCheckModeVersionDiff',
    ),
  },
]);

// 判断是否为 Dockerfile 模式
const isDockerfileMode = computed(() => formState.buildMode === 1);

// 判断是否为 Shell 模式
const isShellMode = computed(() => formState.buildMode === 2);

// 表单验证规则(根据构建模式和项目类型动态生成)
const formRules = computed(() => {
  if (isDockerfileMode.value) {
    // Dockerfile 模式
    const baseRules = {
      dockerfile: [
        {
          required: true,
          message:
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.dockerfile',
            ) + $t('ui.inputRequired'),
          trigger: 'blur',
        },
      ],
      buildContext: [
        {
          required: true,
          message:
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.buildContext',
            ) + $t('ui.inputRequired'),
          trigger: 'blur',
        },
      ],
      imageName: [
        {
          required: true,
          message:
            $t('deploy.projectManagement.projectConfig.buildConfig.imageName') +
            $t('ui.inputRequired'),
          trigger: 'blur',
        },
      ],
      dockerSecretId: [
        {
          required: true,
          message:
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.dockerSecret',
            ) + $t('ui.selectRequired'),
          trigger: 'change',
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
            message:
              $t('deploy.projectManagement.projectConfig.buildConfig.ossName') +
              $t('ui.inputRequired'),
            trigger: 'blur',
          },
        ],
      };
    }

    // 后端项目: dockerfile, buildContext, imageName, dockerSecretId 必填
    return baseRules;
  } else {
    // Shell 模式
    return {
      artifactName: [
        {
          required: true,
          message:
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.artifactName',
            ) + $t('ui.inputRequired'),
          trigger: 'blur',
        },
      ],
      buildScript: [
        {
          required: true,
          message:
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.buildScript',
            ) + $t('ui.inputRequired'),
          trigger: 'blur',
        },
      ],
      uploadScript: [
        {
          required: true,
          message:
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.uploadScript',
            ) + $t('ui.inputRequired'),
          trigger: 'blur',
        },
      ],
    };
  }
});

// Form 实例引用
const formRef = ref();

// 监听构建模式变化,清空表单验证
watch(
  () => formState.buildMode,
  () => {
    formRef.value?.clearValidate();
  },
);

// 保存配置
async function handleSave() {
  try {
    // 先验证表单
    await formRef.value?.validate();

    loading.value = true;

    const payload: any = {
      projectConfigId: props.projectId,
      buildMode: formState.buildMode,
      buildCheckMode: formState.buildCheckMode,
    };

    if (isDockerfileMode.value) {
      // Dockerfile 模式
      payload.dockerfile = formState.dockerfile || undefined;
      payload.buildContext = formState.buildContext || undefined;
      payload.buildArgs = formState.buildArgs || undefined;
      payload.imageName = formState.imageName || undefined;
      payload.dockerSecretId = formState.dockerSecretId || undefined;
      payload.ossName = formState.ossName || undefined;
    } else {
      // Shell 模式
      payload.artifactName = formState.artifactName || undefined;
      payload.buildScript = formState.buildScript || undefined;
      payload.uploadScript = formState.uploadScript || undefined;
    }

    // Monorepo 配置
    payload.isMonorepo = formState.isMonorepo;
    payload.packagePath = formState.packagePath || undefined;

    await createOrUpdateBuildConfig(payload);
    message.success($t('ui.successMessage.save'));
  } catch (error) {
    console.error('保存配置失败:', error);
    // 区分验证错误和保存错误
    if (error && typeof error === 'object' && 'errorFields' in error) {
      message.error(
        $t('deploy.projectManagement.projectConfig.buildConfig.fillRequired'),
      );
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
      formState.buildMode = config.buildMode || 1;
      // Dockerfile 构建字段
      formState.dockerfile = config.dockerfile || './Dockerfile';
      formState.buildContext = config.buildContext || '.';
      formState.buildArgs = config.buildArgs || '';
      formState.imageName = config.imageName || '';
      formState.dockerSecretId = config.dockerSecretId || '';
      formState.ossName = config.ossName || '';
      // Shell 构建字段
      formState.artifactName = config.artifactName || '';
      formState.buildScript = config.buildScript || '';
      formState.uploadScript = config.uploadScript || '';
      formState.buildCheckMode = config.buildCheckMode || 1;
      // Monorepo 配置
      formState.isMonorepo = config.isMonorepo || false;
      formState.packagePath = config.packagePath || '';
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
      <!-- 构建模式选择 -->
      <FormItem
        :label="
          $t('deploy.projectManagement.projectConfig.buildConfig.buildMode')
        "
        name="buildMode"
      >
        <Select
          v-model:value="formState.buildMode"
          :placeholder="
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.buildModePlaceholder',
            )
          "
          :options="buildModeOptions"
        />
      </FormItem>

      <!-- Dockerfile 构建模式的表单 -->
      <template v-if="isDockerfileMode">
        <FormItem
          :label="
            $t('deploy.projectManagement.projectConfig.buildConfig.dockerfile')
          "
          name="dockerfile"
        >
          <Input
            v-model:value="formState.dockerfile"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.dockerfilePlaceholder',
              )
            "
          />
        </FormItem>

        <FormItem
          :label="
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.buildContext',
            )
          "
          name="buildContext"
        >
          <Input
            v-model:value="formState.buildContext"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.buildContextPlaceholder',
              )
            "
          />
        </FormItem>

        <FormItem
          :label="
            $t('deploy.projectManagement.projectConfig.buildConfig.imageName')
          "
          name="imageName"
        >
          <Input
            v-model:value="formState.imageName"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.imageNamePlaceholder',
              )
            "
          />
        </FormItem>

        <FormItem
          :label="
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.dockerSecret',
            )
          "
          name="dockerSecretId"
        >
          <Select
            v-model:value="formState.dockerSecretId"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.dockerSecretPlaceholder',
              )
            "
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
          :label="
            $t('deploy.projectManagement.projectConfig.buildConfig.ossName')
          "
          name="ossName"
        >
          <Input
            v-model:value="formState.ossName"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.ossNamePlaceholder',
              )
            "
          />
        </FormItem>

        <FormItem
          :label="
            $t('deploy.projectManagement.projectConfig.buildConfig.buildArgs')
          "
          name="buildArgs"
        >
          <Input.TextArea
            v-model:value="formState.buildArgs"
            :rows="4"
            :placeholder="buildArgsPlaceholder"
          />
        </FormItem>
      </template>

      <!-- Shell 构建模式的表单 -->
      <template v-if="isShellMode">
        <FormItem
          :label="
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.artifactName',
            )
          "
          name="artifactName"
        >
          <Input
            v-model:value="formState.artifactName"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.artifactNamePlaceholder',
              )
            "
          />
        </FormItem>

        <FormItem
          :label="
            $t('deploy.projectManagement.projectConfig.buildConfig.buildScript')
          "
          name="buildScript"
        >
          <Input.TextArea
            v-model:value="formState.buildScript"
            :rows="6"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.buildScriptPlaceholder',
              )
            "
          />
        </FormItem>

        <FormItem
          :label="
            $t('deploy.projectManagement.projectConfig.buildConfig.uploadScript')
          "
          name="uploadScript"
        >
          <Input.TextArea
            v-model:value="formState.uploadScript"
            :rows="6"
            :placeholder="
              $t(
                'deploy.projectManagement.projectConfig.buildConfig.uploadScriptPlaceholder',
              )
            "
          />
        </FormItem>
      </template>

      <!-- 构建检查模式（隐藏） -->
      <FormItem
        v-show="false"
        :label="
          $t(
            'deploy.projectManagement.projectConfig.buildConfig.buildCheckMode',
          )
        "
        name="buildCheckMode"
      >
        <Select
          v-model:value="formState.buildCheckMode"
          :placeholder="
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.buildCheckModePlaceholder',
            )
          "
          :options="buildCheckModeOptions"
        />
      </FormItem>

      <!-- Monorepo 配置 -->
      <FormItem
        :label="
          $t('deploy.projectManagement.projectConfig.buildConfig.isMonorepo')
        "
        name="isMonorepo"
      >
        <Switch v-model:checked="formState.isMonorepo" />
        <span style="margin-left: 8px; color: #666">
          {{
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.isMonorepoTip',
            )
          }}
        </span>
      </FormItem>

      <!-- 包目录路径 (Monorepo) -->
      <FormItem
        v-if="formState.isMonorepo"
        :label="
          $t('deploy.projectManagement.projectConfig.buildConfig.packagePath')
        "
        name="packagePath"
      >
        <Input
          v-model:value="formState.packagePath"
          :placeholder="
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.packagePathPlaceholder',
            )
          "
        />
        <span
          style="
            display: block;
            margin-top: 4px;
            margin-left: 0;
            font-size: 12px;
            color: #999;
          "
        >
          {{
            $t(
              'deploy.projectManagement.projectConfig.buildConfig.packagePathTip',
            )
          }}
        </span>
      </FormItem>

      <FormItem :wrapper-col="{ offset: 6, span: 18 }">
        <Button type="primary" :loading="loading" @click="handleSave">
          {{
            $t('deploy.projectManagement.projectConfig.buildConfig.saveConfig')
          }}
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
