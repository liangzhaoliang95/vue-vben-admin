<script lang="ts" setup>
import type { ProjectConfigApi } from '#/api/project-management/project-config';
import type { GitRepoConfigApi } from '#/api/project-management/git-repo-config';

import { computed, ref } from 'vue';

import {
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  InputPassword,
  InputSearch,
  Modal,
  Progress,
  Select,
  Steps,
  Table,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';
import type { TableColumnType } from 'ant-design-vue';

import { useBusinessStore } from '@vben/stores';

import {
  createProjectConfig,
  fetchGitlabProjects,
} from '#/api/project-management/project-config';
import {
  getGitRepoConfigDetail,
  getGitRepoConfigList,
} from '#/api/project-management/git-repo-config';
import { $t } from '#/locales';

const emit = defineEmits<{
  (e: 'success'): void;
}>();

const businessStore = useBusinessStore();

interface ImportProjectRow extends ProjectConfigApi.GitlabProject {
  type: 'backend' | 'frontend' | 'submodule';
}

interface ImportResult {
  name: string;
  success: boolean;
  message: string;
}

interface GroupItem {
  namespace: string;
  projects: ImportProjectRow[];
}

const visible = ref(false);
const currentStep = ref(0);
const fetching = ref(false);
const selectedPlatform = ref<'gitlab' | 'github' | ''>('');

const gitlabConfig = ref({
  baseUrl: '',
  token: '',
});

const gitRepoConfigs = ref<GitRepoConfigApi.GitRepoConfig[]>([]);
const selectedRepoConfigId = ref<string>('');
const loadingConfigs = ref(false);

const gitlabProjects = ref<ImportProjectRow[]>([]);
const selectedRowKeys = ref<number[]>([]);
const searchKeyword = ref('');
const expandedGroups = ref<string[]>([]);

const importing = ref(false);
const importProgress = ref(0);
const importResults = ref<ImportResult[]>([]);
const importCompleted = ref(false);

const PERSONAL_KEY = '__personal__';

function getGroupLabel(ns: string): string {
  return ns === PERSONAL_KEY
    ? $t('deploy.projectManagement.projectConfig.import.personalProjects')
    : ns;
}

const filteredGroups = computed<GroupItem[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();

  const filtered = keyword
    ? gitlabProjects.value.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          p.pathWithNamespace.toLowerCase().includes(keyword) ||
          p.httpUrlToRepo.toLowerCase().includes(keyword) ||
          p.sshUrlToRepo.toLowerCase().includes(keyword),
      )
    : gitlabProjects.value;

  const groupMap = new Map<string, ImportProjectRow[]>();
  for (const project of filtered) {
    const ns = project.namespace || '';
    const pathNs = project.pathWithNamespace || '';

    let isGroup = project.nsKind === 'group';
    let groupKey = ns;
    let displayName = ns;

    if (!project.nsKind) {
      const lastSlash = pathNs.lastIndexOf('/');
      if (lastSlash > 0) {
        isGroup = true;
        groupKey = pathNs.substring(0, lastSlash);
        displayName = groupKey;
      }
    }

    const key = isGroup ? groupKey : PERSONAL_KEY;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(project);
  }

  const groups: GroupItem[] = [];
  for (const [key, projects] of groupMap) {
    groups.push({ namespace: key, projects });
  }
  groups.sort((a, b) => {
    if (a.namespace === PERSONAL_KEY) return 1;
    if (b.namespace === PERSONAL_KEY) return -1;
    return a.namespace.localeCompare(b.namespace);
  });

  return groups;
});

function open() {
  visible.value = true;
  resetState();
}

function resetState() {
  currentStep.value = 0;
  selectedPlatform.value = '';
  gitlabConfig.value = { baseUrl: '', token: '' };
  gitRepoConfigs.value = [];
  selectedRepoConfigId.value = '';
  gitlabProjects.value = [];
  selectedRowKeys.value = [];
  searchKeyword.value = '';
  expandedGroups.value = [];
  importing.value = false;
  importProgress.value = 0;
  importResults.value = [];
  importCompleted.value = false;
}

