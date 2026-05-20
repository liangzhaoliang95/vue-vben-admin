<script lang="ts" setup>
import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CdnConfigApi } from '#/api/deploy-tools/cdn-config';

import { nextTick, onActivated, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteCdnConfig, getCdnConfigList } from '#/api/deploy-tools/cdn-config';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const businessStore = useBusinessStore();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const queryParams: any = {
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };
          if (!isSuperAdmin) {
            delete queryParams.businessLineId;
          }
          return await getCdnConfigList(queryParams);
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
  } as VxeTableGridOptions<CdnConfigApi.CdnConfig>,
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

function onActionClick(e: OnActionClickParams<CdnConfigApi.CdnConfig>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() { reject(new Error('已取消')); },
      onOk() { resolve(true); },
      title,
    });
  });
}

function onEdit(row: CdnConfigApi.CdnConfig) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: CdnConfigApi.CdnConfig) {
  confirm(
    $t('ui.confirmContent.delete', [row.name]),
    $t('ui.confirmTitle.delete'),
  )
    .then(async () => {
      await deleteCdnConfig(row.id);
      message.success($t('ui.successMessage.delete'));
      gridApi.query();
    })
    .catch(() => {});
}

function onRefresh() {
  gridApi.query();
}

async function onCreate() {
  formDrawerApi.setData({});
  await nextTick();
  formDrawerApi.open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('deploy.tools.cdnConfig.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('deploy.tools.cdnConfig.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
