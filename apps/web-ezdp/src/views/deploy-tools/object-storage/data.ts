import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

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
                  page: 1,
                  pageSize: 1000,
                });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              style: { width: '100%' },
              placeholder: '请选择业务线',
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
      label: $t('deploy.tools.objectStorage.name'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: 'MinIO', value: 'minio' },
          { label: '阿里云OSS', value: 'ali' },
          { label: '移动云Obs', value: 'ecloudObs' },
        ],
        placeholder: '请选择存储类型',
        style: { width: '100%' },
        dropdownStyle: { minWidth: '200px' },
      },
      fieldName: 'provider',
      label: $t('deploy.tools.objectStorage.provider'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'accessKey',
      label: $t('deploy.tools.objectStorage.accessKey'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      fieldName: 'accessSecret',
      label: $t('deploy.tools.objectStorage.accessSecret'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'bucket',
      label: $t('deploy.tools.objectStorage.bucket'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '例如：https://oss-cn-hangzhou.aliyuncs.com',
      },
      fieldName: 'endpoint',
      label: $t('deploy.tools.objectStorage.endpoint'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '例如：us-east-1（MinIO）或 oss-cn-hangzhou（阿里云OSS）',
      },
      fieldName: 'region',
      label: $t('deploy.tools.objectStorage.region'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('common.status.name'),
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
                  page: 1,
                  pageSize: 1000,
                });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              style: { width: '100%' },
              placeholder: '请选择业务线',
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
          },
        ]
      : []),
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        placeholder: $t('common.status.select'),
      },
      fieldName: 'status',
      label: $t('common.status.name'),
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn,
  onStatusChange: (id: number, status: 0 | 1) => void,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'businessLineName',
      title: $t('system.businessLine.name'),
      minWidth: 120,
    },
    {
      field: 'name',
      title: $t('deploy.tools.objectStorage.name'),
      minWidth: 120,
    },
    {
      field: 'provider',
      title: $t('deploy.tools.objectStorage.provider'),
      minWidth: 120,
      cellRender: {
        name: 'CellProvider',
      },
    },
    {
      field: 'bucket',
      title: $t('deploy.tools.objectStorage.bucket'),
      minWidth: 150,
    },
    {
      field: 'endpoint',
      title: $t('deploy.tools.objectStorage.endpoint'),
      minWidth: 200,
    },
    {
      field: 'region',
      title: $t('deploy.tools.objectStorage.region'),
      minWidth: 120,
    },
    {
      field: 'status',
      title: $t('common.status.name'),
      width: 100,
      cellRender: {
        name: 'CellSwitch',
        props: {
          beforeChange: async ({ row }: { row: any }) => {
            const newStatus = row.status === 1 ? 0 : 1;
            try {
              await onStatusChange(row.id, newStatus as 0 | 1);
              return true;
            } catch {
              return false;
            }
          },
        },
      },
    },
    {
      field: 'createdAt',
      title: $t('common.createdAt'),
      width: 180,
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return new Date(cellValue).toLocaleString('zh-CN');
      },
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('deploy.tools.objectStorage.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('common.action'),
      width: 130,
    },
  ];
}
