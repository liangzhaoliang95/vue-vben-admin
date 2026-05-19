<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  SelectOption,
  Space,
  Switch,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AssetManagementApi } from '#/api/asset-management';
import { $t } from '#/locales';

defineOptions({ name: 'ImageCheckList' });

const modalVisible = ref(false);
const modalLoading = ref(false);
const isEdit = ref(false);
const checkingId = ref<string>('');

const formRef = ref();
const activeTab = ref<'manual' | 'version'>('manual');
const formData = ref<{
  id: string;
  imageName: string;
  branchId: string;
  buildVersionId: string;
  remark: string;
  enabled: boolean;
}>({
  id: '',
  imageName: '',
  branchId: '',
  buildVersionId: '',
  remark: '',
  enabled: true,
});

const manualRules = {
  imageName: [
    {
      required: true,
      message: $t('assetManagement.imageCheck.imageNameRequired'),
      trigger: 'blur',
    },
  ],
};

const versionRules = {
  branchId: [
    {
      required: true,
      message: $t('assetManagement.imageCheck.branchIdRequired'),
      trigger: 'change',
    },
  ],
  buildVersionId: [
    {
      required: true,
      message: $t('assetManagement.imageCheck.versionRequired'),
      trigger: 'change',
    },
  ],
};

const branchList = ref<AssetManagementApi.BranchItem[]>([]);
const versionList = ref<AssetManagementApi.BranchVersionItem[]>([]);
const branchLoading = ref(false);
const versionLoading = ref(false);

const loadBranchList = async () => {
  branchLoading.value = true;
  try {
    branchList.value = (await AssetManagementApi.getImageCheckBranchList()) || [];
  } catch {
    branchList.value = [];
  } finally {
    branchLoading.value = false;
  }
};

const loadVersionList = async (branchId: string) => {
  if (!branchId) {
    versionList.value = [];
    return;
  }
  versionLoading.value = true;
  try {
    versionList.value =
      (await AssetManagementApi.getImageCheckBranchVersionList({ branchId })) || [];
  } catch {
    versionList.value = [];
  } finally {
    versionLoading.value = false;
  }
};

watch(
  () => formData.value.branchId,
  (newBranchId) => {
    formData.value.buildVersionId = '';
    if (newBranchId) {
      loadVersionList(newBranchId);
    } else {
      versionList.value = [];
    }
  },
);

const onTabChange = () => {
  formRef.value?.clearValidate();
  formData.value.imageName = '';
  formData.value.branchId = '';
  formData.value.buildVersionId = '';
  versionList.value = [];
};

const formatTimestamp = (ts: number) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusColor = (status: string) => {
  switch (status) {
    case 'ok': {
      return 'success';
    }
    case 'not_found': {
      return 'error';
    }
    case 'error': {
      return 'default';
    }
    default: {
      return 'processing';
    }
  }
};

const statusText = (status: string) => {
  switch (status) {
    case 'ok': {
      return $t('assetManagement.imageCheck.statusOk');
    }
    case 'not_found': {
      return $t('assetManagement.imageCheck.statusNotFound');
    }
    case 'error': {
      return $t('assetManagement.imageCheck.statusError');
    }
    default: {
      return $t('assetManagement.imageCheck.statusPending');
    }
  }
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'imageName',
        title: $t('assetManagement.imageCheck.imageName'),
        minWidth: 220,
        slots: { default: 'imageName' },
      },
      {
        field: 'branchName',
        title: $t('assetManagement.imageCheck.branchId'),
        width: 120,
        formatter: ({ row }: { row: AssetManagementApi.ImageCheckItem }) =>
          row.branchName || '-',
      },
      {
        field: 'buildVersion',
        title: $t('assetManagement.imageCheck.version'),
        width: 120,
        formatter: ({ row }: { row: AssetManagementApi.ImageCheckItem }) =>
          row.buildVersion || '-',
      },
      {
        field: 'checkStatus',
        title: $t('assetManagement.imageCheck.checkStatus'),
        width: 120,
        slots: { default: 'checkStatus' },
      },
      {
        field: 'lastCheckAt',
        title: $t('assetManagement.imageCheck.lastCheckAt'),
        width: 150,
        formatter: ({ cellValue }: { cellValue: number }) => formatTimestamp(cellValue),
      },
      {
        field: 'remark',
        title: $t('assetManagement.imageCheck.remark'),
        minWidth: 100,
      },
      {
        field: 'enabled',
        title: $t('assetManagement.imageCheck.enabled'),
        width: 70,
        slots: { default: 'enabled' },
      },
      {
        field: 'actions',
        title: $t('common.action'),
        width: 260,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          const res = await AssetManagementApi.getImageCheckList();
          const list = res || [];
          return { page: { total: list.length }, items: list };
        },
      },
    },
    toolbarConfig: { refresh: true },
  },
});

