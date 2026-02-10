<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createTaskApi,
  updateTaskApi,
  type FormCollectorApi,
} from '#/api/formCollector';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<any>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid grid-cols-12 gap-x-4 gap-y-4',
});

const taskId = ref<string>();
const loading = ref(false);
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    await handleConfirm();
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<FormCollectorApi.TaskInfo>();
      formApi.resetForm();

      if (data) {
        formData.value = data;
        taskId.value = data.taskId;
      } else {
        taskId.value = undefined;
      }

      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data && data.taskId) {
        // 编辑时，设置表单值
        // 将permission数字转换为数组
        const permissionList: number[] = [];
        if (data.permission) {
          if (data.permission & 1) permissionList.push(1);
          if (data.permission & 2) permissionList.push(2);
          if (data.permission & 4) permissionList.push(4);
        }

        formApi.setValues({
          taskName: data.taskName,
          taskDesc: data.taskDesc,
          status: data.status,
          permissionList,
        });
      } else {
        // 新建时，设置默认值
        formApi.setValues({
          status: 1,
          permissionList: [],
        });
      }
    }
  },
});

const title = computed(() =>
  taskId.value ? '编辑任务' : '新增任务',
);

async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();

  // 将permissionList数组转换为permission数字
  let permission = 0;
  if (values.permissionList && Array.isArray(values.permissionList)) {
    values.permissionList.forEach((p: number) => {
      permission |= p;
    });
  }

  loading.value = true;

  try {
    if (taskId.value) {
      // 更新
      await updateTaskApi({
        taskId: taskId.value,
        taskName: values.taskName,
        taskDesc: values.taskDesc,
        status: values.status,
        permission,
      });
      message.success('更新成功');
    } else {
      // 创建
      await createTaskApi({
        taskName: values.taskName,
        taskDesc: values.taskDesc,
        permission,
      });
      message.success('创建成功');
    }

    drawerApi.close();
    emits('success');
  } catch (error: any) {
    console.error('保存失败:', error);
    // 错误信息由全局拦截器处理
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Drawer :title="title">
    <Form />
    <template #footer>
      <Button @click="drawerApi.close()">取消</Button>
      <Button type="primary" :loading="loading" @click="handleConfirm">
        确定
      </Button>
    </template>
  </Drawer>
</template>
