<script lang="ts" setup>
import { computed, onActivated, onDeactivated, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import {
  Badge,
  Button,
  Card,
  Collapse,
  CollapsePanel,
  Empty,
  message,
  Modal,
  Select,
  Spin,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import { FolderOpen, Monitor, Package, ServerCrash } from 'lucide-vue-next';

import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import {
  getBuildTaskList,
  startBuildTask,
  triggerPreBuildCheck,
} from '#/api/package-deploy-management/project-package';
import { $t } from '#/locales';
import { useWebSocketStore } from '#/store/websocket';
import { copyToClipboard } from '#/utils/clipboard';

const businessStore = useBusinessStore();
const wsStore = useWebSocketStore();

// 嵌入模式 props（从 build-modal 传入时使用）
const props = withDefaults(defineProps<{
  initialBranchId?: string;
  initialBranchName?: string;
  initialBusinessLineId?: number;
}>(), {});

// 是否嵌入模式（有 props 传入时）
const isEmbedded = computed(() => !!props.initialBranchId);

// 筛选条件
const selectedBusinessLineId = ref<number | undefined>();
const selectedBranchId = ref<string | undefined>();

// 所有分支数据（按业务线分组）
const allBranchesMap = ref<Map<number, any[]>>(new Map());

// 版本列表
const versionList = ref<any[]>([]);
const loading = ref(false);
const activeKeys = ref<string[]>([]); // 展开的版本面板

// 排序模式：version=版本内项目按类型排序，name=版本内项目按名称升序（版本列表本身始终按版本号降序）
const sortMode = ref<'name' | 'version'>('version');
const showImageName = ref(false);

// 版本列表始终按语义化版本号降序，排序模式只影响版本内的项目顺序
const sortedVersionList = computed(() => {
  return [...versionList.value].sort((a, b) => {
    const parts1 = (a.version || '').split('.').map(Number);
    const parts2 = (b.version || '').split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
      const n1 = parts1[i] ?? 0;
      const n2 = parts2[i] ?? 0;
      if (n1 !== n2) return n2 - n1;
    }
    return 0;
  });
});

// 组件是否已激活的标记
const isComponentActive = ref(true);
// 是否已经初始化过
const isInitialized = ref(false);
// 是否正在初始化中（防止重复初始化）
const isInitializing = ref(false);

// 是否是超级管理员
const isSuperAdmin = computed(
  () => businessStore.currentRole?.isSuper === true,
);

// 业务线选项
const businessLineOptions = computed(() => {
  return businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));
});

// 当前业务线的分支选项
const currentBranchOptions = computed(() => {
  const businessLineId = selectedBusinessLineId.value;
  if (!businessLineId) return [];

  const branches = allBranchesMap.value.get(businessLineId) || [];
  return branches.map((item) => ({
    label: item.name,
    value: item.id,
  }));
});

// 加载指定业务线的分支数据（懒加载）
async function loadBranchesForBusinessLine(
  businessLineId: number,
  force: boolean = false,
) {
  if (!businessLineId) {
    return;
  }

  // 如果该业务线的分支已加载且不是强制刷新，直接返回
  if (!force && allBranchesMap.value.has(businessLineId)) {
    return;
  }

  try {
    const res = await getBranchManagementList({
      page: 1,
      pageSize: 1000,
      businessLineId,
      // 嵌入模式下加载全部分支（含禁用），确保传入的分支能显示名称
      ...(isEmbedded.value ? {} : { onlyEnabled: true }),
    });
    allBranchesMap.value.set(businessLineId, res.items || []);
  } catch (error) {
    console.error(`加载业务线 ${businessLineId} 的分支失败:`, error);
    // 即使失败也设置空数组，避免重复请求
    allBranchesMap.value.set(businessLineId, []);
  }
}

// 加载版本列表
async function loadVersionList() {
  // 检查组件是否仍然激活
  if (!isComponentActive.value) {
    return;
  }

  if (!selectedBranchId.value) {
    versionList.value = [];
    loading.value = false;
    return;
  }

  // 注意：这里不设置 loading.value = true，由调用方控制
  // 这样可以避免在 init() 中出现 loading 闪烁

  try {
    const queryParams: any = {
      pageIndex: 1,
      pageSize: 1000,
      branchId: selectedBranchId.value,
    };

    // 超级管理员可以传业务线ID
    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    const res = await getBuildTaskList(queryParams);
    versionList.value = res.items || [];
  } catch (error) {
    console.error('[项目打包] 加载版本列表失败:', error);
    message.error('加载版本列表失败');
  }
}

