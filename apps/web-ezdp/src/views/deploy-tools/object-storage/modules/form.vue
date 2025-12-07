<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createObjectStorage,
  getObjectStorageDetail,
  testObjectStorageConnection,
  updateObjectStorage,
} from '#/api/deploy-tools/object-storage';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const businessStore = useBusinessStore();

const formData = ref<any>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
  handleValuesChange: async (values, fieldsChanged) => {
    // 监听 provider 字段变化
    if (fieldsChanged.includes('provider')) {
      // 获取当前的 region 值，如果已经有值（编辑场景），保留它
      const currentValues = await formApi.getValues();
      const hasExistingRegion = !!currentValues.region;
      // 判断是否是编辑场景（有 id 且有 region 值）
      const isEditingWithRegion = id.value && hasExistingRegion;

      switch (values.provider) {
        case 'ali': {
          // 选择阿里云OSS时，如果 region 为空才清空，否则保留现有值（编辑场景）
          if (!hasExistingRegion) {
            await formApi.setFieldValue('region', '');
          }
          // 更新 region 字段的 placeholder
          formApi.setState((prev) => {
            if (!prev?.schema) return prev;
            return {
              schema: prev.schema.map((item) => {
                if (item.fieldName === 'region' && item.componentProps) {
                  return {
                    ...item,
                    componentProps: {
                      ...item.componentProps,
                      placeholder: '例如：oss-cn-hangzhou',
                    },
                  };
                }
                return item;
              }),
            };
          });

          break;
        }
        case 'ecloudObs': {
          // 选择移动云Obs时，如果不是编辑场景或 region 为空，设置为默认值 wuxi
          if (!isEditingWithRegion) {
            await formApi.setFieldValue('region', 'wuxi');
          }
          // 更新 region 字段的 placeholder
          formApi.setState((prev) => {
            if (!prev?.schema) return prev;
            return {
              schema: prev.schema.map((item) => {
                if (item.fieldName === 'region' && item.componentProps) {
                  return {
                    ...item,
                    componentProps: {
                      ...item.componentProps,
                      placeholder: '例如：wuxi（移动云Obs 默认）',
                    },
                  };
                }
                return item;
              }),
            };
          });

          break;
        }
        case 'minio': {
          // 选择 MinIO 时，如果没有 region，设置默认值
          if (!values.region) {
            await formApi.setFieldValue('region', 'us-east-1');
          }
          formApi.setState((prev) => {
            if (!prev?.schema) return prev;
            return {
              schema: prev.schema.map((item) => {
                if (item.fieldName === 'region' && item.componentProps) {
                  return {
                    ...item,
                    componentProps: {
                      ...item.componentProps,
                      placeholder: '例如：us-east-1（MinIO 默认）',
                    },
                  };
                }
                return item;
              }),
            };
          });

          break;
        }
        // No default
      }
    }
  },
});

const id = ref<number>();
const testing = ref(false);
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    await handleConfirm();
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<any>();
      formApi.resetForm();

      if (data) {
        formData.value = data;
        id.value = data.id;
      } else {
        id.value = undefined;
      }

      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      // 只有在编辑时（有 id）才获取详情
      if (data && data.id) {
        // 编辑时，获取详情以获取 accessKey 和 accessSecret
        try {
          const detail = await getObjectStorageDetail(data.id);
          // 先设置 region，再设置 provider，避免 provider 变化时清空 region
          formApi.setValues({
            accessKey: detail.accessKey || '',
            accessSecret: detail.accessSecret || '',
            region: detail.region || '',
            name: detail.name,
            bucket: detail.bucket,
            endpoint: detail.endpoint,
            status: detail.status,
            businessLineId: detail.businessLineId, // 确保业务线ID被设置
          });
          // 最后设置 provider，此时 region 已经设置好了
          await nextTick();
          await formApi.setFieldValue('provider', detail.provider);
        } catch (error: any) {
          console.error('获取详情失败:', error);
          // 如果获取详情失败，使用列表数据（不包含 accessKey 和 accessSecret）
          // 先设置 region，再设置 provider，避免 provider 变化时清空 region
          formApi.setValues({
            accessKey: '',
            accessSecret: '',
            region: data.region || '',
            name: data.name,
            bucket: data.bucket,
            endpoint: data.endpoint,
            status: data.status,
            businessLineId: data.businessLineId, // 使用列表数据中的业务线ID
          });
          // 最后设置 provider，此时 region 已经设置好了
          await nextTick();
          await formApi.setFieldValue('provider', data.provider);
        }
      } else {
        // 新建时，设置业务线默认值和 provider
        const currentBusinessLine = businessStore.currentBusinessLine;
        const defaultBusinessLineId = currentBusinessLine?.businessLine.id;
        formApi.setValues({
          provider: 'minio',
          region: 'us-east-1',
          ...(defaultBusinessLineId
            ? { businessLineId: defaultBusinessLineId }
            : {}),
        });
      }
    }
  },
});

