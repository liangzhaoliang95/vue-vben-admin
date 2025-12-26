import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DeployEnvironmentApi } from '#/api/project-management/deploy-environment';

import { ref } from 'vue';

import { useBusinessStore } from '@vben/stores';

import { getK8sSecretList } from '#/api/deploy-tools/k8s-secret';
import { getObjectStorageList } from '#/api/deploy-tools/object-storage';
import { $t } from '#/locales';

// 缓存对象存储和K8S集群列表，用于显示名称
const objectStorageMap = ref<Map<string, string>>(new Map());
const k8sSecretMap = ref<Map<string, string>>(new Map());

// 加载对象存储和K8S集群列表（用于显示名称）
// 注意：不传businessLineId，后端会根据用户角色自动处理：
// - 超级管理员：返回所有业务线的数据
// - 非超级管理员：返回token中业务线ID的数据
export async function loadReferenceData() {
  try {
    // 加载对象存储列表
    const objectStorageRes = await getObjectStorageList({
      pageIndex: 1,
      pageSize: 1000,
    });
    const newObjectStorageMap = new Map<string, string>();
    if (objectStorageRes.items) {
      objectStorageRes.items.forEach((item) => {
        newObjectStorageMap.set(item.id, item.name);
      });
    }
    objectStorageMap.value = newObjectStorageMap;

    // 加载K8S集群列表
    const k8sSecretRes = await getK8sSecretList({ pageIndex: 1, pageSize: 1000 });
    const newK8sSecretMap = new Map<string, string>();
    if (k8sSecretRes.items) {
      k8sSecretRes.items.forEach((item) => {
        newK8sSecretMap.set(item.id, item.name);
      });
    }
    k8sSecretMap.value = newK8sSecretMap;
  } catch (error) {
    console.error('加载参考数据失败:', error);
  }
}

// 初始化时加载参考数据
loadReferenceData();

export function useFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    // 业务线字段：仅超级管理员可见和可编辑
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect',
            componentProps: {
              api: async () => {
                const { getBusinessLineList } = await import(
                  '#/api/system/business-line'
                );
                const res = await getBusinessLineList({
                  pageIndex: 1,
                  pageSize: 1000,
                });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              style: { width: '100%' },
              placeholder: $t('system.businessLine.name'),
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
            rules: 'required',
          },
        ]
      : []),
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('deploy.packageDeployManagement.environmentConfig.name'),
      rules: 'required',
      componentProps: {
        placeholder: $t(
          'deploy.packageDeployManagement.environmentConfig.namePlaceholder',
        ),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'sortOrder',
      label: $t('deploy.packageDeployManagement.environmentConfig.sortOrder'),
      componentProps: {
        placeholder: $t(
          'deploy.packageDeployManagement.environmentConfig.sortOrderPlaceholder',
        ),
        min: 0,
        style: { width: '100%' },
      },
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('deploy.packageDeployManagement.environmentConfig.description'),
      componentProps: {
        placeholder: $t(
          'deploy.packageDeployManagement.environmentConfig.descriptionPlaceholder',
        ),
        rows: 3,
      },
    },
    {
      component: 'Switch',
      fieldName: 'isAgentDeploy',
      label: $t(
        'deploy.packageDeployManagement.environmentConfig.isAgentDeploy',
      ),
      componentProps: {
        checkedText: $t('common.yes'),
        uncheckedText: $t('common.no'),
      },
      defaultValue: false,
    },
    {
      component: 'ApiSelect',
      fieldName: 'frontendStorageId',
      label: $t(
        'deploy.packageDeployManagement.environmentConfig.frontendStorage',
      ),
      ifShow: (values) => !values?.isAgentDeploy,
      componentProps: {
        api: async (params?: any) => {
          const res = await getObjectStorageList({
            pageIndex: 1,
            pageSize: 1000,
            ...params,
          });
          return res.items || [];
        },
        params: (() => {
          // 初始加载时使用当前业务线
          const businessLineId = businessStore.currentBusinessLineId;
          return businessLineId ? { businessLineId } : {};
        })(),
        fieldNames: { label: 'name', value: 'id' },
        style: { width: '100%' },
        placeholder: $t(
          'deploy.packageDeployManagement.environmentConfig.frontendStoragePlaceholder',
        ),
        allowClear: true,
      },
      dependencies: {
        triggerFields: ['businessLineId'],
        componentProps: async (formValues: any) => {
          // 当业务线ID变化时，更新params，ApiComponent会自动重新加载
          const businessLineId =
            formValues?.businessLineId || businessStore.currentBusinessLineId;
          return {
            params: businessLineId ? { businessLineId } : {},
          };
        },
      },
    },
    {
      component: 'Input',
      fieldName: 'frontendBaseUrl',
      label: $t(
        'deploy.packageDeployManagement.environmentConfig.frontendBaseUrl',
      ),
      ifShow: (values) => !values?.isAgentDeploy,
      componentProps: {
        placeholder: $t(
          'deploy.packageDeployManagement.environmentConfig.frontendBaseUrlPlaceholder',
        ),
      },
    },
    {
      component: 'ApiSelect',
      fieldName: 'backendSecretId',
      label: $t(
        'deploy.packageDeployManagement.environmentConfig.backendCluster',
      ),
      ifShow: (values) => !values?.isAgentDeploy,
      componentProps: {
        api: async (params?: any) => {
          const res = await getK8sSecretList({
            pageIndex: 1,
            pageSize: 1000,
            ...params,
          });
          return res.items || [];
        },
        params: (() => {
          // 初始加载时使用当前业务线
          const businessLineId = businessStore.currentBusinessLineId;
          return businessLineId ? { businessLineId } : {};
        })(),
        fieldNames: { label: 'name', value: 'id' },
        style: { width: '100%' },
        placeholder: $t(
          'deploy.packageDeployManagement.environmentConfig.backendClusterPlaceholder',
        ),
        allowClear: true,
      },
      dependencies: {
        triggerFields: ['businessLineId'],
        componentProps: async (formValues: any) => {
          // 当业务线ID变化时，更新params，ApiComponent会自动重新加载
          const businessLineId =
            formValues?.businessLineId || businessStore.currentBusinessLineId;
          return {
            params: businessLineId ? { businessLineId } : {},
          };
        },
      },
    },
    {
      component: 'Input',
      fieldName: 'backendNamespace',
      label: $t(
        'deploy.packageDeployManagement.environmentConfig.backendEnvironment',
      ),
      ifShow: (values) => !values?.isAgentDeploy,
      componentProps: {
        placeholder: $t(
          'deploy.packageDeployManagement.environmentConfig.backendEnvironmentPlaceholder',
        ),
      },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('common.keyword'),
      },
      fieldName: 'keyword',
      label: $t('common.keyword'),
    },
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect',
            componentProps: {
              api: async () => {
                const { getBusinessLineList } = await import(
                  '#/api/system/business-line'
                );
                const res = await getBusinessLineList({
                  pageIndex: 1,
                  pageSize: 1000,
                });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              style: { width: '100%' },
              placeholder: $t('system.businessLine.name'),
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
          },
        ]
      : []),
  ];
}