// 初始化
async function init() {
  // 如果正在初始化中，直接返回，避免重复调用
  if (isInitializing.value) {
    return;
  }

  // 如果已经初始化过，只刷新版本列表即可
  if (isInitialized.value) {
    loading.value = true;
    try {
      await loadVersionList();
    } finally {
      loading.value = false;
    }
    return;
  }

  try {
    // 设置初始化锁和加载状态
    isInitializing.value = true;
    loading.value = true;

    // 步骤1: 设置默认业务线（仅首次）
    if (!selectedBusinessLineId.value) {
      if (props.initialBusinessLineId) {
        selectedBusinessLineId.value = props.initialBusinessLineId;
      } else if (isSuperAdmin.value) {
        const businessLines = businessStore.businessLines;
        if (businessLines && businessLines.length > 0) {
          selectedBusinessLineId.value = businessLines[0]?.businessLine.id;
        }
      } else {
        selectedBusinessLineId.value =
          businessStore.currentBusinessLineId ?? undefined;
      }
    }

    // 嵌入模式：先预注入传入的分支，确保 Select 立刻能显示名称
    if (props.initialBranchId && props.initialBranchName && selectedBusinessLineId.value) {
      const existing = allBranchesMap.value.get(selectedBusinessLineId.value) || [];
      if (!existing.some((b: any) => b.id === props.initialBranchId)) {
        allBranchesMap.value.set(selectedBusinessLineId.value, [
          { id: props.initialBranchId, name: props.initialBranchName },
          ...existing,
        ]);
      }
    }

    // 步骤2: 加载当前业务线的分支数据（懒加载策略）
    if (selectedBusinessLineId.value) {
      await loadBranchesForBusinessLine(selectedBusinessLineId.value);
    }

    // 步骤3: 设置默认分支（仅首次）
    if (!selectedBranchId.value) {
      if (props.initialBranchId) {
        selectedBranchId.value = props.initialBranchId;
      } else if (selectedBusinessLineId.value) {
        const branches =
          allBranchesMap.value.get(selectedBusinessLineId.value) || [];
        selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
      }
    }

    // 步骤4: 只有在分支列表准备好后，才加载版本列表
    await loadVersionList();

    // 订阅当前业务线的 WebSocket 日志
    if (selectedBusinessLineId.value) {
      wsStore.subscribeBusinessLine(selectedBusinessLineId.value);
    }

    // 标记为已初始化
    isInitialized.value = true;
  } finally {
    // 释放初始化锁和加载状态
    isInitializing.value = false;
    loading.value = false;
  }
}

// 业务线变化处理
async function handleBusinessLineChange(newId: number) {
  loading.value = true;
  try {
    // 加载新业务线的分支数据（如果未加载）
    await loadBranchesForBusinessLine(newId);

    const branches = allBranchesMap.value.get(newId) || [];
    selectedBranchId.value = branches.length > 0 ? branches[0].id : undefined;
    await loadVersionList();

    // 订阅新业务线的 WebSocket 日志
    wsStore.subscribeBusinessLine(newId);
  } finally {
    loading.value = false;
  }
}

// 分支变化处理
async function handleBranchChange() {
  loading.value = true;
  try {
    await loadVersionList();
  } finally {
    loading.value = false;
  }
}

// 刷新
async function handleRefresh() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }
  loading.value = true;
  try {
    await loadVersionList();
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.refreshSuccess'),
    );
  } finally {
    loading.value = false;
  }
}

// 全量获取（showAll=true，包含所有分支的最新项目版本）
async function handleShowAll() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }
  loading.value = true;
  try {
    const queryParams: any = {
      pageIndex: 1,
      pageSize: 1000,
      branchId: selectedBranchId.value,
      showAll: true,
    };

    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    const res = await getBuildTaskList(queryParams);
    versionList.value = res.items || [];
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.showAllSuccess'),
    );
  } catch (error) {
    console.error('[项目打包] 全量获取失败:', error);
    message.error(
      $t('deploy.packageDeployManagement.projectPackage.showAllFailed'),
    );
  } finally {
    loading.value = false;
  }
}

// 确认对话框
function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

// 开始构建
async function handleBuild() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }

  // 检查该分支下是否有进行中的任务
  if (hasRunningTaskInBranch()) {
    message.warning(
      $t('deploy.packageDeployManagement.projectPackage.branchHasRunningTask'),
    );
    return;
  }

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectPackage.startBuildConfirm'),
      $t('deploy.packageDeployManagement.projectPackage.startBuild'),
    );

    const queryParams: any = {
      branchId: selectedBranchId.value,
    };

    // 超级管理员可以传业务线ID
    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    await startBuildTask(queryParams);
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.buildStarted'),
    );

    // 打开全局日志查看器（taskType=1 表示构建日志）
    wsStore.openGlobalLogViewer(1);

    // 延迟刷新列表 - 检查组件是否仍然激活
    setTimeout(() => {
      if (isComponentActive.value) {
        loadVersionList();
      }
    }, 2000);
  } catch (error) {
    if (error instanceof Error && error.message !== '已取消') {
      console.error('启动构建失败:', error);
      message.error(
        $t('deploy.packageDeployManagement.projectPackage.buildStartFailed'),
      );
    }
  }
}

