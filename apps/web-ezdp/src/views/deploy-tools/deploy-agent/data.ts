import type { VbenFormSchema } from '@vben/common-ui';
import type { OnActionClickFn, VxeGridPropTypes } from '#/adapter/vxe-table';
import type { DeployAgent } from '#/api/deploy-tools/deploy-agent';

import { Tag } from 'ant-design-vue';
import { h } from 'vue';

import { $t } from '#/locales';
import { getBusinessLineList } from '#/api/system/business-line';
import { getDeployEnvironmentList } from '#/api/deploy-tools/deploy-environment';
import { useBusinessStore } from '@vben/stores';

// Agent 状态枚举
enum AgentStatus {
  Inactive = 0, // 未激活
  Active = 1,   // 已激活
  Disabled = 2, // 已禁用
}

// 获取状态文本
function getStatusText(status: number): string {
  switch (status) {
    case AgentStatus.Active:
      return $t('deploy.tools.deployAgent.statusActive');
    case AgentStatus.Disabled:
      return $t('deploy.tools.deployAgent.statusDisabled');
    case AgentStatus.Inactive:
    default:
      return $t('deploy.tools.deployAgent.statusInactive');
  }
}

// 获取状态颜色
function getStatusColor(status: number): string {
  switch (status) {
    case AgentStatus.Active:
      return 'success';
    case AgentStatus.Disabled:
      return 'default';
    case AgentStatus.Inactive:
    default:
      return 'error';
  }
}

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
  onActionClick: OnActionClickFn<DeployAgent>,
): VxeGridPropTypes.Columns<DeployAgent> {
  return [
    {
      field: 'businessLineName',
      minWidth: 120,
      title: $t('common.businessLine'),
    },
    {
      field: 'name',
      minWidth: 150,
      title: $t('deploy.tools.deployAgent.name'),
    },
    {
      field: 'status',
      title: $t('deploy.tools.deployAgent.status'),
      width: 100,
      slots: {
        default: ({ row }: { row: DeployAgent }) => {
          const statusText = getStatusText(row.status);
          const color = getStatusColor(row.status);
          return h(Tag, { color }, () => statusText);
        },
      },
    },
    {
      field: 'environments',
      title: $t('deploy.tools.deployAgent.environments'),
      minWidth: 250,
      slots: {
        default: ({ row }: { row: DeployAgent }) => {
          if (!row.environments || row.environments.length === 0) {
            return '-';
          }
          // 使用标签形式显示环境名称，支持悬停显示详情
          return h('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px;' },
            row.environments.map((env: any) =>
              h(Tag, {
                key: env.id,
                color: 'blue',
                style: 'margin: 0; cursor: help;',
                title: [
                  env.name,
                  env.backendSecretName ? `服务端: ${env.backendSecretName}${env.backendNamespace ? ' / ' + env.backendNamespace : ''}` : '',
                  env.frontendStorageName ? `前端: ${env.frontendStorageName}${env.frontendBaseUrl ? ' / ' + env.frontendBaseUrl : ''}` : '',
                ].filter(Boolean).join('\n'),
              }, () => env.name)
            )
          );
        },
      },
    },
    {
      field: 'lastActiveAt',
      minWidth: 180,
      title: $t('deploy.tools.deployAgent.lastActiveAt'),
      formatter: ({ cellValue }: { cellValue: number | null | undefined }) => {
        return formatDateTime(cellValue);
      },
    },
    {
      field: 'createdAt',
      minWidth: 180,
      title: $t('common.createdAt'),
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
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('common.action'),
      width: 150,
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
        placeholder: $t('deploy.tools.deployAgent.searchPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('common.keyword'),
    },
  ];
}

// 创建/编辑表单 Schema
export function useFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    // 业务线字段：仅超级管理员在创建时可见和可编辑
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
            rules: 'required',
          },
        ]
      : []),
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('deploy.tools.deployAgent.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('deploy.tools.deployAgent.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('deploy.tools.deployAgent.descriptionPlaceholder'),
        rows: 3,
      },
      fieldName: 'description',
      label: $t('deploy.tools.deployAgent.description'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        mode: 'multiple',
        placeholder: $t('deploy.tools.deployAgent.environmentsPlaceholder'),
        api: async () => {
          const params: any = {
            pageIndex: 1,
            pageSize: 1000,
          };

          // 非超级管理员：不传 businessLineId，后端使用 token 中的值
          // 超级管理员：不传 businessLineId，查询所有环境（或者可以根据表单中选择的业务线过滤）

          const result = await getDeployEnvironmentList(params);
          return result.items || [];
        },
        fieldNames: { label: 'name', value: 'id' },
        style: { width: '100%' },
      },
      fieldName: 'deployEnvironmentIds',
      label: $t('deploy.tools.deployAgent.environments'),
      rules: 'required',
    },
  ];
}
