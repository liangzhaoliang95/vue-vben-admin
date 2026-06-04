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
import BuildModal from './modules/build-modal.vue';
import TopologyModal from './modules/topology-modal.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const businessStore = useBusinessStore();

// 拓扑预览
const topologyOpen = ref(false);
const allBranches = ref<BranchManagementApi.BranchManagement[]>([]);

// 构建弹窗
const buildModalOpen = ref(false);
const selectedBranch = ref<BranchManagementApi.BranchManagement | null>(null);

async function loadAllBranches() {
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;
  const params: any = { page: 1, pageSize: 1000 };
  if (!isSuperAdmin) {
    params.businessLineId =
      businessStore.currentBusinessLine?.businessLine.id ??
      businessStore.currentBusinessLineId;
  }
  const res = await getBranchManagementList(params);
  allBranches.value = res.items || [];
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onToggleEnabled),
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

onMounted(() => {
  loadAllBranches();
});

onActivated(() => {
  loadAllBranches();
  gridApi.query();
});

watch(
  () => businessStore.currentBusinessLineId,
  () => {
    loadAllBranches();
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
    gridApi.query();
  }
}

function onBranchNameClick(row: BranchManagementApi.BranchManagement) {
  selectedBranch.value = row;
  buildModalOpen.value = true;
}

function onRefresh() {
  loadAllBranches();
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
    <TopologyModal
      v-model:open="topologyOpen"
      :branches="allBranches"
      @refresh="onRefresh"
    />
    <BuildModal v-model:open="buildModalOpen" :branch="selectedBranch" />
    <Grid
      :table-title="$t('deploy.packageDeployManagement.branchManagement.title')"
    >
      <template #name="{ row }">
        <a
          class="cursor-pointer text-blue-500 hover:text-blue-600"
          @click="onBranchNameClick(row)"
          >{{ row.name }}</a
        >
      </template>
      <template #lastReleaseAt="{ row }">
        <span v-if="row.lastReleaseAt" class="release-badge">
          {{ new Date(row.lastReleaseAt).toLocaleString('zh-CN') }}
        </span>
        <span v-else class="text-gray-400">-</span>
      </template>
      <template #toolbar-tools>
        <Button style="margin-right: 8px" @click="onTopologyPreview">
          {{
            $t(
              'deploy.packageDeployManagement.branchManagement.topologyPreview',
            )
          }}
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
  background-color: rgb(24 144 255 / 8%) !important;
  transition: background-color 0.2s ease;
}

/* 深色模式下的悬浮效果 */
:deep(.dark .vxe-table--body) .vxe-body--row:hover {
  background-color: rgb(24 144 255 / 15%) !important;
}

.release-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  color: #fff;
  white-space: nowrap;
  background: #52c41a;
  border-radius: 4px;
}
</style>
