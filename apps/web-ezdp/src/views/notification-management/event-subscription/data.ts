import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { EventSubscriptionApi } from '#/api/core/notification-event-subscription';

import { $t } from '#/locales';

export const EVENT_TYPE_OPTIONS = [
  {
    label: $t('notification.eventSubscription.eventTypes.projectBuildCompleted'),
    value: 'project_build_completed',
  },
];

export function useColumns<T = EventSubscriptionApi.EventSubscriptionItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      type: 'seq',
      width: 60,
      title: '#',
      align: 'center',
    },
    {
      field: 'eventType',
      title: $t('notification.eventSubscription.eventType'),
      width: 180,
      formatter: ({ cellValue }: { cellValue: string }) => {
        const option = EVENT_TYPE_OPTIONS.find((opt) => opt.value === cellValue);
        return option?.label || cellValue;
      },
    },
    {
      field: 'webhookUrl',
      title: $t('notification.eventSubscription.webhookUrl'),
      minWidth: 300,
      showOverflow: true,
    },
    {
      cellRender: {
        name: 'CellTag',
      },
      field: 'enabled',
      title: $t('notification.eventSubscription.enabled'),
      width: 100,
      formatter: ({ cellValue }: { cellValue: boolean }) => {
        return cellValue
          ? $t('notification.eventSubscription.enabledYes')
          : $t('notification.eventSubscription.enabledNo');
      },
    },
    {
      field: 'createdAt',
      title: $t('notification.eventSubscription.createdAt'),
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
          nameField: 'eventType',
          nameTitle: $t('notification.eventSubscription.eventType'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          { code: 'edit', label: $t('notification.eventSubscription.edit') },
          { code: 'test', label: $t('notification.eventSubscription.test') },
          'delete',
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('notification.eventSubscription.actions'),
      width: 180,
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        options: EVENT_TYPE_OPTIONS,
        placeholder: $t('notification.eventSubscription.selectEventType'),
        allowClear: true,
      },
      fieldName: 'eventType',
      label: $t('notification.eventSubscription.eventType'),
    },
  ];
}