const openCreate = async () => {
  isEdit.value = false;
  activeTab.value = 'manual';
  formData.value = { id: '', imageName: '', branchId: '', buildVersionId: '', remark: '', enabled: true };
  versionList.value = [];
  modalVisible.value = true;
  await loadBranchList();
};

const openEdit = async (row: AssetManagementApi.ImageCheckItem) => {
  isEdit.value = true;
  activeTab.value = row.mode === 'version' ? 'version' : 'manual';
  formData.value = {
    id: row.id,
    imageName: row.imageName || '',
    branchId: row.branchId || '',
    buildVersionId: row.buildVersionId || '',
    remark: row.remark || '',
    enabled: row.enabled,
  };
  versionList.value = [];
  modalVisible.value = true;
  await loadBranchList();
  if (row.branchId) {
    await loadVersionList(row.branchId);
  }
};

const handleOk = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  modalLoading.value = true;
  try {
    const base = {
      mode: activeTab.value,
      imageName: activeTab.value === 'manual' ? formData.value.imageName : undefined,
      branchId: activeTab.value === 'version' ? formData.value.branchId : undefined,
      buildVersionId: activeTab.value === 'version' ? formData.value.buildVersionId : undefined,
      remark: formData.value.remark,
      enabled: formData.value.enabled,
    };

    if (isEdit.value) {
      await AssetManagementApi.updateImageCheck({ id: formData.value.id, ...base });
      message.success($t('assetManagement.imageCheck.updateSuccess'));
    } else {
      await AssetManagementApi.createImageCheck(base);
      message.success($t('assetManagement.imageCheck.createSuccess'));
    }
    modalVisible.value = false;
    gridApi.query();
  } catch (e: any) {
    message.error(e?.message || $t('common.operationFailed'));
  } finally {
    modalLoading.value = false;
  }
};

const handleDelete = (row: AssetManagementApi.ImageCheckItem) => {
  Modal.confirm({
    title: $t('assetManagement.imageCheck.deleteConfirm'),
    content: row.imageName || `${row.branchName} ${row.buildVersion}`,
    onOk: async () => {
      try {
        await AssetManagementApi.deleteImageCheck({ id: row.id });
        message.success($t('assetManagement.imageCheck.deleteSuccess'));
        gridApi.query();
      } catch (e: any) {
        message.error(e?.message || $t('common.operationFailed'));
      }
    },
  });
};

const handleCheckNow = async (row: AssetManagementApi.ImageCheckItem) => {
  if (checkingId.value === row.id) return;

  checkingId.value = row.id;
  try {
    await AssetManagementApi.checkNowImageCheck({ id: row.id });
    message.success($t('assetManagement.imageCheck.checkSuccess'));
    await gridApi.query();
  } catch (e: any) {
    message.error(e?.message || $t('common.operationFailed'));
  } finally {
    checkingId.value = '';
  }
};

