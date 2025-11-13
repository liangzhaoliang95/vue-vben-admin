import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api/system/user';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

export function useGridFormSchema() {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.user.searchPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('common.keyword'),
    },
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
  onActionClick: OnActionClickFn<SystemUserApi.User>,
  onStatusChange?: (
    newStatus: any,
    row: SystemUserApi.User,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'loginName',
      title: $t('system.user.loginName'),
      width: 150,
    },
    {
      field: 'userName',
      title: $t('system.user.userName'),
      width: 150,
    },
    {
      field: 'phone',
      title: $t('system.user.phone'),
      width: 150,
    },
    {
      field: 'email',
      title: $t('system.user.email'),
      minWidth: 200,
      showOverflow: true,
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
          nameField: 'userName',
          nameTitle: $t('system.user.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          'edit',
          {
            code: 'permission',
            text: '权限设置',
          },
          'delete',
        ],
      },
      field: 'action',
      fixed: 'right',
      title: $t('common.action'),
      width: 200,
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.user.loginNamePlaceholder'),
      },
      fieldName: 'loginName',
      label: $t('system.user.loginName'),
      rules: z
        .string()
        .min(1, { message: $t('system.user.loginNameRequired') })
        .max(50, { message: $t('system.user.loginNameLength') }),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.user.userNamePlaceholder'),
      },
      fieldName: 'userName',
      label: $t('system.user.userName'),
      rules: z
        .string()
        .min(1, { message: $t('system.user.userNameRequired') })
        .max(100, { message: $t('system.user.userNameLength') }),
    },
    {
      component: 'InputPassword',
      componentProps: {
        placeholder: $t('system.user.passwordPlaceholder'),
      },
      fieldName: 'password',
      label: $t('system.user.password'),
      // 密码字段：如果填写了则至少6位，编辑时可以为空（在提交时手动验证）
      rules: z
        .union([
          z.string().min(6, { message: $t('system.user.passwordMinLength') }),
          z.literal(''),
        ])
        .optional(),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.user.phonePlaceholder'),
      },
      fieldName: 'phone',
      label: $t('system.user.phone'),
      rules: z
        .union([
          z.string().max(20, { message: $t('system.user.phoneMaxLength') }),
          z.literal(''),
        ])
        .optional(),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.user.emailPlaceholder'),
        type: 'email',
      },
      fieldName: 'email',
      label: $t('system.user.email'),
      rules: z
        .union([
          z
            .string()
            .email({ message: $t('system.user.emailInvalid') })
            .max(100, { message: $t('system.user.emailMaxLength') }),
          z.literal(''),
        ])
        .optional(),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.user.avatarPlaceholder'),
      },
      fieldName: 'avatar',
      label: $t('system.user.avatar'),
      rules: z
        .union([
          z.string().max(500, { message: $t('system.user.avatarMaxLength') }),
          z.literal(''),
        ])
        .optional(),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        placeholder: $t('common.status.select'),
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('common.status.name'),
    },
  ];
}
