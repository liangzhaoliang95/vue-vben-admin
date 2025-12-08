<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed, nextTick, onActivated, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { message, Modal, Select } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import { getDeployEnvironmentList } from '#/api/project-management/deploy-environment';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';

const businessStore = useBusinessStore();

// 发布环境列表
const deployEnvironments = ref<any[]>([]);
const selectedEnvironmentId = ref<string>();

// 页面初始化状态
const isInitialized = ref(false);

// 上一次的业务线ID，用于判断是否真正变化
let lastBusinessLineId: number | undefined;

// 所有分支数据（按业务线分组）
const allBranchesMap = ref<Map<number, any[]>>(new Map());

// 当前业务线的分支选项
const currentBranchOptions = computed(() => {
  const businessLineId = lastBusinessLineId;
  if (!businessLineId) return [];

  const branches = allBranchesMap.value.get(businessLineId) || [];
  return branches.map((item) => ({
    label: item.name,
    value: item.id,
  }));
});

// 加载发布环境列表
async function loadDeployEnvironments() {
  try {
    const res = await getDeployEnvironmentList({
      page: 1,
      pageSize: 1000,
    });
    deployEnvironments.value = res.items || [];
    // 默认选择第一个环境
    if (deployEnvironments.value.length > 0 && !selectedEnvironmentId.value) {
      selectedEnvironmentId.value = deployEnvironments.value[0].id;
    }
  } catch (error) {
    console.error('加载发布环境失败:', error);
  }
}

// 发布环境选项
const environmentOptions = computed(() => {
  return deployEnvironments.value.map((env) => ({
    label: env.name,
    value: env.id,
  }));
});

// 加载所有业务线的分支数据
async function loadAllBranches() {
  const businessLines = businessStore.businessLines;
  console.log('开始加载所有业务线的分支，业务线列表:', businessLines);

  for (const bl of businessLines) {
    const businessLineId = bl.businessLine.id;
    try {
      const res = await getBranchManagementList({
        page: 1,
        pageSize: 1000,
        businessLineId,
      });
      console.log(`业务线 ${businessLineId} 的分支数据:`, res.items);
      allBranchesMap.value.set(businessLineId, res.items || []);
    } catch (error) {
      console.error(`加载业务线 ${businessLineId} 的分支失败:`, error);
    }
  }

  console.log('所有分支加载完成，allBranchesMap:', allBranchesMap.value);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: false, // 关闭自动提交，手动控制查询时机
    // 监听表单值变化
    handleValuesChange: async (values, allValues) => {
      console.log('表单值变化:', values, 'allValues:', allValues);

      // 当业务线变化时，自动加载分支并选中第一个
      if (values.businessLineId !== undefined) {
        const businessLineId = values.businessLineId;

        // 只在业务线真正变化时才执行
        if (businessLineId === lastBusinessLineId) {
          return;
        }
        lastBusinessLineId = businessLineId;

        if (businessLineId) {
          // 从缓存中获取分支数据
          const branches = allBranchesMap.value.get(businessLineId) || [];
          console.log('从缓存获取分支:', branches);

          // 转换为 Select 组件需要的格式
          const branchOptions = branches.map((item: any) => ({
            label: item.name,
            value: item.id,
          }));

          console.log('转换后的选项:', branchOptions);

          // 获取当前 schema 中 branchId 的配置
          const currentSchema = gridApi.formApi.state?.schema || [];
          const branchSchema = currentSchema.find((s: any) => s.fieldName === 'branchId');

          // 使用 updateSchema 更新分支字段
          await gridApi.formApi.updateSchema([
            {
              fieldName: 'branchId',
              componentProps: {
                ...(branchSchema?.componentProps || {}),
                options: branchOptions,
              },
            },
          ]);

          const updatedBranchSchema = gridApi.formApi.state?.schema?.find((s: any) => s.fieldName === 'branchId');
          console.log('updateSchema 后，检查 schema:', updatedBranchSchema);
          console.log('updateSchema 后，componentProps.options:', JSON.stringify(updatedBranchSchema?.componentProps?.options));

          await nextTick();

          // 自动选中第一个分支
          if (branches.length > 0) {
            console.log('自动选中分支ID:', branches[0].id);
            await gridApi.formApi.setFieldValue('branchId', branches[0].id);

            // 选中分支后触发查询
            await nextTick();
            gridApi.query();
          } else {
            console.log('没有分支数据，清空选择');
            await gridApi.formApi.setFieldValue('branchId', undefined);
          }
        } else {
          // 业务线为空时清空分支选项和值
          await gridApi.formApi.updateSchema([
            {
              fieldName: 'branchId',
              componentProps: {
                options: [],
              },
            },
          ]);

          await nextTick();
          await gridApi.formApi.setFieldValue('branchId', undefined);
        }
      }

      // 当分支变化时，触发查询
      if (values.branchId !== undefined && isInitialized.value) {
        console.log('分支变化，触发查询');
        await nextTick();
        gridApi.query();
      }
    },
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          // 如果还未初始化完成，不执行查询
          if (!isInitialized.value) {
            return {
              items: [],
              total: 0,
            };
          }

          const isSuperAdmin = businessStore.currentRole?.isSuper === true;
          const queryParams: any = {
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          };

          // 业务线筛选逻辑
          if (!isSuperAdmin) {
            delete queryParams.businessLineId;
          }

          // TODO: 实现获取打包列表的API调用
          // return await getProjectPackageList(queryParams);

          // 临时返回空数据
          return {
            items: [],
            total: 0,
          };
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
  } as VxeTableGridOptions<any>,
});

