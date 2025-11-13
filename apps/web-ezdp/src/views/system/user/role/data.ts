import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api/system/role';

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
        class: 'w-full',
      },
      fieldName: 'businessLineId',
      label: $t('system.role.businessLine'),
      rules: 'required',
      formItemClass: 'col-span-full',
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.role.code'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('system.role.description'),
    },
    {
      component: 'InputNumber',
      fieldName: 'sortOrder',
      label: $t('system.role.sortOrder'),
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
      label: $t('system.role.status'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: async () => {
          const { getBusinessLineList } = await import(
            '#/api/system/business-line'
          );
          const res = await getBusinessLineList({ page: 1, pageSize: 1000 });
          return res.items || [];
        },
        fieldNames: { label: 'name', value: 'id' },
      },
      fieldName: 'businessLineId',
      label: $t('system.role.businessLine'),
    },
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('system.role.keyword'),
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
      label: $t('system.role.status'),
    },
  ];
}

export function useColumns<T = SystemRoleApi.Role>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'businessLineName',
      title: $t('system.role.businessLine'),
      width: 150,
    },
    {
      field: 'code',
      title: $t('system.role.code'),
      width: 150,
    },
    {
      field: 'name',
      title: $t('system.role.name'),
      width: 200,
    },
    {
      field: 'description',
      minWidth: 200,
      showOverflow: true,
      title: $t('system.role.description'),
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
      field: 'isSystem',
      title: $t('system.role.isSystem'),
      width: 100,
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
      field: 'isSuper',
      title: $t('system.role.isSuper'),
      width: 100,
    },
    {
      cellRender: {
        attrs: {
          beforeChange: onStatusChange,
          disabled: (row: T) => {
            const role = row as SystemRoleApi.Role;
            return role.code === 'super_admin';
          },
        },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.role.status'),
      width: 100,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.role.name'),
          onClick: onActionClick,
          getOptions: (row: T) => {
            const role = row as SystemRoleApi.Role;
            const options: any[] = [];
            // 如果角色编码不是 super_admin，才显示编辑和删除按钮
            if (role.code !== 'super_admin') {
              options.push('edit', 'delete');
            }
            return options;
          },
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.role.operation'),
      width: 130,
    },
  ];
}