function handleClose() {
  visible.value = false;
  if (importCompleted.value && importResults.value.some((r) => r.success)) {
    emit('success');
  }
}

function handleCancel() {
  visible.value = false;
}

function handleSelectPlatform(platform: 'gitlab' | 'github') {
  if (platform === 'github') {
    message.info($t('deploy.projectManagement.projectConfig.import.githubNotSupported'));
    return;
  }
  selectedPlatform.value = platform;
  currentStep.value = 1;
  loadGitRepoConfigs();
}

async function loadGitRepoConfigs() {
  loadingConfigs.value = true;
  try {
    const isSuperAdmin = businessStore.currentRole?.isSuper === true;
    const params: Record<string, any> = {
      pageIndex: 1,
      pageSize: 100,
    };
    if (isSuperAdmin && businessStore.currentBusinessLineId) {
      params.businessLineId = businessStore.currentBusinessLineId;
    }
    const result = await getGitRepoConfigList(params);
    gitRepoConfigs.value = result.items || [];
  } catch {
    gitRepoConfigs.value = [];
  } finally {
    loadingConfigs.value = false;
  }
}

async function handleRepoConfigChange(configId: string) {
  if (!configId || configId === '__manual__') {
    gitlabConfig.value = { baseUrl: '', token: '' };
    return;
  }

  try {
    const detail = await getGitRepoConfigDetail(configId);
    gitlabConfig.value = {
      baseUrl: detail.baseUrl,
      token: detail.apiToken,
    };
  } catch {
    message.warning($t('deploy.projectManagement.projectConfig.import.noRepoConfig'));
  }
}

async function handleFetchProjects() {
  if (!gitlabConfig.value.baseUrl || !gitlabConfig.value.token) {
    message.warning('请填写 GitLab 地址和 Token');
    return;
  }

  fetching.value = true;
  try {
    const result = await fetchGitlabProjects({
      baseUrl: gitlabConfig.value.baseUrl,
      token: gitlabConfig.value.token,
    });

    const projects = result as unknown as { projects: ProjectConfigApi.GitlabProject[] };
    const list = projects.projects || [];
    gitlabProjects.value = list.map((p: ProjectConfigApi.GitlabProject) => ({
      ...p,
      type: guessProjectType(p.pathWithNamespace || p.name),
    }));

    if (gitlabProjects.value.length === 0) {
      message.info($t('deploy.projectManagement.projectConfig.import.noProjects'));
      return;
    }

    selectedRowKeys.value = [];

    expandedGroups.value = [];

    currentStep.value = 2;
  } catch {
    // error handled by request interceptor
  } finally {
    fetching.value = false;
  }
}

function guessProjectType(path: string): 'backend' | 'frontend' | 'submodule' {
  const lower = path.toLowerCase();
  if (
    lower.includes('frontend') ||
    lower.includes('web') ||
    lower.includes('h5') ||
    lower.includes('admin') ||
    lower.includes('mobile')
  ) {
    return 'frontend';
  }
  return 'backend';
}

function toggleProject(projectId: number) {
  const project = gitlabProjects.value.find((p) => p.gitlabProjectId === projectId);
  if (!project || project.exists) return;

  const idx = selectedRowKeys.value.indexOf(projectId);
  if (idx >= 0) {
    selectedRowKeys.value.splice(idx, 1);
  } else {
    selectedRowKeys.value.push(projectId);
  }
}

function toggleGroupAll(namespace: string) {
  const group = filteredGroups.value.find((g) => g.namespace === namespace);
  if (!group) return;

  const selectableIds = group.projects.filter((p) => !p.exists).map((p) => p.gitlabProjectId);
  const allSelected = selectableIds.every((id) => selectedRowKeys.value.includes(id));

  if (allSelected) {
    selectedRowKeys.value = selectedRowKeys.value.filter((id) => !selectableIds.includes(id));
  } else {
    const newKeys = new Set(selectedRowKeys.value);
    for (const id of selectableIds) {
      newKeys.add(id);
    }
    selectedRowKeys.value = [...newKeys];
  }
}