const title = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('deploy.tools.objectStorage.name')])
    : $t('ui.actionTitle.create', [$t('deploy.tools.objectStorage.name')]),
);

// 测试连接
async function handleTestConnection() {
  const values = await formApi.getValues();
  if (!values.provider) {
    return;
  }
  if (!values.accessKey || values.accessKey.trim() === '') {
    return;
  }
  if (!values.accessSecret || values.accessSecret.trim() === '') {
    return;
  }
  if (!values.bucket || values.bucket.trim() === '') {
    return;
  }
  if (!values.endpoint || values.endpoint.trim() === '') {
    return;
  }

  testing.value = true;

  // 处理 region：如果是 minio 且 region 为空，则设置为 us-east-1
  let region = values.region || '';
  if (values.provider === 'minio' && !region) {
    region = 'us-east-1';
  }

  try {
    await testObjectStorageConnection({
      provider: values.provider,
      accessKey: values.accessKey,
      accessSecret: values.accessSecret,
      bucket: values.bucket,
      endpoint: values.endpoint,
      region,
    });
    message.success('连接测试成功');
  } catch {
    // 错误消息已由全局拦截器处理，这里不需要再次显示
  } finally {
    testing.value = false;
  }
}

// 手动触发确认
async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();
  drawerApi.lock();

  // 处理 region：如果是 minio 且 region 为空，则设置为 us-east-1
  let region = values.region || '';
  if (values.provider === 'minio' && !region) {
    region = 'us-east-1';
  }

  // 只发送必要的字段
  const submitData: any = {
    name: values.name,
    businessLineId: values.businessLineId, // 包含业务线ID
    provider: values.provider,
    accessKey: values.accessKey || '',
    accessSecret: values.accessSecret || '',
    bucket: values.bucket || '',
    endpoint: values.endpoint || '',
    region,
    status: values.status ?? 1,
  };

  try {
    // 保存前先测试连接
    testing.value = true;
    try {
      await testObjectStorageConnection({
        provider: submitData.provider,
        accessKey: submitData.accessKey,
        accessSecret: submitData.accessSecret,
        bucket: submitData.bucket,
        endpoint: submitData.endpoint,
        region: submitData.region,
      });
      // 测试成功，显示提示
      message.success('连接测试通过，正在保存...');
    } catch {
      // 测试失败，阻止保存
      // 错误消息已由全局拦截器处理，这里不需要再次显示
      drawerApi.unlock();
      testing.value = false;
      return;
    } finally {
      testing.value = false;
    }

    // 测试通过，执行保存
    if (id.value) {
      await updateObjectStorage(id.value, submitData);
      message.success($t('ui.successMessage.update'));
    } else {
      await createObjectStorage(submitData);
      message.success($t('ui.successMessage.create'));
    }
    emits('success');
    drawerApi.close();
  } catch (error: any) {
    console.error('保存失败:', error);
    drawerApi.unlock();
  }
}
</script>
<template>
  <Drawer :title="title">
    <Form />
    <template #footer>
      <div class="flex justify-between">
        <Button :loading="testing" @click="handleTestConnection">
          {{ $t('deploy.tools.objectStorage.testConnection') }}
        </Button>
        <div class="flex gap-2">
          <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
          <Button type="primary" @click="handleConfirm">
            {{ $t('common.confirm') }}
          </Button>
        </div>
      </div>
    </template>
  </Drawer>
</template>
