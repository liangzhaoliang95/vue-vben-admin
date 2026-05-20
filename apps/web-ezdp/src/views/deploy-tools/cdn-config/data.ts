import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CdnConfigApi } from '#/api/deploy-tools/cdn-config';

import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect',
            componentProps: {
              api: async () => {
                const { getBusinessLineList } = await import('#/api/system/business-line');
                const res = await getBusinessLineList({ pageIndex: 1, pageSize: 1000 });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              style: { width: '100%' },
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
      label: $t('deploy.tools.cdnConfig.name'),
      rules: 'required',
      componentProps: {
        placeholder: $t('deploy.tools.cdnConfig.namePlaceholder'),
      },
    },
    {
      component: 'Select',
      fieldName: 'provider',
      label: $t('deploy.tools.cdnConfig.provider'),
      rules: 'required',
      componentProps: {
        options: [
          { label: $t('deploy.tools.cdnConfig.providerAli'), value: 'ali' },
          { label: $t('deploy.tools.cdnConfig.providerEcloud'), value: 'ecloud' },
        ],
        style: { width: '100%' },
      },
    },
    // 阿里云字段
    {
      component: 'Input',
      fieldName: 'aliAccessKey',
      label: $t('deploy.tools.cdnConfig.aliAccessKey'),
      componentProps: { placeholder: $t('deploy.tools.cdnConfig.aliAccessKeyPlaceholder') },
      dependencies: {
        triggerFields: ['provider'],
        show: (values) => values?.provider === 'ali',
      },
    },
    {
      component: 'InputPassword',
      fieldName: 'aliAccessSecret',
      label: $t('deploy.tools.cdnConfig.aliAccessSecret'),
      componentProps: { placeholder: $t('deploy.tools.cdnConfig.aliAccessSecretPlaceholder') },
      dependencies: {
        triggerFields: ['provider'],
        show: (values) => values?.provider === 'ali',
      },
    },
    // 移动云字段
    {
      component: 'Input',
      fieldName: 'ecloudDomain',
      label: $t('deploy.tools.cdnConfig.ecloudDomain'),
      componentProps: { placeholder: $t('deploy.tools.cdnConfig.ecloudDomainPlaceholder') },
      dependencies: {
        triggerFields: ['provider'],
        show: (values) => values?.provider === 'ecloud',
      },
    },
    {
      component: 'Input',
      fieldName: 'ecloudId',
      label: $t('deploy.tools.cdnConfig.ecloudId'),
      componentProps: { placeholder: $t('deploy.tools.cdnConfig.ecloudIdPlaceholder') },
      dependencies: {
        triggerFields: ['provider'],
        show: (values) => values?.provider === 'ecloud',
      },
    },
    {
      component: 'InputPassword',
      fieldName: 'ecloudKey',
      label: $t('deploy.tools.cdnConfig.ecloudKey'),
      componentProps: { placeholder: $t('deploy.tools.cdnConfig.ecloudKeyPlaceholder') },
      dependencies: {
        triggerFields: ['provider'],
        show: (values) => values?.provider === 'ecloud',
      },
    },
    // 通用域名字段（两个平台共用）
    {
      component: 'Textarea',
      fieldName: 'cdnDomains',
      label: $t('deploy.tools.cdnConfig.cdnDomains'),
      componentProps: {
        placeholder: $t('deploy.tools.cdnConfig.cdnDomainsPlaceholder'),
        rows: 4,
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
      componentProps: { placeholder: $t('common.keyword') },
      fieldName: 'keyword',
      label: $t('common.keyword'),
    },
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect',
            componentProps: {
              api: async () => {
                const { getBusinessLineList } = await import('#/api/system/business-line');
                const res = await getBusinessLineList({ pageIndex: 1, pageSize: 1000 });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              style: { width: '100%' },
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
          },
        ]
      : []),
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<CdnConfigApi.CdnConfig>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'businessLineId',
      title: $t('system.businessLine.name'),
      minWidth: 120,
      formatter: ({ row }) => {
        const businessStore = useBusinessStore();
        const bl = businessStore.businessLines.find(
          (item) => item.businessLine.id === row.businessLineId,
        );
        return bl?.businessLine.name || '-';
      },
    },
    {
      field: 'name',
      title: $t('deploy.tools.cdnConfig.name'),
      minWidth: 150,
    },
    {
      field: 'provider',
      title: $t('deploy.tools.cdnConfig.provider'),
      minWidth: 120,
      formatter: ({ cellValue }) => {
        if (cellValue === 'ali') return '阿里云CDN';
        if (cellValue === 'ecloud') return '移动云CDN';
        return cellValue;
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
          nameField: 'name',
          nameTitle: $t('deploy.tools.cdnConfig.name'),
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
