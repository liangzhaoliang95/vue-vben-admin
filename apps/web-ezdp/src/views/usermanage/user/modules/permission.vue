<script lang="ts" setup>
import type { SystemBusinessLineApi } from '#/api/system/business-line';
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref, watch } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, message, Select } from 'ant-design-vue';

import { getBusinessLineList } from '#/api/system/business-line';
import { getRoleList } from '#/api/system/role';
import {
  deleteUserBusinessLine,
  getUserPermissions,
  saveUserPermissions,
} from '#/api/system/user';

interface PermissionRow {
  id: string;
  businessLineId?: number;
  roleId?: number;
  isExisting?: boolean; // 标记是否为已存在的权限
}

const emits = defineEmits(['success']);

const rows = ref<PermissionRow[]>([
  {
    id: '1',
  },
]);

const businessLines = ref<SystemBusinessLineApi.BusinessLine[]>([]);
const roles = ref<SystemRoleApi.Role[]>([]);
const usedBusinessLineIds = ref<Set<number>>(new Set()); // 已使用的业务线ID集合

// 根据选中的业务线过滤角色列表
const getFilteredRoles = (businessLineId?: number) => {
  if (!businessLineId) return [];
  return roles.value.filter((role) => role.businessLineId === businessLineId);
};

// 获取可用的业务线列表（排除已使用的业务线，但保留当前行已选择的业务线）
const getAvailableBusinessLines = (currentBusinessLineId?: number) => {
  return businessLines.value.filter((bl) => {
    // 如果当前行已选择此业务线，则允许显示
    if (currentBusinessLineId === bl.id) {
      return true;
    }
    // 否则，如果此业务线未被使用，则允许显示
    return !usedBusinessLineIds.value.has(bl.id);
  });
};

// 加载业务线列表
async function loadBusinessLines() {
  try {
    const res = await getBusinessLineList({ page: 1, pageSize: 1000 });
    businessLines.value = res.items || [];
  } catch (error) {
    console.error('加载业务线列表失败:', error);
    message.error('加载业务线列表失败');
  }
}

// 加载角色列表
async function loadRoles() {
  try {
    const res = await getRoleList({ page: 1, pageSize: 1000 });
    roles.value = res.items || [];
  } catch (error) {
    console.error('加载角色列表失败:', error);
    message.error('加载角色列表失败');
  }
}

// 添加一行
function addRow() {
  const newId = String(Date.now());
  rows.value.push({
    id: newId,
    isExisting: false, // 标记为新添加的行
  });
}

// 删除一行
async function removeRow(index: number) {
  const row = rows.value[index];
  if (rows.value.length === 1) {
    message.warning('至少需要保留一行');
    return;
  }

  // 从已使用集合中移除该业务线ID
  if (row.businessLineId) {
    usedBusinessLineIds.value.delete(row.businessLineId);
  }

  // 如果是已存在的权限，需要调用API删除
  if (row.isExisting && row.businessLineId) {
    const userData = drawerApi.getData<{ userId?: string }>();
    if (!userData?.userId) {
      message.error('用户ID不能为空');
      return;
    }

    try {
      await deleteUserBusinessLine(userData.userId, row.businessLineId);
      message.success('删除业务线成功');
      rows.value.splice(index, 1);
      emits('success');
    } catch (error) {
      console.error('删除业务线失败:', error);
      message.error('删除业务线失败');
      // 删除失败，恢复已使用集合
      if (row.businessLineId) {
        usedBusinessLineIds.value.add(row.businessLineId);
      }
    }
  } else {
    // 如果是新添加的行，直接删除
    rows.value.splice(index, 1);
  }
}

// 业务线改变时，清空对应的角色选择
function onBusinessLineChange(row: PermissionRow) {
  row.roleId = undefined;
}

// 监听所有行的业务线变化，更新已使用集合
watch(
  () => rows.value.map((r) => r.businessLineId),
  (newValues) => {
    // 收集当前所有使用的业务线ID
    const currentUsed = new Set<number>();
    newValues.forEach((id) => {
      if (id) {
        currentUsed.add(id);
      }
    });
    usedBusinessLineIds.value = currentUsed;
  },
  { deep: true },
);

