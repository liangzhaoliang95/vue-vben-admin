<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAuditLogApi } from '#/api/system/audit-log';

import { onActivated, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAuditLogList } from '#/api/system/audit-log';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';

defineOptions({ name: 'AuditLogList' });

const businessStore = useBusinessStore();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const { timeRange, ...rest } = formValues as any;

          const params: SystemAuditLogApi.ListParams = {
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
            ...rest,
          };

          if (!isSuperAdmin) {
            delete (params as any).businessLineId;
          }

          if (timeRange?.[0]) {
            params.startMs = timeRange[0].valueOf();
          }
          if (timeRange?.[1]) {
            params.endMs = timeRange[1].valueOf();
          }

          const res = await getAuditLogList(params);
          return { total: res.total, items: res.list || [] };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemAuditLogApi.AuditLog>,
});

onActivated(() => {
  gridApi.query();
});

watch(
  () => businessStore.currentBusinessLineId,
  () => {
    gridApi.query();
  },
);
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('system.auditLog.title')" />
  </Page>
</template>

<style scoped>
:deep(.vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.08) !important;
  transition: background-color 0.2s ease;
}

:deep(.dark .vxe-table--body) .vxe-body--row:hover {
  background-color: rgba(24, 144, 255, 0.15) !important;
}
</style>
