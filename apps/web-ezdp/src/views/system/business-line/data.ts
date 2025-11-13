import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemBusinessLineApi } from '#/api/system/business-line';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.businessLine.code'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.businessLine.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('system.businessLine.description'),
    },
    {
      component: 'Input',
      fieldName: 'logoUrl',
      label: $t('system.businessLine.logoUrl'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.no'), value: 0 },
          { label: $t('common.yes'), value: 1 },
        ],
        optionType: 'button',
      },
      defaultValue: 0,
      fieldName: 'isInternal',
      label: $t('system.businessLine.isInternal'),
    },
    {
      component: 'InputNumber',
      fieldName: 'sortOrder',
      label: $t('system.businessLine.sortOrder'),
      defaultValue: 0,
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
      label: $t('system.businessLine.status'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.businessLine.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.businessLine.status'),
    },
  ];
}

export function useColumns<T = SystemBusinessLineApi.BusinessLine>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'code',
      title: $t('system.businessLine.code'),
      width: 150,
    },
    {
      field: 'name',
      title: $t('system.businessLine.name'),
      width: 200,
    },
    {
      field: 'description',
      minWidth: 200,
      showOverflow: true,
      title: $t('system.businessLine.description'),
    },
    {
      cellRender: {
        attrs: {
          options: [
            { label: $t('common.no'), value: 0 },
            { label: $t('common.yes'), value: 1 },
          ],
        },
        name: 'CellTag',
      },
      field: 'isInternal',
      title: $t('system.businessLine.isInternal'),
      width: 120,
    },
    {
      field: 'sortOrder',
      title: $t('system.businessLine.sortOrder'),
      width: 100,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.businessLine.status'),
      width: 100,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.businessLine.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.businessLine.operation'),
      width: 130,
    },
  ];
}
