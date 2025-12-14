import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { NotificationChannelApi } from '#/api/core/notification-channel';

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
              placeholder: $t('system.businessLine.selectPlaceholder'),
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
            rules: 'required',
          },
        ]
      : []),
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('notification.channel.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('notification.channel.name'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [{ label: $t('notification.channel.wecom'), value: 'wecom' }],
        placeholder: $t('common.select'),
      },
      defaultValue: 'wecom',
      fieldName: 'type',
      label: $t('notification.channel.type'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('notification.channel.webhookPlaceholder'),
      },
      fieldName: 'webhookUrl',
      label: $t('notification.channel.webhook'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: true },
          { label: $t('common.disabled'), value: false },
        ],
        optionType: 'button',
      },
      defaultValue: true,
      fieldName: 'enabled',
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
        placeholder: $t('notification.channel.searchPlaceholder'),
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
              placeholder: $t('system.businessLine.selectPlaceholder'),
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
          { label: $t('common.enabled'), value: true },
          { label: $t('common.disabled'), value: false },
        ],
        placeholder: $t('common.status.select'),
      },
      fieldName: 'enabled',
      label: $t('common.status.name'),
    },
  ];
}

export function useColumns<T = NotificationChannelApi.NotificationChannelItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    // 业务线列（仅超级管理员可见）
    ...(isSuperAdmin
      ? [
          {
            field: 'businessLineName',
            title: $t('system.businessLine.name'),
            minWidth: 120,
          },
        ]
      : []),
    {
      field: 'name',
      title: $t('notification.channel.name'),
      width: 200,
    },
    {
      field: 'type',
      title: $t('notification.channel.type'),
      width: 120,
      formatter: ({ cellValue }: { cellValue: string }) => {
        if (cellValue === 'wecom') return $t('notification.channel.wecom');
        return cellValue;
      },
    },
    {
      field: 'config',
      minWidth: 300,
      showOverflow: true,
      title: $t('notification.channel.webhook'),
      formatter: ({
        cellValue,
      }: {
        cellValue?: NotificationChannelApi.WecomConfig;
      }) => {
        return cellValue?.webhookUrl || '';
      },
    },
    {
      cellRender: {
        name: 'CellTag',
      },
      field: 'enabled',
      title: $t('common.status.name'),
      width: 100,
      formatter: ({ cellValue }: { cellValue: boolean }) => {
        return cellValue ? $t('common.enabled') : $t('common.disabled');
      },
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
          nameTitle: $t('notification.channel.name'),
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