function toggleGroupExpand(namespace: string) {
  const idx = expandedGroups.value.indexOf(namespace);
  if (idx >= 0) {
    expandedGroups.value.splice(idx, 1);
  } else {
    expandedGroups.value.push(namespace);
  }
}

function handleTypeChange(projectId: number, val: any) {
  const project = gitlabProjects.value.find((p) => p.gitlabProjectId === projectId);
  if (project) {
    project.type = val as 'backend' | 'frontend' | 'submodule';
  }
}

async function handleStartImport() {
  const selectedProjects = gitlabProjects.value.filter((p) =>
    selectedRowKeys.value.includes(p.gitlabProjectId),
  );

  if (selectedProjects.length === 0) {
    message.warning('请至少选择一个项目');
    return;
  }

  importing.value = true;
  importProgress.value = 0;
  importResults.value = [];
  currentStep.value = 3;

  const isSuperAdmin = businessStore.currentRole?.isSuper === true;
  const total = selectedProjects.length;
  let successCount = 0;

  for (let i = 0; i < total; i++) {
    const project = selectedProjects[i]!;
    try {
      const params = {
        name: project.name,
        projectId: project.gitlabProjectId,
        projectUrl: project.httpUrlToRepo || project.sshUrlToRepo,
        type: project.type as 'backend' | 'frontend' | 'submodule',
        ...(isSuperAdmin && businessStore.currentBusinessLineId
          ? { businessLineId: businessStore.currentBusinessLineId }
          : {}),
      };

      await createProjectConfig(params as any);
      importResults.value.push({
        name: project.name,
        success: true,
        message: $t('deploy.projectManagement.projectConfig.import.itemSuccess'),
      });
      successCount++;
    } catch (error: any) {
      importResults.value.push({
        name: project.name,
        success: false,
        message:
          error?.message ||
          $t('deploy.projectManagement.projectConfig.import.itemFailed'),
      });
    }

    importProgress.value = Math.round(((i + 1) / total) * 100);
  }

  importing.value = false;
  importCompleted.value = true;

  const failedCount = total - successCount;
  if (failedCount === 0) {
    message.success($t('deploy.projectManagement.projectConfig.import.completed'));
  } else {
    message.warning(
      `${$t('deploy.projectManagement.projectConfig.import.completed')} - ${$t('deploy.projectManagement.projectConfig.import.successCount', { count: successCount })}, ${$t('deploy.projectManagement.projectConfig.import.failedCount', { count: failedCount })}`,
    );
  }
}