// 强制构建（跳过 tag 和镜像检查）
async function handleForceBuild() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }

  // 检查该分支下是否有进行中的任务
  if (hasRunningTaskInBranch()) {
    message.warning(
      $t('deploy.packageDeployManagement.projectPackage.branchHasRunningTask'),
    );
    return;
  }

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectPackage.forceBuildConfirm'),
      $t('deploy.packageDeployManagement.projectPackage.forceBuild'),
    );

    const queryParams: any = {
      branchId: selectedBranchId.value,
      forceRebuild: true, // 强制构建标记
    };

    // 超级管理员可以传业务线ID
    if (isSuperAdmin.value && selectedBusinessLineId.value) {
      queryParams.businessLineId = selectedBusinessLineId.value;
    }

    await startBuildTask(queryParams);
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.forceBuildStarted'),
    );

    // 打开全局日志查看器（taskType=1 表示构建日志）
    wsStore.openGlobalLogViewer(1);

    // 延迟刷新列表 - 检查组件是否仍然激活
    setTimeout(() => {
      if (isComponentActive.value) {
        loadVersionList();
      }
    }, 2000);
  } catch (error) {
    if (error instanceof Error && error.message !== '已取消') {
      console.error('启动强制构建失败:', error);
      message.error(
        $t(
          'deploy.packageDeployManagement.projectPackage.forceBuildStartFailed',
        ),
      );
    }
  }
}

// 检查当前分支是否有进行中的任务（pending 或 running）
function hasRunningTaskInBranch(): boolean {
  for (const version of versionList.value) {
    if (version.children && version.children.length > 0) {
      for (const task of version.children) {
        if (task.status === 'pending' || task.status === 'running') {
          return true;
        }
      }
    }
  }
  return false;
}

// 预构建检查
async function handlePreBuildCheck() {
  if (!selectedBranchId.value) {
    message.warning('请先选择分支');
    return;
  }

  // 检查该分支下是否有进行中的任务
  if (hasRunningTaskInBranch()) {
    message.warning(
      $t('deploy.packageDeployManagement.projectPackage.branchHasRunningTask'),
    );
    return;
  }

  try {
    await triggerPreBuildCheck({ branchId: selectedBranchId.value });
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.preBuildCheckStarted'),
    );
    // 打开全局日志查看器（commandId=3 表示预检查日志）
    wsStore.openGlobalLogViewer(3);
  } catch (error) {
    console.error('启动预检查失败:', error);
    message.error(
      $t(
        'deploy.packageDeployManagement.projectPackage.preBuildCheckStartFailed',
      ),
    );
  }
}

// 格式化时间
function formatTime(timestamp: number) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 获取项目类型名称
function getProjectTypeName(type: string) {
  const keyMap: Record<string, string> = {
    backend: 'deploy.packageDeployManagement.projectPackage.projectTypeBackend',
    frontend:
      'deploy.packageDeployManagement.projectPackage.projectTypeFrontend',
    submodule:
      'deploy.packageDeployManagement.projectPackage.projectTypeSubmodule',
  };
  const key = keyMap[type];
  return key
    ? $t(key)
    : type ||
        $t('deploy.packageDeployManagement.projectPackage.projectTypeDefault');
}

// 获取项目类型图标
function getProjectTypeIcon(type: string) {
  const iconMap: Record<string, any> = {
    backend: ServerCrash,
    frontend: Monitor,
    submodule: Package,
  };
  return iconMap[type] || FolderOpen;
}

