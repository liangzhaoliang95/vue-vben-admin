import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAuditLogApi } from '#/api/system/audit-log';

import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  const businessLineOptions = businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));

  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('system.auditLog.loginNamePlaceholder'),
      },
      fieldName: 'loginName',
      label: $t('system.auditLog.loginName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('system.auditLog.auditKeyBuild'), value: 'ProjectPackage' },
          { label: $t('system.auditLog.auditKeyDeploy'), value: 'ProjectDeploy' },
        ],
        placeholder: $t('system.auditLog.auditKeyPlaceholder'),
      },
      fieldName: 'auditKey',
      label: $t('system.auditLog.auditKey'),
    },
    ...(isSuperAdmin
      ? [
          {
            component: 'Select' as const,
            componentProps: {
              allowClear: true,
              options: businessLineOptions,
              placeholder: $t('common.businessLinePlaceholder'),
            },
            fieldName: 'businessLineId',
            label: $t('common.businessLine'),
          },
        ]
      : []),
    {
      component: 'RangePicker',
      componentProps: {
        showTime: true,
        style: { width: '100%' },
      },
      fieldName: 'timeRange',
      label: $t('system.auditLog.timeRange'),
    },
  ];
}

export function useColumns(): VxeTableGridOptions<SystemAuditLogApi.AuditLog>['columns'] {
  const businessStore = useBusinessStore();

  return [
    {
      field: 'loginName',
      title: $t('system.auditLog.loginName'),
      width: 120,
    },
    {
      field: 'userName',
      title: $t('system.auditLog.userName'),
      width: 120,
    },
    {
      field: 'actionDesc',
      title: $t('system.auditLog.actionDesc'),
      minWidth: 280,
      showOverflow: true,
    },
    {
      field: 'auditKey',
      title: $t('system.auditLog.auditKey'),
      width: 110,
      formatter: ({ cellValue }: { cellValue: string }) => {
        const map: Record<string, string> = {
          ProjectPackage: $t('system.auditLog.auditKeyBuild'),
          ProjectDeploy: $t('system.auditLog.auditKeyDeploy'),
        };
        return map[cellValue] || cellValue;
      },
    },
    {
      field: 'businessLineId',
      title: $t('common.businessLine'),
      width: 120,
      formatter: ({ cellValue }: { cellValue: number }) => {
        const bl = businessStore.businessLines.find(
          (item) => item.businessLine.id === cellValue,
        );
        return bl?.businessLine.name || String(cellValue);
      },
    },
    {
      field: 'duration',
      title: $t('system.auditLog.duration'),
      width: 90,
    },
    {
      field: 'clientIp',
      title: $t('system.auditLog.clientIp'),
      width: 140,
    },
    {
      field: 'createdAt',
      title: $t('system.auditLog.createdAt'),
      width: 170,
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return '-';
        return new Date(cellValue).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      },
    },
  ];
}
