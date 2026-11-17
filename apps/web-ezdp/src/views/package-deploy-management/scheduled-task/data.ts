import type { VbenFormSchema } from '@vben/common-ui';

import type { VxeGridProps } from '#/adapter/vxe-table';
import type { ScheduledTaskItem } from '#/api/package-deploy-management/scheduled-task';

import { h } from 'vue';

import { useBusinessStore } from '@vben/stores';

import { Badge, Button, Space, Switch, Tag, Tooltip } from 'ant-design-vue';
import dayjs from 'dayjs';

import { $t } from '#/locales';

/**
 * 表格列配置
 */
export function useColumns(
  onActionClick: (params: { code: string; row: ScheduledTaskItem }) => void,
  onToggleEnabled: (row: ScheduledTaskItem, enabled: boolean) => void,
): VxeGridProps<ScheduledTaskItem>['columns'] {
  return [
    {
      field: 'name',
      minWidth: 200,
      title: $t('scheduledTask.column.name'),
    },
    {
      field: 'taskTypeName',
      title: $t('scheduledTask.column.taskType'),
      width: 120,
      slots: {
        default: ({ row }: { row: ScheduledTaskItem }) => {
          const colorMap: Record<number, string> = {
            1: 'blue',
            2: 'green',
          };
          return h(
            Tag,
            { color: colorMap[row.taskType] },
            () => row.taskTypeName,
          );
        },
      },
    },
    {
      field: 'branch',
      title: $t('scheduledTask.column.branch'),
      width: 120,
      slots: {
        default: ({ row }: { row: ScheduledTaskItem }) =>
          h(Tag, { color: 'purple' }, () => row.branch),
      },
    },
    {
      field: 'cronExpression',
      minWidth: 140,
      title: $t('scheduledTask.column.cronExpression'),
      slots: {
        default: ({ row }: { row: ScheduledTaskItem }) =>
          h('code', { class: 'text-xs' }, row.cronExpression),
      },
    },
    {
      field: 'enabled',
      fixed: 'right',
      title: $t('scheduledTask.column.enabled'),
      width: 80,
      slots: {
        default: ({ row }: { row: ScheduledTaskItem }) =>
          h(Switch, {
            checked: row.enabled,
            checkedChildren: $t('scheduledTask.status.enabled'),
            size: 'small',
            unCheckedChildren: $t('scheduledTask.status.disabled'),
            onChange: (checked: any) => onToggleEnabled(row, checked === true),
          }),
      },
    },
    {
      field: 'lastExecuteStatus',
      fixed: 'right',
      title: $t('scheduledTask.column.lastExecuteStatus'),
      width: 100,
      slots: {
        default: ({ row }: { row: ScheduledTaskItem }) => {
          if (!row.lastExecuteStatus) {
            return h(Badge, {
              status: 'default',
              text: $t('scheduledTask.status.never'),
            });
          }
          const statusMap: Record<
            string,
            {
              status: 'default' | 'error' | 'processing' | 'success';
              text: string;
            }
          > = {
            failed: {
              status: 'error',
              text: $t('scheduledTask.status.failed'),
            },
            running: {
              status: 'processing',
              text: $t('scheduledTask.status.running'),
            },
            success: {
              status: 'success',
              text: $t('scheduledTask.status.success'),
            },
          };
          const config = statusMap[row.lastExecuteStatus] || {
            status: 'default',
            text: row.lastExecuteStatus,
          };
          const badge = h(Badge, { status: config.status, text: config.text });
          // 失败时附带原因提示（触发被拒绝的原因，如业务线正在构建/分支已禁用等）
          if (row.lastExecuteStatus === 'failed' && row.lastExecuteError) {
            return h(Tooltip, { title: row.lastExecuteError }, () => badge);
          }
          return badge;
        },
      },
    },
    {
      field: 'nextExecuteTime',
      fixed: 'right',
      minWidth: 160,
      title: $t('scheduledTask.column.nextExecuteTime'),
      slots: {
        default: ({ row }: { row: ScheduledTaskItem }) => {
          if (!row.nextExecuteTime || !row.enabled) return '-';
          return dayjs(row.nextExecuteTime).format('YYYY-MM-DD HH:mm:ss');
        },
      },
    },
    {
      field: 'action',
      fixed: 'right',
      title: $t('scheduledTask.column.action'),
      width: 180,
      slots: {
        default: ({ row }: { row: ScheduledTaskItem }) =>
          h(Space, { size: 'small' }, () => [
            h(
              Button,
              {
                size: 'small',
                type: 'link',
                onClick: () => onActionClick({ code: 'edit', row }),
              },
              () => $t('scheduledTask.action.edit'),
            ),
            h(Tooltip, { title: $t('scheduledTask.action.executeNow') }, () =>
              h(
                Button,
                {
                  size: 'small',
                  type: 'link',
                  onClick: () => onActionClick({ code: 'execute', row }),
                },
                () => $t('scheduledTask.action.executeNow'),
              ),
            ),
            h(
              Button,
              {
                danger: true,
                size: 'small',
                type: 'link',
                onClick: () => onActionClick({ code: 'delete', row }),
              },
              () => $t('scheduledTask.action.delete'),
            ),
          ]),
      },
    },
  ];
}

