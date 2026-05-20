<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AssetManagementApi } from '#/api/asset-management';
import { $t } from '#/locales';

defineOptions({ name: 'SslCertCheckList' });

// 弹窗状态
const modalVisible = ref(false);
const modalLoading = ref(false);
const isEdit = ref(false);
const checkingId = ref<string>(''); // 正在检查的证书ID

const formRef = ref();
const formData = ref({
  id: '',
  domain: '',
  port: 443,
  remark: '',
  enabled: true,
});

const formRules = {
  domain: [{ required: true, message: $t('healthCheck.sslCertCheck.domainRequired'), trigger: 'blur' }],
  port: [{ required: true, message: $t('healthCheck.sslCertCheck.portRequired'), trigger: 'blur' }],
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
    case 'ok': return 'success';
    case 'expiring': return 'warning';
    case 'expired': return 'error';
    case 'error': return 'default';
    default: return 'processing';
  }
};

const statusText = (status: string) => {
  switch (status) {
    case 'ok': return $t('healthCheck.sslCertCheck.statusOk');
    case 'expiring': return $t('healthCheck.sslCertCheck.statusExpiring');
    case 'expired': return $t('healthCheck.sslCertCheck.statusExpired');
    case 'error': return $t('healthCheck.sslCertCheck.statusError');
    default: return $t('healthCheck.sslCertCheck.statusPending');
  }
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'domain',
        title: $t('healthCheck.sslCertCheck.domain'),
        minWidth: 180,
        slots: { default: 'domain' },
      },
      {
        field: 'port',
        title: $t('healthCheck.sslCertCheck.port'),
        width: 80,
      },
      {
        field: 'checkStatus',
        title: $t('healthCheck.sslCertCheck.checkStatus'),
        width: 120,
        slots: { default: 'checkStatus' },
      },
      {
        field: 'daysRemaining',
        title: $t('healthCheck.sslCertCheck.daysRemaining'),
        width: 120,
        slots: { default: 'daysRemaining' },
      },
      {
        field: 'expireAt',
        title: $t('healthCheck.sslCertCheck.expireAt'),
        width: 140,
        formatter: ({ cellValue }: { cellValue: number }) => formatTimestamp(cellValue),
      },
      {
        field: 'lastCheckAt',
        title: $t('healthCheck.sslCertCheck.lastCheckAt'),
        width: 140,
        formatter: ({ cellValue }: { cellValue: number }) => formatTimestamp(cellValue),
      },
      {
        field: 'remark',
        title: $t('healthCheck.sslCertCheck.remark'),
        minWidth: 100,
      },
      {
        field: 'enabled',
        title: $t('healthCheck.sslCertCheck.enabled'),
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
    pagerConfig: { enabled: true },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const res = await AssetManagementApi.getSslCertCheckList({
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
          });
          return { total: res.total, items: res.list || [] };
        },
      },
    },
    toolbarConfig: { refresh: true },
  },
});

const openCreate = () => {
  isEdit.value = false;
  formData.value = { id: '', domain: '', port: 443, remark: '', enabled: true };
  modalVisible.value = true;
};

const openEdit = (row: AssetManagementApi.SslCertCheck) => {
  isEdit.value = true;
  formData.value = {
    id: row.id,
    domain: row.domain,
    port: row.port,
    remark: row.remark || '',
    enabled: row.enabled,
  };
  modalVisible.value = true;
};

const handleOk = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  modalLoading.value = true;
  try {
    if (isEdit.value) {
      await AssetManagementApi.updateSslCertCheck(formData.value);
      message.success($t('healthCheck.sslCertCheck.updateSuccess'));
    } else {
      await AssetManagementApi.createSslCertCheck(formData.value);
      message.success($t('healthCheck.sslCertCheck.createSuccess'));
    }
    modalVisible.value = false;
    gridApi.query();
  } catch (e: any) {
    message.error(e?.message || $t('common.operationFailed'));
  } finally {
    modalLoading.value = false;
  }
};

