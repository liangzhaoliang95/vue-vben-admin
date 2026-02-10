import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FormCollectorApi } from '#/api/formCollector';

export function useDataListColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'dataId',
      title: '数据ID',
      minWidth: 200,
    },
    {
      field: 'submitIp',
      title: '提交IP',
      minWidth: 150,
    },
    {
      field: 'submitRegion',
      title: '提交地区',
      minWidth: 150,
    },
    {
      field: 'submitAt',
      title: '提交时间',
      minWidth: 180,
      formatter: ({ cellValue }) => {
        return new Date(cellValue).toLocaleString('zh-CN');
      },
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      title: '操作',
      width: 200,
      slots: {
        default: 'operation',
      },
    },
  ];
}