// 路由激活时刷新数据
onActivated(async () => {
  // 重置初始化状态
  isInitialized.value = false;

  // 1. 先加载发布环境数据
  await loadDeployEnvironments();

  // 2. 加载所有业务线的分支数据
  await loadAllBranches();

  // 3. 等待下一个tick确保Grid已挂载
  await nextTick();

  // 4. 设置默认表单值
  await setDefaultFormValues();

  // 5. 标记初始化完成，并触发查询
  isInitialized.value = true;

  // 6. 等待状态更新后触发查询
  await nextTick();
  gridApi.query();
});

// 设置默认表单值（不触发查询）
async function setDefaultFormValues() {
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  // 获取默认业务线ID
  let defaultBusinessLineId: number | undefined;

  if (isSuperAdmin) {
    // 超级管理员：使用第一个业务线
    const businessLines = businessStore.businessLines;
    if (businessLines.length > 0) {
      defaultBusinessLineId = businessLines[0].businessLine.id;
    }
  } else {
    // 非超级管理员：使用当前业务线
    defaultBusinessLineId = businessStore.currentBusinessLineId;
  }

  // 更新 lastBusinessLineId
  lastBusinessLineId = defaultBusinessLineId;

  // 如果有业务线ID，设置默认分支
  if (defaultBusinessLineId) {
    // 从缓存中获取分支数据
    const branches = allBranchesMap.value.get(defaultBusinessLineId) || [];
    console.log('初始化 - 从缓存获取分支:', branches);

    // 转换为 Select 组件需要的格式
    const branchOptions = branches.map((item: any) => ({
      label: item.name,
      value: item.id,
    }));

    // 获取当前 schema 中 branchId 的配置
    const currentSchema = gridApi.formApi.state?.schema || [];
    const branchSchema = currentSchema.find((s: any) => s.fieldName === 'branchId');

    // 更新分支下拉框选项
    await gridApi.formApi.updateSchema([
      {
        fieldName: 'branchId',
        componentProps: {
          ...(branchSchema?.componentProps || {}),
          options: branchOptions,
        },
      },
    ]);

    const updatedBranchSchema = gridApi.formApi.state?.schema?.find((s: any) => s.fieldName === 'branchId');
    console.log('初始化 - updateSchema 后，检查 schema:', updatedBranchSchema);
    console.log('初始化 - componentProps.options:', updatedBranchSchema?.componentProps?.options);

    const firstBranchId = branches.length > 0 ? branches[0].id : undefined;

    // 构建表单默认值
    const defaultValues: any = {
      branchId: firstBranchId,
    };

    // 如果是超级管理员，也设置业务线
    if (isSuperAdmin) {
      defaultValues.businessLineId = defaultBusinessLineId;
    }

    // 设置表单字段值
    console.log('初始化 - 即将设置表单值:', defaultValues);
    await gridApi.formApi.setValues(defaultValues);
    console.log('初始化 - 表单值设置完成');
  }
}

// 监听业务线ID变化,自动刷新数据
watch(
  () => businessStore.currentBusinessLineId,
  async () => {
    isInitialized.value = false;
    await loadDeployEnvironments();
    await loadAllBranches();
    await nextTick();
    await setDefaultFormValues();
    isInitialized.value = true;
    await nextTick();
    gridApi.query();
  },
);

function onActionClick(e: OnActionClickParams<any>) {
  switch (e.code) {
    case 'deploy': {
      onDeploy(e.row);
      break;
    }
  }
}

function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

async function onDeploy(row: any) {
  if (!selectedEnvironmentId.value) {
    message.warning(
      $t('deploy.packageDeployManagement.projectPackage.selectEnvironmentFirst'),
    );
    return;
  }

  const environment = deployEnvironments.value.find(
    (env) => env.id === selectedEnvironmentId.value,
  );
  const environmentName = environment?.name || '';

  try {
    await confirm(
      $t('deploy.packageDeployManagement.projectPackage.deployConfirm', [
        environmentName,
      ]),
      $t('deploy.packageDeployManagement.projectPackage.deploy'),
    );

    // TODO: 实现发布API调用
    // await deployPackage(row.id, selectedEnvironmentId.value);

    message.success(
      $t('deploy.packageDeployManagement.projectPackage.deploySuccess'),
    );
    gridApi.query();
  } catch (error) {
    // 用户取消或发布失败
    if (error instanceof Error && error.message !== '已取消') {
      console.error('发布失败:', error);
    }
  }
}
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('deploy.packageDeployManagement.projectPackage.title')">
      <template #toolbar-tools>
        <div class="flex items-center gap-2">
          <span>{{ $t('deploy.packageDeployManagement.projectPackage.deployEnvironment') }}:</span>
          <Select
            v-model:value="selectedEnvironmentId"
            :options="environmentOptions"
            :placeholder="$t('deploy.packageDeployManagement.projectPackage.deployEnvironmentPlaceholder')"
            class="w-48"
          />
        </div>
      </template>
    </Grid>
  </Page>
</template>
