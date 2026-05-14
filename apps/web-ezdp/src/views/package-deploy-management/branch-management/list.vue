<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { BranchManagementApi } from '#/api/package-deploy-management/branch-management';

import { onActivated, onMounted, ref, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getBranchManagementList,
  updateBranchManagement,
} from '#/api/package-deploy-management/branch-management';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import TopologyModal from './modules/topology-modal.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const businessStore = useBusinessStore();

// 全量分支 id -> name 映射，供父分支列显示用
const parentBranchMap = ref<Record<string, string>>({});

// 拓扑预览
const topologyOpen = ref(false);
const allBranches = ref<BranchManagementApi.BranchManagement[]>([]);

async function loadParentBranchMap() {
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;
  const params: any = { page: 1, pageSize: 1000 };
  if (!isSuperAdmin) {
    params.businessLineId =
      businessStore.currentBusinessLine?.businessLine.id ??
      businessStore.currentBusinessLineId;
  }
  const res = await getBranchManagementList(params);
  const map: Record<string, string> = {};
  for (const item of res.items || []) {
    map[item.id] = item.name;
  }
  parentBranchMap.value = map;
  allBranches.value = res.items || [];
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onToggleEnabled, parentBranchMap),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const queryParams: any = {
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };

          // 业务线筛选逻辑：
          // 1. 超级管理员：如果前端筛选条件中有businessLineId，则使用；否则不传，后端会查所有业务线
          // 2. 非超级管理员：不传businessLineId，让后端使用token中的
          if (!isSuperAdmin) {
            delete queryParams.businessLineId;
          }

          return await getBranchManagementList(queryParams);
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<BranchManagementApi.BranchManagement>,
});

// 路由激活时刷新数据
onMounted(() => {
  loadParentBranchMap();
});

onActivated(() => {
  loadParentBranchMap();
  gridApi.query();
});

// 监听业务线ID变化,自动刷新数据
watch(
  () => businessStore.currentBusinessLineId,
  () => {
    loadParentBranchMap();
    gridApi.query();
  },
);

function onActionClick(
  e: OnActionClickParams<BranchManagementApi.BranchManagement>,
) {
  switch (e.code) {
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

function onEdit(row: BranchManagementApi.BranchManagement) {
  formDrawerApi.setData(row).open();
}

// 切换分支启用状态
async function onToggleEnabled(row: BranchManagementApi.BranchManagement) {
  const newStatus = !row.enabled;
  const actionText = newStatus
    ? $t('deploy.packageDeployManagement.branchManagement.enable')
    : $t('deploy.packageDeployManagement.branchManagement.disable');

  try {
    await updateBranchManagement(row.id, {
      enabled: newStatus,
    });
    message.success(
      $t('deploy.packageDeployManagement.branchManagement.toggleSuccess', [
        actionText,
      ]),
    );
    gridApi.query();
  } catch {
    message.error(
      $t('deploy.packageDeployManagement.branchManagement.toggleFailed', [
        actionText,
      ]),
    );
    // 恢复开关状态
    gridApi.query();
  }
}

function onRefresh() {
  loadParentBranchMap();
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}

function onTopologyPreview() {
  topologyOpen.value = true;
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <TopologyModal v-model:open="topologyOpen" :branches="allBranches" @refresh="onRefresh" />
    <Grid
      :table-title="$t('deploy.packageDeployManagement.branchManagement.title')"
    >
      <template #toolbar-tools>
        <Button @click="onTopologyPreview">
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyPreview') }}
        </Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [
              $t('deploy.packageDeployManagement.branchManagement.title'),
            ])
          }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
/* 表格行悬浮效果 */
:deep(.vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.08) !important;
  transition: background-color 0.2s ease;
}

/* 深色模式下的悬浮效果 */
:deep(.dark .vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.15) !important;
}
</style>
