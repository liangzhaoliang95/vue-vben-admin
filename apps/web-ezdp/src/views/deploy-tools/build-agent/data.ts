import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { BuildAgentApi } from '#/api/deploy-tools/build-agent';

import { useBusinessStore } from '@vben/stores';

import { Tag } from 'ant-design-vue';
import { h } from 'vue';

import { $t } from '#/locales';

// Agent 状态枚举
enum AgentStatus {
  Offline = 0,  // 离线
  Online = 1,   // 在线
  Busy = 2,     // 忙碌
  Disabled = 3, // 已禁用
}

// 获取状态文本
function getStatusText(status: number): string {
  switch (status) {
    case AgentStatus.Online:
      return $t('deploy.tools.buildAgent.statusOnline');
    case AgentStatus.Busy:
      return $t('deploy.tools.buildAgent.statusBusy');
    case AgentStatus.Disabled:
      return $t('deploy.tools.buildAgent.statusDisabled');
    case AgentStatus.Offline:
    default:
      return $t('deploy.tools.buildAgent.statusOffline');
  }
}

// 获取状态颜色
function getStatusColor(status: number): string {
  switch (status) {
    case AgentStatus.Online:
      return 'success';
    case AgentStatus.Busy:
      return 'processing';
    case AgentStatus.Disabled:
      return 'default';
    case AgentStatus.Offline:
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

export function useFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    // 业务线字段：仅超级管理员可见和可编辑
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect',
            componentProps: {
              api: async () => {
                const { getBusinessLineList } = await import(
                  '#/api/system/business-line'
                );
                const res = await getBusinessLineList({
                  page: 1,
                  pageSize: 1000,
                });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              placeholder: $t('common.pleaseSelect'),
              style: { width: '100%' },
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
            rules: 'required',
          },
        ]
      : []),
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('deploy.tools.buildAgent.tokenDescriptionPlaceholder'),
        rows: 3,
      },
      fieldName: 'description',
      label: $t('deploy.tools.buildAgent.tokenDescriptionLabel'),
      help: $t('deploy.tools.buildAgent.tokenDescriptionHelp'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('deploy.tools.buildAgent.searchPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('common.keyword'),
    },
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect',
            componentProps: {
              api: async () => {
                const { getBusinessLineList } = await import(
                  '#/api/system/business-line'
                );
                const res = await getBusinessLineList({
                  page: 1,
                  pageSize: 1000,
                });
                return res.items || [];
              },
              fieldNames: { label: 'name', value: 'id' },
              placeholder: $t('common.pleaseSelect'),
              style: { width: '100%' },
            },
            fieldName: 'businessLineId',
            label: $t('system.businessLine.name'),
          },
        ]
      : []),
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('deploy.tools.buildAgent.statusOnline'), value: AgentStatus.Online },
          { label: $t('deploy.tools.buildAgent.statusOffline'), value: AgentStatus.Offline },
          { label: $t('deploy.tools.buildAgent.statusBusy'), value: AgentStatus.Busy },
          { label: $t('deploy.tools.buildAgent.statusDisabled'), value: AgentStatus.Disabled },
        ],
        placeholder: $t('common.status.select'),
      },
      fieldName: 'status',
      label: $t('common.status.name'),
    },
  ];
}

export function useColumns<T = BuildAgentApi.BuildAgent>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'businessLineName',
      minWidth: 120,
      title: $t('system.businessLine.name'),
    },
    {
      field: 'name',
      minWidth: 180,
      title: $t('deploy.tools.buildAgent.name'),
    },
    {
      field: 'status',
      title: $t('common.status.name'),
      width: 100,
      slots: {
        default: ({ row }: { row: BuildAgentApi.BuildAgent }) => {
          const statusText = getStatusText(row.status);
          const color = getStatusColor(row.status);
          return h(Tag, { color }, () => statusText);
        },
      },
    },
    {
      field: 'lastHeartbeatAt',
      minWidth: 180,
      title: $t('deploy.tools.buildAgent.lastHeartbeatAt'),
      formatter: ({ cellValue }: { cellValue: number }) => {
        return formatDateTime(cellValue);
      },
    },
    {
      field: 'hostname',
      minWidth: 150,
      showOverflow: true,
      title: $t('deploy.tools.buildAgent.hostname'),
    },
    {
      field: 'ipAddress',
      minWidth: 150,
      showOverflow: true,
      title: $t('deploy.tools.buildAgent.ipAddress'),
    },
    {
      cellRender: {
        name: 'CellRender',
        setup: ({ row }: { row: BuildAgentApi.BuildAgent }) => {
          if (!row.os || !row.arch) return h('span', '-');
          return h('span', `${row.os}/${row.arch}`);
        },
      },
      field: 'os',
      title: $t('deploy.tools.buildAgent.osArch'),
      width: 120,
    },
    {
      field: 'currentTasks',
      title: $t('deploy.tools.buildAgent.currentTasks'),
      width: 100,
    },
    {
      field: 'totalTasks',
      title: $t('deploy.tools.buildAgent.totalTasks'),
      width: 100,
    },
    {
      field: 'createdAt',
      title: $t('common.createdAt'),
      width: 180,
      formatter: ({ cellValue }: { cellValue: number }) => {
        return formatDateTime(cellValue);
      },
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('deploy.tools.buildAgent.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('common.action'),
      width: 100,
    },
  ];
}