const handleDelete = (row: AssetManagementApi.SslCertCheck) => {
  Modal.confirm({
    title: $t('healthCheck.sslCertCheck.deleteConfirm'),
    content: `${row.domain}:${row.port}`,
    onOk: async () => {
      try {
        await AssetManagementApi.deleteSslCertCheck({ id: row.id });
        message.success($t('healthCheck.sslCertCheck.deleteSuccess'));
        gridApi.query();
      } catch (e: any) {
        message.error(e?.message || $t('common.operationFailed'));
      }
    },
  });
};

const handleCheckNow = async (row: AssetManagementApi.SslCertCheck) => {
  if (checkingId.value === row.id) return; // 防止重复点击

  checkingId.value = row.id;
  try {
    const result = await AssetManagementApi.checkNowSslCert({ id: row.id });
    message.success($t('healthCheck.sslCertCheck.checkSuccess'));
    // 更新表格中的数据
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
    <Grid :table-title="$t('healthCheck.sslCertCheck.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <Plus class="size-5" />
          {{ $t('common.create') }}
        </Button>
      </template>

      <template #domain="{ row }">
        <Tooltip v-if="row.checkError" :title="row.checkError">
          <span class="cursor-help border-b border-dashed border-gray-400">{{ row.domain }}</span>
        </Tooltip>
        <span v-else>{{ row.domain }}</span>
      </template>

      <template #checkStatus="{ row }">
        <Tag :color="statusColor(row.checkStatus)">
          {{ statusText(row.checkStatus) }}
        </Tag>
      </template>

      <template #daysRemaining="{ row }">
        <span v-if="row.checkStatus === 'pending' || row.lastCheckAt === 0" class="text-gray-400">
          {{ $t('healthCheck.sslCertCheck.notChecked') }}
        </span>
        <span
          v-else
          :class="{
            'text-red-500 font-semibold': row.daysRemaining < 0,
            'text-yellow-500 font-semibold': row.daysRemaining >= 0 && row.daysRemaining <= 30,
            'text-green-500': row.daysRemaining > 30,
          }"
        >
          {{ row.daysRemaining < 0 ? $t('healthCheck.sslCertCheck.statusExpired') : `${row.daysRemaining} ${$t('healthCheck.sslCertCheck.days')}` }}
        </span>
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
            {{ checkingId === row.id ? $t('healthCheck.sslCertCheck.checking') : $t('healthCheck.sslCertCheck.checkNow') }}
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
      :title="isEdit ? $t('healthCheck.sslCertCheck.editTitle') : $t('healthCheck.sslCertCheck.createTitle')"
      :confirm-loading="modalLoading"
      :ok-text="$t('common.confirm')"
      :cancel-text="$t('common.cancel')"
      @ok="handleOk"
    >
      <Form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
        class="mt-4"
      >
        <FormItem :label="$t('healthCheck.sslCertCheck.domain')" name="domain">
          <Input
            v-model:value="formData.domain"
            :placeholder="$t('healthCheck.sslCertCheck.domainPlaceholder')"
            :maxlength="255"
          />
        </FormItem>
        <FormItem :label="$t('healthCheck.sslCertCheck.port')" name="port">
          <InputNumber
            v-model:value="formData.port"
            :min="1"
            :max="65535"
            :placeholder="$t('healthCheck.sslCertCheck.portPlaceholder')"
            class="w-full"
          />
        </FormItem>
        <FormItem :label="$t('healthCheck.sslCertCheck.remark')" name="remark">
          <Input
            v-model:value="formData.remark"
            :placeholder="$t('healthCheck.sslCertCheck.remarkPlaceholder')"
            :maxlength="255"
          />
        </FormItem>
        <FormItem :label="$t('healthCheck.sslCertCheck.enabled')" name="enabled">
          <Switch v-model:checked="formData.enabled" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
