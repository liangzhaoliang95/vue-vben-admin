import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ProjectConfigApi } from '#/api/project-management/project-config';

import { z } from '@vben/common-ui';
import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  // 获取业务线选项列表（使用ID作为value）
  const businessLineOptions = businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));

  return [
    ...(isSuperAdmin
      ? [
          {
            component: 'Select',
            fieldName: 'businessLineId',
            label: $t('deploy.projectManagement.projectConfig.group'),
            rules: 'required',
            formItemClass: 'col-span-12',
            componentProps: {
              options: businessLineOptions,
              placeholder: $t('deploy.projectManagement.projectConfig.group'),
              style: { width: '100%' },
            },
          },
        ]
      : []),
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('deploy.projectManagement.projectConfig.name'),
      rules: z
        .string()
        .min(1, {
          message: $t('deploy.projectManagement.projectConfig.nameRequired'),
        })
        .regex(/^[\w-]+$/, {
          message: $t('deploy.projectManagement.projectConfig.nameEnglishOnly'),
        }),
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: $t(
          'deploy.projectManagement.projectConfig.namePlaceholder',
        ),
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'projectId',
      label: $t('deploy.projectManagement.projectConfig.projectId'),
      formItemClass: 'col-span-12',
      rules: z
        .number({
          required_error: 'GitLab项目ID不能为空',
        })
        .min(1, '项目ID必须大于0'),
      componentProps: {
        min: 1,
        placeholder: '请输入GitLab项目ID（必填）',
        style: { width: '100%' },
      },
    },
    {
      component: 'Input',
      fieldName: 'projectUrl',
      label: $t('deploy.projectManagement.projectConfig.projectUrl'),
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: $t(
          'deploy.projectManagement.projectConfig.projectUrlPlaceholder',
        ),
      },
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: $t('deploy.projectManagement.projectConfig.type.backend'),
            value: 'backend',
          },
          {
            label: $t('deploy.projectManagement.projectConfig.type.frontend'),
            value: 'frontend',
          },
          {
            label: $t('deploy.projectManagement.projectConfig.type.submodule'),
            value: 'submodule',
          },
        ],
        placeholder: $t('deploy.projectManagement.projectConfig.type.select'),
        style: { width: '100%' },
        dropdownStyle: { minWidth: '200px' },
      },
      fieldName: 'type',
      label: $t('deploy.projectManagement.projectConfig.type.label'),
      rules: 'required',
      formItemClass: 'col-span-12',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  // 获取业务线选项列表（使用ID作为value）
  const businessLineOptions = businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));

  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('common.keyword'),
      },
      fieldName: 'keyword',
      label: $t('common.keyword'),
    },
    ...(isSuperAdmin
      ? [
          {
            component: 'Select',
            componentProps: {
              options: businessLineOptions,
              placeholder: $t('deploy.projectManagement.projectConfig.group'),
              style: { width: '100%' },
              allowClear: true,
            },
            fieldName: 'businessLineId',
            label: $t('deploy.projectManagement.projectConfig.group'),
          },
        ]
      : []),
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: $t('deploy.projectManagement.projectConfig.type.backend'),
            value: 'backend',
          },
          {
            label: $t('deploy.projectManagement.projectConfig.type.frontend'),
            value: 'frontend',
          },
          {
            label: $t('deploy.projectManagement.projectConfig.type.submodule'),
            value: 'submodule',
          },
        ],
        placeholder: $t('deploy.projectManagement.projectConfig.type.select'),
        style: { width: '100%' },
        allowClear: true,
      },
      fieldName: 'type',
      label: $t('deploy.projectManagement.projectConfig.type.label'),
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<ProjectConfigApi.ProjectConfig>,
  onBuildConfigClick: (row: ProjectConfigApi.ProjectConfig) => void,
  onDeployConfigClick: (row: ProjectConfigApi.ProjectConfig) => void,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'businessLineId',
      title: $t('deploy.projectManagement.projectConfig.group'),
      minWidth: 120,
      formatter: ({ cellValue }) => {
        const businessStore = useBusinessStore();
        const businessLine = businessStore.businessLines.find(
          (item) => item.businessLine.id === cellValue,
        );
        return businessLine?.businessLine.name || cellValue;
      },
    },
    {
      field: 'name',
      title: $t('deploy.projectManagement.projectConfig.name'),
      minWidth: 150,
    },
    {
      field: 'projectId',
      title: $t('deploy.projectManagement.projectConfig.projectId'),
      minWidth: 100,
    },
    {
      field: 'projectUrl',
      title: $t('deploy.projectManagement.projectConfig.projectUrl'),
      minWidth: 300,
    },
    {
      field: 'type',
      title: $t('deploy.projectManagement.projectConfig.type.label'),
      minWidth: 100,
      formatter: ({ cellValue }) => {
        const typeMap: Record<string, string> = {
          backend: `🖥️ ${$t('deploy.projectManagement.projectConfig.type.backend')}`,
          frontend: `🎨 ${$t('deploy.projectManagement.projectConfig.type.frontend')}`,
          submodule: `📦 ${$t('deploy.projectManagement.projectConfig.type.submodule')}`,
        };
        return typeMap[cellValue] || cellValue;
      },
    },
    {
      field: 'hasBuildConfig',
      title: $t('deploy.projectManagement.projectConfig.hasBuildConfig'),
      minWidth: 120,
      align: 'center',
      cellRender: {
        name: 'CellStatus',
        attrs: {
          onClick: ({ row }: any) => {
            onBuildConfigClick(row);
          },
        },
        props: {
          statusMap: {
            true: {
              text: $t('deploy.projectManagement.projectConfig.configured'),
              type: 'success',
            },
            false: {
              text: $t('deploy.projectManagement.projectConfig.notConfigured'),
              type: 'error',
            },
          },
        },
      },
    },
    {
      field: 'hasDeployConfig',
      title: $t('deploy.projectManagement.projectConfig.hasDeployConfig'),
      minWidth: 120,
      align: 'center',
      cellRender: {
        name: 'CellStatus',
        attrs: {
          onClick: ({ row }: any) => {
            onDeployConfigClick(row);
          },
        },
        props: {
          statusMap: {
            true: {
              text: $t('deploy.projectManagement.projectConfig.configured'),
              type: 'success',
            },
            false: {
              text: $t('deploy.projectManagement.projectConfig.notConfigured'),
              type: 'error',
            },
          },
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
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('common.action'),
      width: 150,
    },
  ];
}
