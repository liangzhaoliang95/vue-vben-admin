<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { SystemRoleApi } from '#/api/system/role';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Tree } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getRoleMenuApi } from '#/api/core/business';
import {
  createRole,
  getAllMenus,
  updateRolePermissions,
} from '#/api/system/role';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<any>();
const menuTree = ref<SystemRoleApi.MenuTreeNode[]>([]);
const checkedMenuIds = ref<string[]>([]); // Tree 组件需要字符串数组
const expandedKeys = ref<string[]>([]);
const loadingMenus = ref(false);

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const id = ref<number>();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();

    const submitData: any = {
      ...values,
      menuIds: ensureNumberArray(checkedMenuIds.value),
    };

    (id.value
      ? updateRolePermissions(id.value, submitData)
      : createRole(submitData as any)
    )
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<any>();
      formApi.resetForm();
      checkedMenuIds.value = [];

      if (data) {
        formData.value = data;
        id.value = data.id;
        // 如果是编辑，需要加载角色的菜单权限
        if (data.id) {
          try {
            const roleMenus = await getRoleMenuApi(data.id);
            // 提取所有菜单ID（包括子菜单）
            const extractMenuIds = (menus: any[]): string[] => {
              const ids: string[] = [];
              for (const menu of menus) {
                // Tree 组件需要字符串 key
                const menuId = String(menu.id);
                ids.push(menuId);
                if (menu.children && menu.children.length > 0) {
                  ids.push(...extractMenuIds(menu.children));
                }
              }
              return ids;
            };
            checkedMenuIds.value = extractMenuIds(roleMenus as any[]);
          } catch (error) {
            console.error('加载角色菜单权限失败:', error);
          }
        }
      } else {
        id.value = undefined;
      }

      // 加载菜单树
      await loadMenus();

      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

async function loadMenus() {
  loadingMenus.value = true;
  try {
    const res = await getAllMenus();
    menuTree.value = res as SystemRoleApi.MenuTreeNode[];
    // 展开所有节点
    expandedKeys.value = getAllKeys(menuTree.value);
  } catch (error) {
    console.error('加载菜单失败:', error);
  } finally {
    loadingMenus.value = false;
  }
}

function getAllKeys(nodes: SystemRoleApi.MenuTreeNode[]): string[] {
  const keys: string[] = [];
  function traverse(nodes: SystemRoleApi.MenuTreeNode[]) {
    for (const node of nodes) {
      keys.push(String(node.id));
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return keys;
}

function convertToTreeData(nodes: SystemRoleApi.MenuTreeNode[]): DataNode[] {
  return nodes.map((node) => {
    const treeNode: DataNode = {
      key: String(node.id),
      title: node.name,
      children: node.children ? convertToTreeData(node.children) : undefined,
    };
    return treeNode;
  });
}

// 确保 menuIds 数组中的值都是数字类型
function ensureNumberArray(arr: any[]): number[] {
  return arr
    .map((item) => {
      if (typeof item === 'string') {
        const num = Number.parseInt(item, 10);
        return Number.isNaN(num) ? 0 : num;
      }
      return typeof item === 'number' ? item : 0;
    })
    .filter((item) => item > 0);
}

function onCheck(checkedKeys: any) {
  const keys = checkedKeys.checked || checkedKeys;
  // Tree 组件返回的是字符串数组，直接使用
  checkedMenuIds.value = Array.isArray(keys) ? keys.map(String) : [];
}

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('system.role.name')])
    : $t('ui.actionTitle.create', [$t('system.role.name')]),
);
</script>
<template>
  <Drawer :title="title" width="900">
    <Form />
    <div class="mt-4">
      <div class="mb-2 font-medium">
        {{ $t('system.role.menuPermissions') }}
      </div>
      <Tree
        v-if="menuTree.length > 0"
        v-model:checked-keys="checkedMenuIds"
        v-model:expanded-keys="expandedKeys"
        :checkable="true"
        :tree-data="convertToTreeData(menuTree)"
        @check="onCheck"
      />
      <div v-else-if="loadingMenus" class="py-4 text-center">
        {{ $t('common.loading') }}
      </div>
      <div v-else class="py-4 text-center text-gray-400">
        {{ $t('system.role.noMenus') }}
      </div>
    </div>
  </Drawer>
</template>
