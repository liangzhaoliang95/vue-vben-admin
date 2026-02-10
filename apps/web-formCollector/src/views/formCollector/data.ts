import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FormCollectorApi } from '#/api/formCollector';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '关键词',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: '启用',
            value: 1,
          },
          {
            label: '禁用',
            value: 2,
          },
        ],
        placeholder: '请选择任务状态',
        style: { width: '100%' },
        allowClear: true,
      },
      fieldName: 'status',
      label: '任务状态',
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<FormCollectorApi.TaskInfo>,
  onViewDataClick: (row: FormCollectorApi.TaskInfo) => void,
  onStatusChange: (row: FormCollectorApi.TaskInfo, status: number) => void,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'taskName',
      title: '任务名称',
      minWidth: 200,
      cellRender: {
        name: 'CellLink',
        props: ({ row }: any) => ({
          text: row.taskName,
        }),
        attrs: {
          onClick: ({ row }: any) => {
            onViewDataClick(row);
          },
        },
      },
    },
    {
      field: 'taskId',
      title: '任务ID',
      minWidth: 280,
    },
    {
      field: 'taskDesc',
      title: '任务描述',
      minWidth: 250,
    },
    {
      field: 'status',
      title: '状态',
      minWidth: 120,
      align: 'center',
      cellRender: {
        name: 'CellSwitch',
        attrs: {
          onChange: ({ row, value }: any) => {
            onStatusChange(row, value);
          },
        },
      },
    },
    {
      field: 'creatorName',
      title: '创建人',
      minWidth: 120,
    },
    {
      field: 'createdAt',
      title: '创建时间',
      minWidth: 180,
      formatter: ({ cellValue }) => {
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
        options: ['viewData', 'edit', 'delete'],
        props: {
          type: 'default', // 使用默认按钮样式
        },
      },
      field: 'operation',
      fixed: 'right',
      title: '操作',
      width: 250,
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'taskName',
      label: '任务名称',
      rules: 'required',
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: '请输入任务名称',
      },
    },
    {
      component: 'Textarea',
      fieldName: 'taskDesc',
      label: '任务描述',
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: '请输入任务描述',
        rows: 4,
      },
    },
    {
      component: 'RadioGroup',
      fieldName: 'status',
      label: '状态',
      formItemClass: 'col-span-12',
      defaultValue: 1,
      componentProps: {
        options: [
          { label: '启用', value: 1 },
          { label: '禁用', value: 2 },
        ],
      },
    },
    {
      component: 'CheckboxGroup',
      fieldName: 'permissionList',
      label: '权限配置',
      formItemClass: 'col-span-12',
      defaultValue: [],
      help: '配置无需认证即可访问的功能',
      componentProps: {
        options: [
          { label: '允许无鉴权查询数据', value: 1 },
          { label: '允许无鉴权删除单个提交', value: 2 },
          { label: '允许无鉴权删除全部提交', value: 4 },
        ],
        class: 'flex flex-col gap-3',
      },
    },
  ];
}