const resultColumns: TableColumnType[] = [
  {
    title: $t('deploy.projectManagement.projectConfig.import.nameColumn'),
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: $t('deploy.projectManagement.projectConfig.import.status'),
    key: 'success',
    width: 100,
  },
  {
    title: 'Message',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
];

const typeOptions = [
  { label: $t('deploy.projectManagement.projectConfig.type.backend'), value: 'backend' },
  { label: $t('deploy.projectManagement.projectConfig.type.frontend'), value: 'frontend' },
  { label: $t('deploy.projectManagement.projectConfig.type.submodule'), value: 'submodule' },
];

function isGroupAllSelected(namespace: string): boolean {
  const group = filteredGroups.value.find((g) => g.namespace === namespace);
  if (!group) return false;
  const selectable = group.projects.filter((p) => !p.exists);
  return selectable.length > 0 && selectable.every((p) => selectedRowKeys.value.includes(p.gitlabProjectId));
}

function isGroupPartiallySelected(namespace: string): boolean {
  const group = filteredGroups.value.find((g) => g.namespace === namespace);
  if (!group) return false;
  const selectable = group.projects.filter((p) => !p.exists);
  const selectedCount = selectable.filter((p) => selectedRowKeys.value.includes(p.gitlabProjectId)).length;
  return selectedCount > 0 && selectedCount < selectable.length;
}

defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="visible"
    :title="$t('deploy.projectManagement.projectConfig.import.title')"
    :footer="null"
    :width="960"
    :mask-closable="false"
    @cancel="handleCancel"
  >
    <Steps :current="currentStep" style="margin-bottom: 24px">
      <Steps.Step :title="$t('deploy.projectManagement.projectConfig.import.step1')" />
      <Steps.Step :title="$t('deploy.projectManagement.projectConfig.import.step2')" />
      <Steps.Step :title="$t('deploy.projectManagement.projectConfig.import.step3')" />
      <Steps.Step :title="$t('deploy.projectManagement.projectConfig.import.step4')" />
    </Steps>

    <!-- Step 0: 选择平台 -->
    <div v-if="currentStep === 0" class="platform-select">
      <div class="platform-cards">
        <div class="platform-card" @click="handleSelectPlatform('gitlab')">
          <div class="platform-logo">
            <svg viewBox="0 0 32 32" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 30.998L1.37 20.27 6.5 2.968l4.79 14.744h9.42L25.5 2.968 30.63 20.27 16 30.998z" fill="#FC6D26"/>
              <path d="M16 30.998L1.37 20.27h7.24L16 30.998z" fill="#E24329"/>
              <path d="M16 30.998L23.39 20.27h7.24L16 30.998z" fill="#FCA326"/>
              <path d="M1.37 20.27L6.5 2.968l4.79 14.744H1.37z" fill="#E24329"/>
              <path d="M30.63 20.27L25.5 2.968l-4.79 14.744h9.92z" fill="#E24329"/>
              <path d="M6.5 2.968L11.29 17.712 1.37 20.27 6.5 2.968z" fill="#FC6D26"/>
              <path d="M25.5 2.968L20.71 17.712 30.63 20.27 25.5 2.968z" fill="#FC6D26"/>
            </svg>
          </div>
          <div class="platform-name">GitLab</div>
          <div class="platform-desc">{{ $t('deploy.projectManagement.projectConfig.import.platformSupported') }}</div>
        </div>

        <Tooltip :title="$t('deploy.projectManagement.projectConfig.import.githubNotSupported')">
          <div class="platform-card platform-card-disabled" @click="handleSelectPlatform('github')">
            <div class="platform-logo">
              <svg viewBox="0 0 32 32" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M16 0C7.16 0 0 7.16 0 16c0 7.08 4.58 13.06 10.94 15.18.8.15 1.1-.35 1.1-.77 0-.38-.02-1.64-.02-2.97-4.45.97-5.39-2.15-5.39-2.15-.73-1.85-1.78-2.34-1.78-2.34-1.45-.99.11-.97.11-.97 1.61.11 2.45 1.65 2.45 1.65 1.43 2.45 3.75 1.74 4.67 1.33.14-1.03.56-1.74 1.01-2.14-3.55-.4-7.28-1.78-7.28-7.9 0-1.75.63-3.18 1.65-4.3-.17-.4-.72-2.04.15-4.24 0 0 1.35-.43 4.4 1.64a15.3 15.3 0 014.01-.54c1.36.01 2.73.18 4.01.54 3.06-2.07 4.4-1.64 4.4-1.64.87 2.2.32 3.84.16 4.24 1.03 1.12 1.64 2.55 1.64 4.3 0 6.14-3.74 7.5-7.3 7.88.57.5 1.08 1.47 1.08 2.96 0 2.14-.02 3.86-.02 4.39 0 .43.29.93 1.1.77C27.42 29.06 32 23.08 32 16 32 7.16 24.84 0 16 0z" fill="#8b949e"/>
              </svg>
            </div>
            <div class="platform-name">GitHub</div>
            <div class="platform-desc">{{ $t('deploy.projectManagement.projectConfig.import.platformNotSupported') }}</div>
          </div>
        </Tooltip>
      </div>
      <div style="display: flex; justify-content: flex-end; margin-top: 24px">
        <Button @click="handleCancel">{{ $t('deploy.projectManagement.projectConfig.import.close') }}</Button>
      </div>
    </div>

    <!-- Step 1: 配置连接 -->
    <div v-if="currentStep === 1">
      <div style="margin-bottom: 16px; color: hsl(var(--foreground) / 0.55)">
        <Tag color="blue">GitLab</Tag>
        {{ $t('deploy.projectManagement.projectConfig.import.step1Desc') }}
      </div>
      <Form layout="vertical">
        <FormItem :label="$t('deploy.projectManagement.projectConfig.import.selectRepoConfig')">
          <Select
            v-model:value="selectedRepoConfigId"
            :placeholder="$t('deploy.projectManagement.projectConfig.import.selectRepoConfigPlaceholder')"
            :loading="loadingConfigs"
            style="width: 100%"
            @change="handleRepoConfigChange"
          >
            <Select.Option value="__manual__">
              {{ $t('deploy.projectManagement.projectConfig.import.manualInput') }}
            </Select.Option>
            <Select.Option
              v-for="config in gitRepoConfigs"
              :key="config.id"
              :value="config.id"
              :label="`${config.name} (${config.baseUrl})`"
            >
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span>{{ config.name }}</span>
                <span style="color: hsl(var(--foreground) / 0.45); font-size: 12px">{{ config.baseUrl }}</span>
              </div>
            </Select.Option>
          </Select>
        </FormItem>
        <template v-if="!gitRepoConfigs.length || selectedRepoConfigId === '__manual__'">
          <FormItem :label="$t('deploy.projectManagement.projectConfig.import.baseUrl')">
            <Input v-model:value="gitlabConfig.baseUrl" :placeholder="$t('deploy.projectManagement.projectConfig.import.baseUrlPlaceholder')" />
          </FormItem>
          <FormItem :label="$t('deploy.projectManagement.projectConfig.import.token')">
            <InputPassword v-model:value="gitlabConfig.token" :placeholder="$t('deploy.projectManagement.projectConfig.import.tokenPlaceholder')" />
          </FormItem>
        </template>
      </Form>
      <div style="display: flex; justify-content: space-between; gap: 8px">
        <Button @click="currentStep = 0">{{ $t('deploy.projectManagement.projectConfig.import.previous') }}</Button>
        <div style="display: flex; gap: 8px">
          <Button @click="handleCancel">{{ $t('deploy.projectManagement.projectConfig.import.close') }}</Button>
          <Button type="primary" :loading="fetching" @click="handleFetchProjects">{{ $t('deploy.projectManagement.projectConfig.import.fetchProjects') }}</Button>
        </div>
      </div>
    </div>

    <!-- Step 2: 选择项目（不使用 Collapse，用普通 div 实现，避免暗黑模式兼容问题） -->
    <div v-if="currentStep === 2">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
        <span>
          {{ $t('deploy.projectManagement.projectConfig.import.selected', { count: selectedRowKeys.length }) }}
        </span>
        <InputSearch
          v-model:value="searchKeyword"
          :placeholder="$t('deploy.projectManagement.projectConfig.import.searchPlaceholder')"
          style="width: 280px"
          allow-clear
          size="small"
        />
      </div>

      <div class="group-list" style="max-height: 480px; overflow-y: auto">
        <div v-for="group in filteredGroups" :key="group.namespace" class="group-section">
          <div class="group-section-header" @click="toggleGroupExpand(group.namespace)">
            <span class="group-section-arrow">{{ expandedGroups.includes(group.namespace) ? '▼' : '▶' }}</span>
            <Checkbox
              :checked="isGroupAllSelected(group.namespace)"
              :indeterminate="isGroupPartiallySelected(group.namespace)"
              @click.stop
              @change="toggleGroupAll(group.namespace)"
            />
            <span class="group-section-name">{{ getGroupLabel(group.namespace) }}</span>
            <Tag style="margin-left: 4px" size="small">{{ group.projects.length }}</Tag>
          </div>
          <div v-show="expandedGroups.includes(group.namespace)">
            <div
              v-for="project in group.projects"
              :key="project.gitlabProjectId"
              class="project-row"
              :class="{ 'project-row-disabled': project.exists }"
            >
              <Checkbox
                :checked="selectedRowKeys.includes(project.gitlabProjectId)"
                :disabled="project.exists"
                @change="toggleProject(project.gitlabProjectId)"
              />
              <div class="project-info">
                <div class="project-name">
                  <span class="project-id">#{{ project.gitlabProjectId }}</span>
                  {{ project.name }}
                  <Tag v-if="project.exists" color="default" size="small" style="margin-left: 4px">
                    {{ $t('deploy.projectManagement.projectConfig.import.statusExists') }}
                  </Tag>
                </div>
                <div class="project-url">{{ project.httpUrlToRepo || project.sshUrlToRepo }}</div>
              </div>
              <Select
                :value="project.type"
                :options="typeOptions"
                :disabled="project.exists"
                style="width: 110px; flex-shrink: 0"
                size="small"
                @change="(val: any) => handleTypeChange(project.gitlabProjectId, val)"
              />
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 16px; gap: 8px">
        <Button @click="currentStep = 1">{{ $t('deploy.projectManagement.projectConfig.import.previous') }}</Button>
        <Button type="primary" :disabled="selectedRowKeys.length === 0" @click="handleStartImport">
          {{ $t('deploy.projectManagement.projectConfig.import.startImport') }}
        </Button>
      </div>
    </div>

    <!-- Step 3: 导入进度 -->
    <div v-if="currentStep === 3">
      <Progress :percent="importProgress" :status="importCompleted ? 'success' : 'active'" style="margin-bottom: 16px" />
      <div v-if="importing" style="margin-bottom: 16px; color: hsl(var(--foreground) / 0.55)">
        {{ $t('deploy.projectManagement.projectConfig.import.importing') }}
        {{ importResults.length }}/{{ selectedRowKeys.length }}
      </div>
      <div v-if="importCompleted" style="margin-bottom: 16px">
        <Tag color="green">{{ $t('deploy.projectManagement.projectConfig.import.successCount', { count: importResults.filter((r) => r.success).length }) }}</Tag>
        <Tag v-if="importResults.some((r) => !r.success)" color="red">
          {{ $t('deploy.projectManagement.projectConfig.import.failedCount', { count: importResults.filter((r) => !r.success).length }) }}
        </Tag>
      </div>
      <Table
        v-if="importResults.length > 0"
        :columns="resultColumns"
        :data-source="importResults"
        :row-key="(record: ImportResult) => record.name"
        :pagination="false"
        size="small"
        :scroll="{ y: 300 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'success'">
            <Tag :color="record.success ? 'green' : 'red'">{{ record.message }}</Tag>
          </template>
        </template>
      </Table>
      <div v-if="importCompleted" style="display: flex; justify-content: flex-end; margin-top: 16px">
        <Button type="primary" @click="handleClose">{{ $t('deploy.projectManagement.projectConfig.import.close') }}</Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.platform-select { padding: 20px 0; }
.platform-cards { display: flex; justify-content: center; gap: 24px; }
.platform-card {
  width: 200px; padding: 32px 24px; border: 2px solid hsl(var(--border));
  border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.3s ease;
  background: hsl(var(--background));
}
.platform-card:hover { border-color: #1677ff; box-shadow: 0 4px 12px rgba(22, 119, 255, 0.15); }
.platform-card:active { transform: scale(0.98); }
.platform-card-disabled { opacity: 0.55; cursor: not-allowed; background: hsl(var(--background-deep)); }
.platform-card-disabled:hover { border-color: hsl(var(--border)); box-shadow: none; }
.platform-logo { margin-bottom: 12px; display: flex; justify-content: center; }
.platform-name { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
.platform-desc { font-size: 12px; color: hsl(var(--foreground) / 0.55); }

/* 群组分组样式 - 不依赖 Collapse 组件 */
.group-section {
  margin-bottom: 6px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
}
.group-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: hsl(var(--background-deep));
  cursor: pointer;
  user-select: none;
}
.group-section-arrow {
  font-size: 10px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}
.group-section-name {
  font-weight: 600;
  font-size: 13px;
}

.project-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px 7px 36px;
  border-top: 1px solid hsl(var(--border));
  transition: background 0.15s;
}
.project-row:hover { background: rgba(22, 119, 255, 0.04); }
.project-row-disabled { opacity: 0.5; }
.project-info { flex: 1; min-width: 0; }
.project-name { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.project-id { font-size: 12px; color: hsl(var(--foreground) / 0.45); font-weight: 400; font-family: monospace; }
.project-url { font-size: 12px; color: hsl(var(--foreground) / 0.55); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