export function useColumns<T = DeployEnvironmentApi.DeployEnvironment>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'businessLineId',
      title: $t('system.businessLine.name'),
      minWidth: 120,
      formatter: ({ row }) => {
        const businessStore = useBusinessStore();
        const businessLine = businessStore.businessLines.find(
          (item) => item.businessLine.id === row.businessLineId,
        );
        return businessLine?.businessLine.name || '-';
      },
    },
    {
      field: 'sortOrder',
      title: $t('deploy.packageDeployManagement.environmentConfig.sortOrder'),
      minWidth: 80,
      align: 'center',
    },
    {
      field: 'name',
      title: $t('deploy.packageDeployManagement.environmentConfig.name'),
      minWidth: 120,
    },
    {
      field: 'description',
      title: $t('deploy.packageDeployManagement.environmentConfig.description'),
      minWidth: 200,
    },
    {
      field: 'frontendStorageId',
      title: $t(
        'deploy.packageDeployManagement.environmentConfig.frontendStorage',
      ),
      minWidth: 150,
      formatter: ({ row }) => {
        if (!row.frontendStorageId) return '-';
        return (
          objectStorageMap.value.get(row.frontendStorageId) ||
          row.frontendStorageId
        );
      },
    },
    {
      field: 'frontendBaseUrl',
      title: $t(
        'deploy.packageDeployManagement.environmentConfig.frontendBaseUrl',
      ),
      minWidth: 200,
    },
    {
      field: 'backendSecretId',
      title: $t(
        'deploy.packageDeployManagement.environmentConfig.backendCluster',
      ),
      minWidth: 150,
      formatter: ({ row }) => {
        if (!row.backendSecretId) return '-';
        return (
          k8sSecretMap.value.get(row.backendSecretId) || row.backendSecretId
        );
      },
    },
    {
      field: 'backendNamespace',
      title: $t(
        'deploy.packageDeployManagement.environmentConfig.backendEnvironment',
      ),
      minWidth: 150,
    },
    {
      field: 'isAgentDeploy',
      title: $t(
        'deploy.packageDeployManagement.environmentConfig.isAgentDeploy',
      ),
      minWidth: 100,
      align: 'center',
      formatter: ({ cellValue }) => {
        return cellValue
          ? $t('common.yes')
          : $t('common.no');
      },
    },
    {
      field: 'createdAt',
      title: $t('common.createdAt'),
      minWidth: 180,
      formatter: ({ cellValue }) => {
        if (!cellValue) return '-';
        return new Date(cellValue).toLocaleString('zh-CN');
      },
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('common.action'),
      width: 150,
    },
  ];
}
