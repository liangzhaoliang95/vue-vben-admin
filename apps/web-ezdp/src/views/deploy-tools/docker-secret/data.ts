import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DockerSecretApi } from '#/api/deploy-tools/docker-secret';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('deploy.tools.dockerSecret.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'host',
      label: $t('deploy.tools.dockerSecret.host'),
      rules: 'required',
      componentProps: {
        placeholder: 'tcp://localhost:2375 或 https://registry.example.com',
      },
    },
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('deploy.tools.dockerSecret.username'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      fieldName: 'password',
      label: $t('deploy.tools.dockerSecret.password'),
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
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('common.keyword'),
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

export function useColumns<T = DockerSecretApi.DockerSecret>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'name',
      title: $t('deploy.tools.dockerSecret.name'),
      width: 200,
    },
    {
      field: 'host',
      minWidth: 250,
      showOverflow: true,
      title: $t('deploy.tools.dockerSecret.host'),
    },
    {
      field: 'username',
      title: $t('deploy.tools.dockerSecret.username'),
      width: 150,
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
          nameTitle: $t('deploy.tools.dockerSecret.name'),
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