/**
 * 搜索表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('scheduledTask.list.search'),
      },
      fieldName: 'keyword',
      label: $t('scheduledTask.column.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('scheduledTask.list.all'), value: undefined },
          { label: $t('scheduledTask.list.enabled'), value: true },
          { label: $t('scheduledTask.list.disabled'), value: false },
        ],
        placeholder: $t('scheduledTask.column.enabled'),
      },
      fieldName: 'enabled',
      label: $t('scheduledTask.column.enabled'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const { getBusinessLineList } = await import(
            '#/api/system/business-line'
          );
          const res = await getBusinessLineList();
          return (res.items || []).map((item: any) => ({
            label: item.name,
            value: item.id,
          }));
        },
        placeholder: $t('common.businessLine'),
      },
      fieldName: 'businessLineId',
      hide: !isSuperAdmin,
      label: $t('common.businessLine'),
    },
  ];
}

/**
 * 表单Schema（创建/编辑计划任务）
 *
 * 项目配置和分支下拉都依赖 businessLineId：普通用户固定为当前业务线，
 * 超级管理员可在表单内选择业务线，选择后两个下拉联动重新加载各自的选项
 * （与 environment-config/data.ts 的 ApiSelect + dependencies.componentProps
 * 写法一致：api 接收 params 并与之合并，dependencies 负责在 businessLineId
 * 变化时重新计算 params，组件据此自动重新请求，而不是在 api 回调里自行闭包
 * 读取表单值——那样不会触发自动刷新）。
 */
export function useFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  function initialBusinessLineId(): number | undefined {
    return (
      businessStore.currentBusinessLine?.businessLine.id ??
      businessStore.currentBusinessLineId ??
      undefined
    );
  }

  function resolveParams(formValues?: Record<string, any>) {
    const businessLineId = isSuperAdmin
      ? formValues?.businessLineId
      : initialBusinessLineId();
    return businessLineId ? { businessLineId } : {};
  }

  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('scheduledTask.form.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('scheduledTask.form.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('scheduledTask.form.cronExpressionPlaceholder'),
      },
      fieldName: 'cronExpression',
      help: $t('scheduledTask.cronHelper.format'),
      label: $t('scheduledTask.form.cronExpression'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: $t('scheduledTask.form.taskType1'), value: 1 },
          { label: $t('scheduledTask.form.taskType2'), value: 2 },
        ],
        placeholder: $t('scheduledTask.form.taskTypePlaceholder'),
      },
      fieldName: 'taskType',
      label: $t('scheduledTask.form.taskType'),
      rules: 'required',
    },
    {
      // 分支从分支管理列表中选择而非手填文本：后端执行预检查/增量构建时
      // 需要分支表的主键 ID（branchId），不是分支名字符串。
      component: 'ApiSelect',
      componentProps: {
        api: async (params?: any) => {
          const { getBranchManagementList } = await import(
            '#/api/package-deploy-management/branch-management'
          );
          const res = await getBranchManagementList({
            page: 1,
            pageSize: 1000,
            ...params,
          });
          return (res.items || []).filter((item: any) => item.enabled);
        },
        allowClear: true,
        fieldNames: { label: 'name', value: 'id' },
        params: resolveParams(),
        placeholder: $t('scheduledTask.form.branchPlaceholder'),
        style: { width: '100%' },
      },
      dependencies: {
        componentProps: (formValues) => ({ params: resolveParams(formValues) }),
        triggerFields: ['businessLineId'],
      },
      fieldName: 'branchId',
      label: $t('scheduledTask.form.branch'),
      rules: 'required',
    },
    {
      component: 'Switch',
      componentProps: {
        checkedChildren: $t('scheduledTask.form.enabledTrue'),
        unCheckedChildren: $t('scheduledTask.form.enabledFalse'),
      },
      defaultValue: true,
      fieldName: 'enabled',
      label: $t('scheduledTask.form.enabled'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const { getBusinessLineList } = await import(
            '#/api/system/business-line'
          );
          const res = await getBusinessLineList();
          return (res.items || []).map((item: any) => ({
            label: item.name,
            value: item.id,
          }));
        },
        placeholder: $t('common.businessLine'),
      },
      fieldName: 'businessLineId',
      // 仅超级管理员可选择业务线（计划任务按业务线配置，与创建人无关）；
      // 后端更新接口不接受修改业务线，编辑时该字段只用于联动加载分支/项目配置。
      hide: !isSuperAdmin,
      label: $t('common.businessLine'),
    },
  ];
}