onMounted(() => {
  gridApi.query();
});
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('assetManagement.imageCheck.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <Plus class="size-5" />
          {{ $t('common.create') }}
        </Button>
      </template>

      <template #imageName="{ row }">
        <Tooltip v-if="row.checkError" :title="row.checkError">
          <span class="cursor-help border-b border-dashed border-gray-400">
            {{ row.mode === 'version' ? `${row.branchName} / ${row.buildVersion}` : row.imageName }}
          </span>
        </Tooltip>
        <span v-else>
          {{ row.mode === 'version' ? `${row.branchName} / ${row.buildVersion}` : row.imageName }}
        </span>
      </template>

      <template #checkStatus="{ row }">
        <Tag :color="statusColor(row.checkStatus)">
          {{ statusText(row.checkStatus) }}
        </Tag>
      </template>

      <template #enabled="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? $t('common.enabled') : $t('common.disabled') }}
        </Tag>
      </template>

      <template #actions="{ row }">
        <Space :size="4">
          <Button
            size="small"
            type="primary"
            :loading="checkingId === row.id"
            @click="handleCheckNow(row)"
          >
            {{
              checkingId === row.id
                ? $t('assetManagement.imageCheck.checking')
                : $t('assetManagement.imageCheck.checkNow')
            }}
          </Button>
          <Button size="small" @click="openEdit(row)">
            {{ $t('common.edit') }}
          </Button>
          <Button danger size="small" @click="handleDelete(row)">
            {{ $t('common.delete') }}
          </Button>
        </Space>
      </template>
    </Grid>

    <Modal
      v-model:open="modalVisible"
      :title="
        isEdit
          ? $t('assetManagement.imageCheck.editTitle')
          : $t('assetManagement.imageCheck.createTitle')
      "
      :confirm-loading="modalLoading"
      :ok-text="$t('common.confirm')"
      :cancel-text="$t('common.cancel')"
      @ok="handleOk"
    >
      <Tabs v-model:active-key="activeTab" class="mt-2" @change="onTabChange">
        <TabPane key="manual" :tab="$t('assetManagement.imageCheck.modeManual')">
          <Form
            ref="formRef"
            :model="formData"
            :rules="manualRules"
            layout="vertical"
            class="mt-4"
          >
            <FormItem :label="$t('assetManagement.imageCheck.imageName')" name="imageName">
              <Input
                v-model:value="formData.imageName"
                :placeholder="$t('assetManagement.imageCheck.imageNamePlaceholder')"
                :maxlength="500"
              />
            </FormItem>
            <FormItem :label="$t('assetManagement.imageCheck.remark')" name="remark">
              <Input
                v-model:value="formData.remark"
                :placeholder="$t('assetManagement.imageCheck.remarkPlaceholder')"
                :maxlength="255"
              />
            </FormItem>
            <FormItem :label="$t('assetManagement.imageCheck.enabled')" name="enabled">
              <Switch v-model:checked="formData.enabled" />
            </FormItem>
          </Form>
        </TabPane>

        <TabPane key="version" :tab="$t('assetManagement.imageCheck.modeVersion')">
          <Form
            ref="formRef"
            :model="formData"
            :rules="versionRules"
            layout="vertical"
            class="mt-4"
          >
            <FormItem :label="$t('assetManagement.imageCheck.branchId')" name="branchId">
              <Select
                v-model:value="formData.branchId"
                :placeholder="$t('assetManagement.imageCheck.branchIdPlaceholder')"
                :loading="branchLoading"
                class="w-full"
              >
                <SelectOption v-for="b in branchList" :key="b.id" :value="b.id">
                  {{ b.name }}
                </SelectOption>
              </Select>
            </FormItem>
            <FormItem :label="$t('assetManagement.imageCheck.version')" name="buildVersionId">
              <Select
                v-model:value="formData.buildVersionId"
                :placeholder="
                  formData.branchId
                    ? $t('assetManagement.imageCheck.versionPlaceholder')
                    : $t('assetManagement.imageCheck.selectBranchFirst')
                "
                :loading="versionLoading"
                :disabled="!formData.branchId"
                class="w-full"
              >
                <SelectOption v-for="v in versionList" :key="v.id" :value="v.id">
                  {{ v.version }}
                </SelectOption>
              </Select>
            </FormItem>
            <FormItem :label="$t('assetManagement.imageCheck.remark')" name="remark">
              <Input
                v-model:value="formData.remark"
                :placeholder="$t('assetManagement.imageCheck.remarkPlaceholder')"
                :maxlength="255"
              />
            </FormItem>
            <FormItem :label="$t('assetManagement.imageCheck.enabled')" name="enabled">
              <Switch v-model:checked="formData.enabled" />
            </FormItem>
          </Form>
        </TabPane>
      </Tabs>
    </Modal>
  </Page>
</template>
