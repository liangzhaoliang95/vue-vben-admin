import type { VbenFormSchema } from '@vben/common-ui';
import type { OnActionClickFn, VxeGridPropTypes } from '#/adapter/vxe-table';

import { h } from 'vue';

import { $t } from '#/locales';
import { getBusinessLineList } from '#/api/system/business-line';
import { useBusinessStore } from '@vben/stores';

// 格式化时间
function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function useColumns(
  onActionClick: OnActionClickFn<any>,
): VxeGridPropTypes.Columns<any> {
  return [
    {
      field: 'businessLineName',
      minWidth: 120,
      title: $t('common.businessLine'),
    },
    {
      field: 'name',
      minWidth: 150,
      title: $t('serverManagement.environmentAgent.name'),
    },
    {
      field: 'token',
      minWidth: 300,
      title: $t('serverManagement.environmentAgent.token'),
      slots: {
        default: 'token',
      },
    },
    {
      field: 'description',
      minWidth: 200,
      title: $t('serverManagement.environmentAgent.description'),
    },
    {
      field: 'createdAt',
      minWidth: 180,
      title: $t('serverManagement.environmentAgent.createTime'),
      formatter: ({ cellValue }: { cellValue: number }) => {
        return formatDateTime(cellValue);
      },
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'regenerate', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('common.action'),
      width: 200,
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    // 业务线筛选：仅超级管理员可见
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect',
            componentProps: {
              api: async () => {
                const res = await getBusinessLineList({
                  pageIndex: 1,
                  pageSize: 1000,
                });
                return res.items || [];
              },
              labelField: 'name',
              valueField: 'id',
              placeholder: $t('common.businessLinePlaceholder'),
            },
            fieldName: 'businessLineId',
            label: $t('common.businessLine'),
          },
        ]
      : []),
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('serverManagement.environmentAgent.searchPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('common.keyword'),
    },
  ];
}

// 创建/编辑表单 Schema
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('serverManagement.environmentAgent.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('serverManagement.environmentAgent.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('serverManagement.environmentAgent.descriptionPlaceholder'),
        rows: 3,
      },
      fieldName: 'description',
      label: $t('serverManagement.environmentAgent.description'),
    },
  ];
}
