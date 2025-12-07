import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { K8sSecretApi } from '#/api/deploy-tools/k8s-secret';

import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const { getBusinessLineList } = await import(
            '#/api/system/business-line'
          );
          const res = await getBusinessLineList({ page: 1, pageSize: 1000 });
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
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('deploy.tools.k8sSecret.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder:
          '请输入集群服务器地址（可选，留空将从 kubeconfig 自动解析）',
      },
      fieldName: 'server',
      label: $t('deploy.tools.k8sSecret.server'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入命名空间，多个命名空间用逗号分隔',
      },
      fieldName: 'namespaces',
      label: $t('deploy.tools.k8sSecret.namespaces'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请粘贴 kubeconfig 文件内容',
        rows: 10,
        autoSize: { minRows: 10, maxRows: 20 },
      },
      fieldName: 'kubeconfig',
      label: $t('deploy.tools.k8sSecret.kubeconfig'),
      rules: 'required',
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

export function useColumns<T = K8sSecretApi.K8sSecret>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'businessLineName',
      title: $t('system.businessLine.name'),
      minWidth: 120,
    },
    {
      field: 'name',
      title: $t('deploy.tools.k8sSecret.name'),
      width: 200,
    },
    {
      field: 'server',
      minWidth: 250,
      showOverflow: true,
      title: $t('deploy.tools.k8sSecret.server'),
    },
    {
      field: 'namespaces',
      minWidth: 250,
      showOverflow: true,
      title: $t('deploy.tools.k8sSecret.namespaces'),
      formatter: ({ cellValue }: { cellValue: string[] }) => {
        if (!cellValue || cellValue.length === 0) return '';
        return cellValue.join(', ');
      },
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('common.status.name'),
      width: 100,
    },
    {
      field: 'createdAt',
      title: $t('common.createdAt'),
      width: 180,
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return '';
        return new Date(cellValue).toLocaleString('zh-CN');
      },
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('deploy.tools.k8sSecret.name'),
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