const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<{ userId?: string; userName?: string }>();
      // 重置为默认一行
      rows.value = [{ id: '1' }];
      usedBusinessLineIds.value.clear();
      // 加载数据
      await Promise.all([loadBusinessLines(), loadRoles()]);
      // 如果有userId，加载用户当前的权限配置
      if (data?.userId) {
        await loadUserPermissions(data.userId);
      }
    }
  },
  async onConfirm() {
    // 验证数据
    for (let i = 0; i < rows.value.length; i++) {
      const row = rows.value[i];
      if (!row.businessLineId) {
        message.error(`第 ${i + 1} 行请选择业务线`);
        return;
      }
      if (!row.roleId) {
        message.error(`第 ${i + 1} 行请选择角色`);
        return;
      }
    }

    drawerApi.lock();
    try {
      const data = rows.value.map((row) => ({
        businessLineId: row.businessLineId!,
        roleId: row.roleId!,
      }));
      const userData = drawerApi.getData<{ userId?: string }>();
      if (!userData?.userId) {
        message.error('用户ID不能为空');
        drawerApi.unlock();
        return;
      }
      await saveUserPermissions(userData.userId, data);
      message.success('权限设置保存成功');
      emits('success');
      drawerApi.close();
    } catch (error) {
      console.error('保存权限设置失败:', error);
      message.error('保存权限设置失败');
      drawerApi.unlock();
    }
  },
  title: computed(() => {
    const data = drawerApi.getData<{ userName?: string }>();
    return `权限设置 - ${data?.userName || ''}`;
  }),
  width: 800,
});

// 加载用户权限
async function loadUserPermissions(userId: string) {
  try {
    const res = await getUserPermissions(userId);
    if (res.items && res.items.length > 0) {
      // 收集已使用的业务线ID
      const usedIds = new Set<number>();
      rows.value = res.items.map((item, index) => {
        usedIds.add(item.businessLineId);
        return {
          id: String(index + 1),
          businessLineId: item.businessLineId,
          roleId: item.roleId,
          isExisting: true, // 标记为已存在的权限
        };
      });
      usedBusinessLineIds.value = usedIds;
    } else {
      rows.value = [{ id: '1' }];
      usedBusinessLineIds.value.clear();
    }
  } catch (error) {
    console.error('加载用户权限失败:', error);
    message.error('加载用户权限失败');
  }
}
</script>

<template>
  <Drawer>
    <div class="space-y-4">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-muted-foreground text-sm">
          配置用户的业务线和角色权限
        </span>
        <Button type="primary" @click="addRow">
          <Plus class="mr-1 size-4" />
          添加
        </Button>
      </div>

      <div class="border-border bg-card overflow-hidden rounded-lg border">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-border bg-muted/50 border-b">
                <th
                  class="text-foreground w-64 px-4 py-3 text-left text-sm font-medium"
                >
                  业务线
                </th>
                <th
                  class="text-foreground w-64 px-4 py-3 text-left text-sm font-medium"
                >
                  角色
                </th>
                <th
                  class="text-foreground w-24 px-4 py-3 text-center text-sm font-medium"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in rows"
                :key="row.id"
                class="border-border hover:bg-muted/30 border-b transition-colors"
              >
                <td class="w-64 px-4 py-3">
                  <Select
                    v-model:value="row.businessLineId"
                    :options="
                      getAvailableBusinessLines(row.businessLineId).map(
                        (bl) => ({
                          label: bl.name,
                          value: bl.id,
                        }),
                      )
                    "
                    placeholder="请选择业务线"
                    class="w-full"
                    @change="() => onBusinessLineChange(row)"
                  />
                </td>
                <td class="w-64 px-4 py-3">
                  <Select
                    v-model:value="row.roleId"
                    :options="
                      getFilteredRoles(row.businessLineId).map((role) => ({
                        label: role.name,
                        value: role.id,
                      }))
                    "
                    :disabled="!row.businessLineId"
                    placeholder="请选择角色"
                    class="w-full"
                  />
                </td>
                <td class="w-24 px-4 py-3 text-center">
                  <Button
                    v-if="rows.length > 1"
                    type="link"
                    danger
                    size="small"
                    class="h-auto p-0"
                    @click="removeRow(index)"
                  >
                    <IconifyIcon icon="mdi:delete" class="size-4" />
                  </Button>
                  <span v-else class="text-muted-foreground text-xs">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Drawer>
</template>
