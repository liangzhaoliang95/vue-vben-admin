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
      field: 'version',
      title: $t('deploy.packageDeployManagement.projectPackage.version'),
      minWidth: 200,
      treeNode: true, // 设置为树节点列
      formatter: ({ row }) => {
        // 如果是父级（版本组），显示版本号
        if (row.children && row.children.length > 0) {
          return row.version || '-';
        }
        // 如果是子级（项目），显示项目名称
        return row.projectName || '-';
      },
    },
    {
      field: 'projectType',
      title: $t('deploy.packageDeployManagement.projectPackage.projectType'),
      minWidth: 120,
      formatter: ({ row }) => {
        // 如果是父级，不显示
        if (row.children && row.children.length > 0) {
          return '-';
        }
        // 如果是子级，显示项目类型
        const typeMap: Record<string, string> = {
          backend: '服务端',
          frontend: '前端',
          submodule: '子模块',
        };
        return typeMap[row.projectType] || row.projectType || '-';
      },
    },
    {
      field: 'buildTime',
      title: $t('deploy.packageDeployManagement.projectPackage.buildTime'),
      minWidth: 180,
      formatter: ({ row }) => {
        // 如果是父级，显示构建时间
        if (row.children && row.children.length > 0) {
          if (!row.buildTime) return '-';
          const date = new Date(row.buildTime);
          return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        // 如果是子级，显示子项目的版本号
        return row.version || '-';
      },
    },
    {
      field: 'status',
      title: $t('deploy.packageDeployManagement.projectPackage.status.label'),
      minWidth: 120,
      slots: {
        default: ({ row }: any) => {
          // 如果是父级，不显示状态
          if (row.children && row.children.length > 0) {
            return '-';
          }
          // 如果是子级，显示状态
          return renderStatusTag(row.status);
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
