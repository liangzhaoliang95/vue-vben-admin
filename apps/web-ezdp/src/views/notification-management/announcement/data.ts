import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AnnouncementApi } from '#/api/core/announcement';

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
        placeholder: $t('notification.announcement.titlePlaceholder'),
      },
      fieldName: 'title',
      label: $t('notification.announcement.titleField'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('notification.announcement.contentPlaceholder'),
        rows: 4,
      },
      fieldName: 'content',
      label: $t('notification.announcement.content'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('notification.announcement.linkPlaceholder'),
      },
      fieldName: 'linkUrl',
      label: $t('notification.announcement.link'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        placeholder: $t('notification.announcement.sortPlaceholder'),
        min: 0,
        style: { width: '100%' },
      },
      fieldName: 'sortOrder',
      label: $t('notification.announcement.sort'),
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
      fieldName: 'isEnabled',
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
        placeholder: $t('notification.announcement.searchPlaceholder'),
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
      fieldName: 'isEnabled',
      label: $t('common.status.name'),
    },
  ];
}

export function useColumns<T = AnnouncementApi.AnnouncementItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    {
      field: 'sortOrder',
      title: $t('notification.announcement.sort'),
      width: 80,
      align: 'center',
    },
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
      field: 'title',
      title: $t('notification.announcement.titleField'),
      minWidth: 200,
    },
    {
      field: 'content',
      title: $t('notification.announcement.content'),
      minWidth: 300,
      showOverflow: true,
    },
    {
      field: 'linkUrl',
      title: $t('notification.announcement.link'),
      minWidth: 200,
      showOverflow: true,
    },
    {
      cellRender: {
        name: 'CellTag',
      },
      field: 'isEnabled',
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
          nameField: 'title',
          nameTitle: $t('notification.announcement.titleField'),
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
