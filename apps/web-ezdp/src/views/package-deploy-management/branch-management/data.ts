import type { VbenFormSchema } from '@vben/common-ui';

import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';

import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

/**
 * 表格搜索表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('deploy.packageDeployManagement.branchManagement.name'),
      componentProps: {
        placeholder: $t(
          'deploy.packageDeployManagement.branchManagement.namePlaceholder',
        ),
      },
    },
  ];
}

/**
 * 表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<any>,
): VxeGridProps['columns'] {
  const businessStore = useBusinessStore();

  return [
    {
      field: 'businessLineId',
      title: $t('system.businessLine.name'),
      minWidth: 150,
      formatter: ({ row }) => {
        const businessLine = businessStore.businessLines.find(
          (item) => item.businessLine.id === row.businessLineId,
        );
        return businessLine?.businessLine.name || '-';
      },
    },
    {
      field: 'name',
      title: $t('deploy.packageDeployManagement.branchManagement.name'),
      minWidth: 200,
    },
    {
      field: 'description',
      title: $t('deploy.packageDeployManagement.branchManagement.description'),
      minWidth: 250,
    },
    {
      field: 'createdAt',
      title: $t('ui.table.createdTime'),
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
