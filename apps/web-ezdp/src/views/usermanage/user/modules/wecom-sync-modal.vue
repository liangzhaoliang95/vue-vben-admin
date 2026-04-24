<script lang="ts" setup>
import type { TreeProps } from 'ant-design-vue';

import { computed, ref, watch } from 'vue';

import { Alert, Empty, message, Modal, Spin, Tree } from 'ant-design-vue';

import {
  getWecomSyncPreview,
  syncWecomUsers,
  type SystemUserApi,
} from '#/api/system/user';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  success: [];
  'update:open': [boolean];
}>();

type TreeNode = NonNullable<TreeProps['treeData']>[number] & {
  externalId?: string;
};

const loading = ref(false);
const confirmLoading = ref(false);
const departments = ref<SystemUserApi.WecomDepartment[]>([]);
const users = ref<SystemUserApi.WecomUser[]>([]);
const checkedState = ref<string[] | { checked: string[]; halfChecked: string[] }>(
  [],
);
const nodeMap = ref<Record<string, TreeNode>>({});

const syncableCount = computed(() => users.value.filter((item) => item.canSync).length);
const existingCount = computed(() => users.value.filter((item) => item.existsInSystem).length);
const blockedCount = computed(
  () => users.value.filter((item) => !item.canSync && !item.existsInSystem).length,
);
const checkedKeys = computed(() =>
  Array.isArray(checkedState.value)
    ? checkedState.value
    : (checkedState.value?.checked ?? []),
);
const selectedExternalIds = computed(() => {
  const ids = new Set<string>();
  for (const key of checkedKeys.value) {
    const node = nodeMap.value[key];
    if (node?.externalId) {
      ids.add(node.externalId);
    }
  }
  return [...ids];
});

const treeData = computed<TreeProps['treeData']>(() => {
  const departmentNodeMap = new Map<number, TreeNode>();
  const rootNodes: TreeNode[] = [];
  const currentNodeMap: Record<string, TreeNode> = {};

  for (const department of departments.value) {
    departmentNodeMap.set(department.id, {
      key: `dept:${department.id}`,
      title: department.name,
      disableCheckbox: true,
      children: [],
    });
  }

  for (const department of departments.value) {
    const currentNode = departmentNodeMap.get(department.id)!;
    currentNodeMap[currentNode.key as string] = currentNode;

    const parentNode = departmentNodeMap.get(department.parentId);
    if (parentNode && parentNode !== currentNode) {
      (parentNode.children ||= []).push(currentNode);
    } else {
      rootNodes.push(currentNode);
    }
  }

  for (const user of users.value) {
    for (const departmentId of user.departmentIds || []) {
      const departmentNode = departmentNodeMap.get(departmentId);
      if (!departmentNode) {
        continue;
      }

      const suffix = user.canSync
        ? '可同步'
        : user.existsInSystem
          ? '已存在'
          : user.conflictReason || '不可同步';

      const userNode: TreeNode = {
        key: `user:${departmentId}:${user.externalId}`,
        title: `${user.userName} (${user.loginName}) [${suffix}]`,
        disableCheckbox: !user.canSync,
        externalId: user.externalId,
        isLeaf: true,
      };

      currentNodeMap[userNode.key as string] = userNode;
      (departmentNode.children ||= []).push(userNode);
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => `${a.title}`.localeCompare(`${b.title}`, 'zh-CN'));
    for (const node of nodes) {
      if (node.children?.length) {
        sortNodes(node.children as TreeNode[]);
      }
    }
  };

  sortNodes(rootNodes);
  nodeMap.value = currentNodeMap;
  return rootNodes;
});

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      checkedState.value = [];
      return;
    }
    await loadPreview();
  },
);

async function loadPreview() {
  loading.value = true;
  checkedState.value = [];
  try {
    const result = await getWecomSyncPreview();
    departments.value = result.departments || [];
    users.value = result.users || [];
  } catch (error) {
    console.error('加载企微同步预览失败:', error);
    emit('update:open', false);
  } finally {
    loading.value = false;
  }
}

async function handleSync() {
  if (selectedExternalIds.value.length === 0) {
    message.warning('请先勾选需要同步的企微成员');
    return;
  }

  confirmLoading.value = true;
  try {
    const result = await syncWecomUsers(selectedExternalIds.value);
    message.success(`已同步 ${result.createdCount} 个企微成员`);
    emit('success');
    emit('update:open', false);
  } catch (error) {
    console.error('企微同步失败:', error);
  } finally {
    confirmLoading.value = false;
  }
}

function handleCancel() {
  emit('update:open', false);
}
</script>

<template>
  <Modal
    :confirm-loading="confirmLoading"
    :ok-button-props="{ disabled: selectedExternalIds.length === 0 }"
    :open="open"
    :width="920"
    destroy-on-close
    ok-text="批量同步"
    title="企微同步"
    @cancel="handleCancel"
    @ok="handleSync"
  >
    <div class="flex flex-col gap-4">
      <Alert
        show-icon
        type="info"
        :message="`共 ${users.length} 个企微成员，可同步 ${syncableCount} 个，系统已存在 ${existingCount} 个，其它冲突 ${blockedCount} 个。`"
        description="部门节点不可勾选，仅可勾选标记为“可同步”的成员；已存在或冲突成员会自动禁选。"
      />

      <div class="max-h-[560px] overflow-auto rounded border p-3">
        <Spin :spinning="loading">
          <Empty v-if="!loading && treeData?.length === 0" description="暂无可展示的企微组织数据" />
          <Tree
            v-else
            v-model:checkedKeys="checkedState"
            :check-strictly="true"
            :default-expand-all="true"
            :tree-data="treeData"
            checkable
          />
        </Spin>
      </div>
    </div>
  </Modal>
</template>
