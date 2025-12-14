import type { VbenFormSchema } from '@vben/common-ui';

import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';

import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

/**
 * 表格搜索表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    {
      // 业务线筛选:仅超级管理员可见
      ifShow: () => isSuperAdmin,
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
        placeholder: $t('system.businessLine.name'),
      },
      fieldName: 'businessLineId',
      label: $t('system.businessLine.name'),
    },
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