// 格式化构建耗时为 hh:mm:ss
function formatDuration(ms: number) {
  if (!ms || ms <= 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 排序项目列表
function getSortedProjects(projects: any[]) {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }

  if (sortMode.value === 'name') {
    return [...projects].sort((a, b) =>
      (a.projectName || '').localeCompare(b.projectName || ''),
    );
  }

  return [...projects].sort((a, b) => {
    const typeOrder: Record<string, number> = {
      backend: 1,
      submodule: 2,
      frontend: 3,
    };

    const orderA = typeOrder[a.projectType] || 999;
    const orderB = typeOrder[b.projectType] || 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 同类型内按版本号降序（语义化版本比较）
    const versionCompare = (v1: string, v2: string) => {
      const parts1 = (v1 || '').split('.').map(Number);
      const parts2 = (v2 || '').split('.').map(Number);
      const len = Math.max(parts1.length, parts2.length);
      for (let i = 0; i < len; i++) {
        const n1 = parts1[i] ?? 0;
        const n2 = parts2[i] ?? 0;
        if (n1 !== n2) return n2 - n1;
      }
      return 0;
    };
    const versionDiff = versionCompare(a.version, b.version);
    if (versionDiff !== 0) return versionDiff;

    return (a.projectName || '').localeCompare(b.projectName || '');
  });
}

// 获取状态标签配置
function getStatusConfig(status: string) {
  const statusConfig: Record<string, { color: string; text: string }> = {
    pending: {
      color: 'default',
      text: $t('deploy.packageDeployManagement.projectPackage.status.pending'),
    },
    building: {
      color: 'processing',
      text: $t('deploy.packageDeployManagement.projectPackage.status.building'),
    },
    running: {
      color: 'processing',
      text: $t('deploy.packageDeployManagement.projectPackage.status.running'),
    },
    success: {
      color: 'success',
      text: $t('deploy.packageDeployManagement.projectPackage.status.success'),
    },
    failed: {
      color: 'error',
      text: $t('deploy.packageDeployManagement.projectPackage.status.failed'),
    },
    skipped: {
      color: 'warning',
      text: $t('deploy.packageDeployManagement.projectPackage.status.skipped'),
    },
  };
  return statusConfig[status] || statusConfig.pending;
}

// 获取大版本状态标签配置
function getVersionStatusConfig(status: string) {
  const statusConfig: Record<string, { color: string; text: string }> = {
    building: {
      color: 'processing',
      text: $t(
        'deploy.packageDeployManagement.projectPackage.versionStatus.building',
      ),
    },
    success: {
      color: 'success',
      text: $t(
        'deploy.packageDeployManagement.projectPackage.versionStatus.success',
      ),
    },
    failed: {
      color: 'error',
      text: $t(
        'deploy.packageDeployManagement.projectPackage.versionStatus.failed',
      ),
    },
  };
  return statusConfig[status] || statusConfig.building;
}

// WebSocket 消息处理器
function handleWebSocketMessage(message: any) {
  // 只处理事件类型的消息
  if (message.commandType === 'event' && message.commandId === 1) {
    const { eventType } = message.data;

    // 处理构建完成事件
    if (
      eventType === 'build_completed' && // 刷新版本列表
      isComponentActive.value
    ) {
      loadVersionList();
      message.success('构建已完成，版本列表已更新');
    }
  }
}

// 路由激活时初始化
onActivated(async () => {
  // 标记组件为激活状态
  isComponentActive.value = true;

  try {
    await init();

    // 订阅 WebSocket 事件消息（用于接收构建完成等事件）
    await wsStore.subscribe('build-event-listener', handleWebSocketMessage);
  } catch (error) {
    console.error('onActivated 初始化失败:', error);
  }
});

// 嵌入模式下（Modal 内）用 onMounted 初始化，因为没有 keep-alive
onMounted(async () => {
  if (!isEmbedded.value) return;
  isComponentActive.value = true;
  try {
    await init();
    await wsStore.subscribe('build-event-listener-modal', handleWebSocketMessage);
  } catch (error) {
    console.error('onMounted (embedded) 初始化失败:', error);
  }
});

// 复制版本为 Markdown 表格
async function copyVersionAsMarkdown(version: any) {
  if (!version.children || version.children.length === 0) {
    message.warning(
      $t('deploy.packageDeployManagement.projectPackage.noProjectData'),
    );
    return;
  }

  try {
    const versionHeader = `## 版本 ${version.version}\n\n`;
    const versionInfo = `**构建时间:** ${formatTime(version.buildTime)}\n\n`;
    const headers = ['项目名称', '项目类型', '版本号'];
    const separator = ['---', '---', '---'];
    const rows = getSortedProjects(version.children).map((project: any) => {
      return [
        project.projectName || '-',
        getProjectTypeName(project.projectType || ''),
        project.version || '-',
      ];
    });
    const markdownTable = [
      `| ${headers.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
    await copyToClipboard(versionHeader + versionInfo + markdownTable);
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.copyAsMarkdownSuccess'),
    );
  } catch (error) {
    console.error('复制失败:', error);
    message.error(
      $t('deploy.packageDeployManagement.projectPackage.copyFailed'),
    );
  }
}

// 复制版本为 JSON
async function copyVersionAsJson(version: any) {
  if (!version.children || version.children.length === 0) {
    message.warning(
      $t('deploy.packageDeployManagement.projectPackage.noProjectData'),
    );
    return;
  }
  try {
    const obj: Record<string, string> = { version: version.version || '' };
    for (const project of getSortedProjects(version.children)) {
      if (project.projectName && project.version) {
        obj[project.projectName] = project.version;
      }
    }
    await copyToClipboard(JSON.stringify(obj, null, 4));
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.copyAsJsonSuccess'),
    );
  } catch {
    message.error(
      $t('deploy.packageDeployManagement.projectPackage.copyFailed'),
    );
  }
}

// 复制版本为 YAML ConfigMap
async function copyVersionAsYaml(version: any) {
  if (!version.children || version.children.length === 0) {
    message.warning(
      $t('deploy.packageDeployManagement.projectPackage.noProjectData'),
    );
    return;
  }
  try {
    const backendProjects = getSortedProjects(version.children).filter(
      (p) => p.projectType !== 'frontend',
    );
    const frontendProjects = getSortedProjects(version.children).filter(
      (p) => p.projectType === 'frontend',
    );

    const lines: string[] = [
      'apiVersion: v1',
      'kind: ConfigMap',
      'metadata:',
      '  name: plaso-version',
      'data:',
      `  version: "${version.version || ''}"`,
    ];

    if (backendProjects.length > 0) {
      lines.push('  # 后端项目');
      for (const p of backendProjects) {
        if (p.projectName && p.version) {
          lines.push(`  ${p.projectName}: "${p.version}"`);
        }
      }
    }
    if (frontendProjects.length > 0) {
      lines.push('  # 前端项目');
      for (const p of frontendProjects) {
        if (p.projectName && p.version) {
          lines.push(`  ${p.projectName}: "${p.version}"`);
        }
      }
    }

    await copyToClipboard(lines.join('\n'));
    message.success(
      $t('deploy.packageDeployManagement.projectPackage.copyAsYamlSuccess'),
    );
  } catch {
    message.error(
      $t('deploy.packageDeployManagement.projectPackage.copyFailed'),
    );
  }
}

// changelog modal 状态
const changelogModalOpen = ref(false);
const changelogVersion = ref<any>(null);

// 解析 changelog JSON
const changelogCommits = computed(() => {
  if (!changelogVersion.value?.changelog) return [];
  try {
    return JSON.parse(changelogVersion.value.changelog);
  } catch {
    return [];
  }
});

// 打开 changelog modal
function openChangelog(version: any) {
  changelogVersion.value = version;
  changelogModalOpen.value = true;
}

// 格式化 commit 时间
function formatCommitTime(ms: number) {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 路由切换时清理资源
onDeactivated(() => {
  try {
    // 标记组件为非激活状态
    isComponentActive.value = false;

    // 取消WebSocket订阅（清理全局状态）
    // 取消构建事件监听
    wsStore.unsubscribe('build-event-listener');

    // 注意：不要调用 unsubscribeBusinessLine()
    // WebSocket 连接是全局共享的，其他页面可能还在使用

    // 清空版本列表状态，但保留其他缓存数据（分支等）
    versionList.value = [];
    activeKeys.value = [];

    // 保留 isInitialized 标记，避免重新初始化时重复加载分支数据
  } catch (error) {
    console.error('onDeactivated 清理失败:', error);
  }
});
</script>

<template>
  <component :is="isEmbedded ? 'div' : Page" v-bind="isEmbedded ? {} : { 'auto-content-height': true }">
    <div class="flex h-full flex-col gap-4">
      <!-- 筛选条件区 -->
      <Card class="flex-shrink-0">
        <!-- 第一行：分支筛选 + 版本号排序、刷新、全量获取 -->
        <div class="flex w-full items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-4">
            <!-- 业务线筛选(仅超级管理员) -->
            <div v-if="isSuperAdmin" class="flex items-center gap-2">
              <span class="filter-label">
                {{ $t('system.businessLine.name') }}:
              </span>
              <Select
                v-model:value="selectedBusinessLineId"
                :options="businessLineOptions"
                :placeholder="$t('system.businessLine.name')"
                class="w-48"
                @change="handleBusinessLineChange"
              />
            </div>

            <!-- 分支筛选 -->
            <div class="flex items-center gap-2">
              <span class="filter-label">
                {{
                  $t('deploy.packageDeployManagement.projectPackage.branch')
                }}:
              </span>
              <Select
                v-model:value="selectedBranchId"
                :options="currentBranchOptions"
                :placeholder="
                  $t(
                    'deploy.packageDeployManagement.projectPackage.branchPlaceholder',
                  )
                "
                class="w-48"
                @change="handleBranchChange"
              />
            </div>
          </div>

          <!-- 右侧：版本号排序、刷新、全量获取 -->
          <div class="flex flex-shrink-0 items-center gap-3">
            <Select
              v-model:value="sortMode"
              class="w-36"
              :options="[
                {
                  label: $t(
                    'deploy.packageDeployManagement.projectPackage.sortOrderVersion',
                  ),
                  value: 'version',
                },
                {
                  label: $t(
                    'deploy.packageDeployManagement.projectPackage.sortOrderName',
                  ),
                  value: 'name',
                },
              ]"
            />
            <Button @click="handleRefresh">
              {{ $t('deploy.packageDeployManagement.projectPackage.refresh') }}
            </Button>
            <Button @click="handleShowAll">
              {{ $t('deploy.packageDeployManagement.projectPackage.showAll') }}
            </Button>
            <Button
              :type="showImageName ? 'primary' : 'default'"
              @click="showImageName = !showImageName"
            >
              {{
                $t('deploy.packageDeployManagement.projectDeploy.showImageName')
              }}
            </Button>
          </div>
        </div>
      </Card>

      <!-- 构建操作区 -->
      <Card class="flex-shrink-0">
        <div class="flex justify-end gap-3">
          <Button
            style="
              color: #d46b08;
              background-color: #fff7e6;
              border-color: #ffd591;
            "
            @click="handlePreBuildCheck"
          >
            {{
              $t('deploy.packageDeployManagement.projectPackage.preBuildCheck')
            }}
          </Button>
          <Button type="primary" @click="handleBuild">
            {{ $t('deploy.packageDeployManagement.projectPackage.startBuild') }}
          </Button>
          <Button danger type="primary" @click="handleForceBuild">
            {{ $t('deploy.packageDeployManagement.projectPackage.forceBuild') }}
          </Button>
        </div>
      </Card>

      <!-- 版本列表 -->
      <Card class="flex-1 overflow-y-auto">
        <Spin :spinning="loading">
          <div
            v-if="versionList.length === 0"
            class="flex items-center justify-center py-20"
          >
            <Empty :description="$t('common.noData')" />
          </div>

          <Collapse
            v-else
            v-model:active-key="activeKeys"
            :bordered="false"
            expand-icon-position="start"
            class="version-collapse"
          >
            <CollapsePanel
              v-for="version in sortedVersionList"
              :key="version.id"
            >
              <template #header>
                <div class="flex w-full items-center justify-between pr-4">
                  <div class="flex items-center gap-4">
                    <Badge
                      :count="version.children?.length || 0"
                      :overflow-count="99"
                      :number-style="{ backgroundColor: '#52c41a' }"
                    >
                      <div class="version-title">
                        {{ version.version }}
                      </div>
                    </Badge>
                    <Tag
                      :color="
                        getVersionStatusConfig(
                          (version && version.status) || 'building',
                        ).color
                      "
                      class="version-status-tag"
                    >
                      {{
                        getVersionStatusConfig(
                          (version && version.status) || 'building',
                        ).text
                      }}
                    </Tag>
                    <span class="version-time">
                      {{ formatTime(version.buildTime) }}
                    </span>
                  </div>
                  <!-- 复制按钮组 -->
                  <div class="flex items-center gap-1">
                    <Tooltip
                      :title="
                        $t(
                          'deploy.packageDeployManagement.projectPackage.copyAsMarkdown',
                        )
                      "
                    >
                      <Button
                        size="small"
                        type="text"
                        @click.stop="copyVersionAsMarkdown(version)"
                      >
                        <template #icon>
                          <!-- MD icon -->
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path
                              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                            />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="8" y1="13" x2="10" y2="11" />
                            <polyline points="8 17 10 15 12 17 14 15 16 17" />
                            <line x1="16" y1="13" x2="14" y2="11" />
                          </svg>
                        </template>
                      </Button>
                    </Tooltip>
                    <Tooltip
                      :title="
                        $t(
                          'deploy.packageDeployManagement.projectPackage.copyAsJson',
                        )
                      "
                    >
                      <Button
                        size="small"
                        type="text"
                        @click.stop="copyVersionAsJson(version)"
                      >
                        <template #icon>
                          <!-- JSON icon (curly braces) -->
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path
                              d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"
                            />
                            <path
                              d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"
                            />
                          </svg>
                        </template>
                      </Button>
                    </Tooltip>
                    <Tooltip
                      :title="
                        $t(
                          'deploy.packageDeployManagement.projectPackage.copyAsYaml',
                        )
                      "
                    >
                      <Button
                        size="small"
                        type="text"
                        @click.stop="copyVersionAsYaml(version)"
                      >
                        <template #icon>
                          <!-- YAML icon (indented lines) -->
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <line x1="4" y1="6" x2="20" y2="6" />
                            <line x1="8" y1="10" x2="20" y2="10" />
                            <line x1="8" y1="14" x2="20" y2="14" />
                            <line x1="4" y1="18" x2="20" y2="18" />
                          </svg>
                        </template>
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </template>

              <!-- 项目列表（两列：左服务端，右前端） -->
              <div
                class="project-list-columns"
                :class="{
                  'project-list-columns--single':
                    getSortedProjects(version.children).filter(
                      (p) => p.projectType !== 'frontend',
                    ).length === 0 ||
                    getSortedProjects(version.children).filter(
                      (p) => p.projectType === 'frontend',
                    ).length === 0,
                }"
              >
                <!-- 服务端列 -->
                <div
                  v-if="
                    getSortedProjects(version.children).some(
                      (p) => p.projectType !== 'frontend',
                    )
                  "
                  class="project-column"
                >
                  <div class="project-column-body">
                    <template
                      v-for="project in getSortedProjects(
                        version.children,
                      ).filter((p) => p.projectType !== 'frontend')"
                      :key="project.id"
                    >
                      <div
                        class="project-item"
                        :class="[
                          `project-type-${project.projectType || 'default'}`,
                        ]"
                      >
                        <div class="project-name-col">
                          <div class="project-name-wrapper">
                            <span class="project-name">{{
                              project.projectName || '-'
                            }}</span>
                            <span
                              v-if="
                                !!(
                                  project.version &&
                                  project.version === version.version
                                )
                              "
                              class="new-badge"
                              >NEW</span
                            >
                          </div>
                          <span
                            v-if="showImageName && project.imageName"
                            class="project-image-name"
                            >{{ project.imageName
                            }}{{
                              project.imageTag ? `:${project.imageTag}` : ''
                            }}</span
                          >
                        </div>
                        <span
                          v-if="project.duration && project.duration > 0"
                          class="duration-text"
                        >
                          {{ formatDuration(project.duration) }}
                        </span>
                        <span v-else class="duration-text"></span>
                        <Tag color="blue" class="project-type-tag">
                          <span class="project-type-tag-inner">
                            <component
                              :is="
                                getProjectTypeIcon(project.projectType || '')
                              "
                              :size="15"
                              class="project-type-icon"
                              :class="`project-type-icon--${project.projectType || 'default'}`"
                            />
                            {{ getProjectTypeName(project.projectType || '') }}
                          </span>
                        </Tag>
                        <Tag
                          color="red"
                          class="version-tag version-tag--copyable"
                          :title="
                            project.version ? '点击复制版本号' : undefined
                          "
                          @click.stop="
                            project.version &&
                            copyToClipboard(project.version).then(() =>
                              message.success(`已复制：${project.version}`),
                            )
                          "
                        >
                          {{ project.version || '-' }}
                        </Tag>
                        <div class="project-actions">
                          <Tag
                            v-if="(project && project.status) !== 'success'"
                            :color="
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).color
                            "
                            class="status-tag"
                          >
                            {{
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).text
                            }}
                          </Tag>
                          <span
                            class="changelog-btn"
                            :class="{
                              'changelog-btn--empty': !project.changelog,
                            }"
                            @click.stop="
                              project.changelog && openChangelog(project)
                            "
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
                              viewBox="0 0 92 92"
                              fill="currentColor"
                              style="flex-shrink: 0"
                            >
                              <path
                                d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.672 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66L49.73 33.516v27.085a7.03 7.03 0 0 1 1.86 1.297 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.04 7.04 0 0 1 0-9.957 7.074 7.074 0 0 1 2.304-1.539V33.035a7.07 7.07 0 0 1-2.304-1.535 7.047 7.047 0 0 1-1.516-7.7L29.945 13.234 1.734 41.445a5.918 5.918 0 0 0 0 8.371l40.12 40.121a5.918 5.918 0 0 0 8.372 0l39.93-39.934a5.925 5.925 0 0 0 0-8.038z"
                              />
                            </svg>
                            {{
                              $t(
                                'deploy.packageDeployManagement.projectPackage.commitLog',
                              )
                            }}
                          </span>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
                <!-- 前端列 -->
                <div
                  v-if="
                    getSortedProjects(version.children).some(
                      (p) => p.projectType === 'frontend',
                    )
                  "
                  class="project-column"
                >
                  <div class="project-column-body">
                    <template
                      v-for="project in getSortedProjects(
                        version.children,
                      ).filter((p) => p.projectType === 'frontend')"
                      :key="project.id"
                    >
                      <div
                        class="project-item"
                        :class="[
                          `project-type-${project.projectType || 'default'}`,
                        ]"
                      >
                        <div class="project-name-col">
                          <div class="project-name-wrapper">
                            <span class="project-name">{{
                              project.projectName || '-'
                            }}</span>
                            <span
                              v-if="
                                !!(
                                  project.version &&
                                  project.version === version.version
                                )
                              "
                              class="new-badge"
                              >NEW</span
                            >
                          </div>
                          <span
                            v-if="showImageName && project.imageName"
                            class="project-image-name"
                            >{{ project.imageName
                            }}{{
                              project.imageTag ? `:${project.imageTag}` : ''
                            }}</span
                          >
                        </div>
                        <span
                          v-if="project.duration && project.duration > 0"
                          class="duration-text"
                        >
                          {{ formatDuration(project.duration) }}
                        </span>
                        <span v-else class="duration-text"></span>
                        <Tag color="blue" class="project-type-tag">
                          <span class="project-type-tag-inner">
                            <component
                              :is="
                                getProjectTypeIcon(project.projectType || '')
                              "
                              :size="15"
                              class="project-type-icon"
                              :class="`project-type-icon--${project.projectType || 'default'}`"
                            />
                            {{ getProjectTypeName(project.projectType || '') }}
                          </span>
                        </Tag>
                        <Tag
                          color="red"
                          class="version-tag version-tag--copyable"
                          :title="
                            project.version ? '点击复制版本号' : undefined
                          "
                          @click.stop="
                            project.version &&
                            copyToClipboard(project.version).then(() =>
                              message.success(`已复制：${project.version}`),
                            )
                          "
                        >
                          {{ project.version || '-' }}
                        </Tag>
                        <div class="project-actions">
                          <Tag
                            v-if="(project && project.status) !== 'success'"
                            :color="
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).color
                            "
                            class="status-tag"
                          >
                            {{
                              getStatusConfig(
                                (project && project.status) || 'pending',
                              ).text
                            }}
                          </Tag>
                          <span
                            class="changelog-btn"
                            :class="{
                              'changelog-btn--empty': !project.changelog,
                            }"
                            @click.stop="
                              project.changelog && openChangelog(project)
                            "
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
                              viewBox="0 0 92 92"
                              fill="currentColor"
                              style="flex-shrink: 0"
                            >
                              <path
                                d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.672 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66L49.73 33.516v27.085a7.03 7.03 0 0 1 1.86 1.297 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.04 7.04 0 0 1 0-9.957 7.074 7.074 0 0 1 2.304-1.539V33.035a7.07 7.07 0 0 1-2.304-1.535 7.047 7.047 0 0 1-1.516-7.7L29.945 13.234 1.734 41.445a5.918 5.918 0 0 0 0 8.371l40.12 40.121a5.918 5.918 0 0 0 8.372 0l39.93-39.934a5.925 5.925 0 0 0 0-8.038z"
                              />
                            </svg>
                            {{
                              $t(
                                'deploy.packageDeployManagement.projectPackage.commitLog',
                              )
                            }}
                          </span>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </CollapsePanel>
          </Collapse>
        </Spin>
      </Card>
    </div>
    <!-- end flex container -->

    <!-- Changelog Modal -->
    <Modal
      v-model:open="changelogModalOpen"
      :title="
        $t('deploy.packageDeployManagement.projectPackage.changelogTitle', [
          changelogVersion?.projectName || changelogVersion?.version,
        ])
      "
      :footer="null"
      width="800px"
    >
      <div
        v-if="changelogCommits.length === 0"
        class="py-8 text-center text-gray-400"
      >
        {{ $t('deploy.packageDeployManagement.projectPackage.changelogEmpty') }}
      </div>
      <div v-else class="changelog-list">
        <div
          v-for="commit in changelogCommits"
          :key="commit.id"
          class="changelog-item"
        >
          <span class="commit-title">{{ commit.title }}</span>
          <div class="commit-meta">
            <Tag color="warning" class="commit-id-tag">
              {{ commit.shortId }}
            </Tag>
            <Tag color="blue" class="commit-author-tag">
              {{ commit.authorName }}
            </Tag>
            <Tag class="commit-time-tag">
              {{ formatCommitTime(commit.committedAt) }}
            </Tag>
          </div>
        </div>
      </div>
    </Modal>
  </component>
</template>

<style scoped>
@import '../project-list-shared.css';

/* project-package 独有：项目列表列宽（含构建时长列） */
.project-item {
  grid-template-columns: repeat(5, 1fr);
  column-gap: 8px;
}

.project-item > * {
  justify-self: end;
}

.project-item > :first-child {
  justify-self: start;
}

.project-item .project-type-tag,
.project-item .version-tag,
.project-item .status-tag {
  justify-self: end;
}

.version-tag--copyable {
  cursor: pointer;
  user-select: none;
}

.version-tag--copyable:hover {
  opacity: 0.8;
}

.project-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
}

/* 复制按钮样式 */
:deep(.ant-btn-text) svg {
  transition: all 0.2s ease;
}

:deep(.ant-btn-text):hover svg {
  color: hsl(var(--primary));
  transform: scale(1.1);
}

.changelog-btn {
  display: inline-flex;
  flex-shrink: 0;
  gap: 5px;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  color: #f05033;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid #f05033;
  border-radius: 4px;
  opacity: 0.85;
  transition:
    opacity 0.15s,
    background-color 0.15s;
}

.changelog-btn:hover {
  background-color: rgb(240 80 51 / 8%);
  opacity: 1;
}

.changelog-btn--empty {
  color: hsl(var(--muted-foreground));
  cursor: default;
  border-color: hsl(var(--border));
  opacity: 0.4;
}

.changelog-btn--empty:hover {
  background-color: transparent;
  opacity: 0.4;
}

.changelog-placeholder {
  display: block;
}

.project-name-wrapper {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.new-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 16px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  letter-spacing: 0.5px;
  background: #52c41a;
  border-radius: 3px;
}

.project-item .duration-text {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: default;
}

.project-type-tag-inner {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

:deep(.project-type-icon--backend) {
  color: #69b1ff;
}

:deep(.project-type-icon--frontend) {
  color: #95de64;
}

:deep(.project-type-icon--submodule) {
  color: #ffd666;
}

:deep(.project-type-icon--default) {
  color: #d9d9d9;
}

/* Changelog Modal 样式 */
.changelog-list {
  max-height: 60vh;
  overflow-y: auto;
}

.changelog-item {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid hsl(var(--border));
}

.changelog-item:last-child {
  border-bottom: none;
}

.commit-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.4;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.commit-meta {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 90px 110px 140px;
  gap: 6px;
  align-items: center;
}

.commit-id-tag,
.commit-author-tag,
.commit-time-tag {
  justify-self: start;
  font-size: 11px;
}
</style>
