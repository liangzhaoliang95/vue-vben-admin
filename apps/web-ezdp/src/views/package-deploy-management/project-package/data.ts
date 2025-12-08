import type { VbenFormSchema } from '@vben/common-ui';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { h } from 'vue';

import { useBusinessStore } from '@vben/stores';

import { Tag } from 'ant-design-vue';

import { getBranchManagementList } from '#/api/package-deploy-management/branch-management';
import { $t } from '#/locales';

/**
 * 表格搜索表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  // 获取业务线选项列表
  const businessLineOptions = businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));

  return [
    ...(isSuperAdmin
      ? [
          {
            component: 'Select',
            componentProps: {
              options: businessLineOptions,
              placeholder: $t('system.businessLine.name'),
              style: { width: '100%' },
              allowClear: true,
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
          },
        ]
      : []),
    {
      component: 'Select',
      fieldName: 'branchId',
      label: $t('deploy.packageDeployManagement.projectPackage.branch'),
      componentProps: {
        options: [],
        style: { width: '100%' },
        placeholder: $t('deploy.packageDeployManagement.projectPackage.branchPlaceholder'),
        allowClear: true,
      },
    },
  ];
}

/**
 * 打包状态标签渲染
 */
function renderStatusTag(status: string) {
  const statusConfig = {
    pending: { color: 'default', text: $t('deploy.packageDeployManagement.projectPackage.status.pending') },
    running: { color: 'processing', text: $t('deploy.packageDeployManagement.projectPackage.status.running') },
    success: { color: 'success', text: $t('deploy.packageDeployManagement.projectPackage.status.success') },
    failed: { color: 'error', text: $t('deploy.packageDeployManagement.projectPackage.status.failed') },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return h(Tag, { color: config.color }, () => config.text);
}

/**
 * 表格列配置
 */
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
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
      field: 'version',
      title: $t('deploy.packageDeployManagement.projectPackage.version'),
      minWidth: 150,
    },
    {
      field: 'buildTime',
      title: $t('deploy.packageDeployManagement.projectPackage.buildTime'),
      minWidth: 180,
      formatter: ({ cellValue }) => {
        if (!cellValue) return '-';
        return new Date(cellValue).toLocaleString('zh-CN');
      },
    },
    {
      field: 'isDeployed',
      title: $t('deploy.packageDeployManagement.projectPackage.isDeployed'),
      minWidth: 120,
      slots: {
        default: ({ row }: any) => {
          return h(
            Tag,
            { color: row.isDeployed ? 'success' : 'default' },
            () => row.isDeployed ? '已发布' : '未发布',
          );
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
        options: ['deploy'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('common.action'),
      width: 120,
    },
  ];
}
