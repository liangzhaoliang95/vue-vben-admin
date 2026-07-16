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
  onToggleEnabled: (row: any) => void,
): VxeGridProps['columns'] {
  const businessStore = useBusinessStore();
  const isInternalBusinessLine =
    businessStore.currentBusinessLine?.businessLine.code === 'internal';

  const columns: VxeGridProps['columns'] = [
    {
      field: 'name',
      title: $t('deploy.packageDeployManagement.branchManagement.name'),
      minWidth: 200,
      fixed: 'left',
      slots: { default: 'name' },
    },
    {
      field: 'inherit',
      title: $t('deploy.packageDeployManagement.branchManagement.inherit'),
      width: 100,
      fixed: 'left',
      align: 'center',
      slots: { default: 'inherit' },
    },
    {
      field: 'sortOrder',
      title: $t('deploy.packageDeployManagement.branchManagement.sortOrder'),
      minWidth: 80,
      align: 'center',
    },
    {
      field: 'parentBranchName',
      title: $t('deploy.packageDeployManagement.branchManagement.parentBranch'),
      minWidth: 160,
      formatter: ({ cellValue }) => cellValue || '-',
    },
    {
      field: 'defaultVersion',
      title: $t(
        'deploy.packageDeployManagement.branchManagement.defaultVersion',
      ),
      minWidth: 180,
      formatter: ({ cellValue }) => cellValue || '-',
    },
    {
      field: 'lastVersion',
      title: $t('deploy.packageDeployManagement.branchManagement.lastVersion'),
      minWidth: 160,
      formatter: ({ cellValue }) => cellValue || '-',
    },
    {
      field: 'lastReleaseAt',
      title: $t(
        'deploy.packageDeployManagement.branchManagement.lastReleaseAt',
      ),
      minWidth: 180,
      slots: { default: 'lastReleaseAt' },
    },
    {
      field: 'versionTemplate',
      title: $t(
        'deploy.packageDeployManagement.branchManagement.versionTemplate',
      ),
      minWidth: 220,
      formatter: ({ cellValue }) => cellValue || '-',
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
      field: 'description',
      title: $t('deploy.packageDeployManagement.branchManagement.description'),
      minWidth: 250,
      showOverflow: true,
    },
    {
      field: 'enabled',
      title: $t('deploy.packageDeployManagement.branchManagement.status'),
      width: 120,
      fixed: 'right',
      align: 'center',
      cellRender: {
        name: 'CellSwitch',
        props: {
          checkedValue: true,
          unCheckedValue: false,
          checkedChildren: $t(
            'deploy.packageDeployManagement.branchManagement.enable',
          ),
          unCheckedChildren: $t(
            'deploy.packageDeployManagement.branchManagement.disable',
          ),
        },
        attrs: {
          beforeChange: async (_newVal: boolean, row: any) => {
            await onToggleEnabled(row);
            return true;
          },
        },
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
      width: 140,
    },
  ];

  if (isInternalBusinessLine) {
    columns.unshift({
      field: 'businessLineId',
      title: $t('system.businessLine.name'),
      minWidth: 150,
      formatter: ({ row }) => {
        const businessLine = businessStore.businessLines.find(
          (item) => item.businessLine.id === row.businessLineId,
        );
        return businessLine?.businessLine.name || '-';
      },
    });
  }

  return columns;
}
