import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { GitRepoConfigApi } from '#/api/project-management/git-repo-config';

import { useBusinessStore } from '@vben/stores';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  const businessLineOptions = businessStore.businessLines.map((item) => ({
    label: item.businessLine.name,
    value: item.businessLine.id,
  }));

  return [
    ...(isSuperAdmin
      ? [
          {
            component: 'Select' as const,
            fieldName: 'businessLineId',
            label: $t('common.businessLine'),
            rules: 'required',
            formItemClass: 'col-span-12',
            componentProps: {
              options: businessLineOptions,
              placeholder: $t('common.businessLine'),
              style: { width: '100%' },
            },
          },
        ]
      : []),
    {
      component: 'Input' as const,
      fieldName: 'name',
      label: $t('deploy.projectManagement.gitRepoConfig.name'),
      rules: 'required',
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: $t(
          'deploy.projectManagement.gitRepoConfig.namePlaceholder',
        ),
      },
    },
    {
      component: 'Select' as const,
      fieldName: 'type',
      label: $t('deploy.projectManagement.gitRepoConfig.type'),
      rules: 'required',
      formItemClass: 'col-span-12',
      componentProps: {
        options: [{ label: 'GitLab', value: 'gitlab' }],
        style: { width: '100%' },
      },
    },
    {
      component: 'Input' as const,
      fieldName: 'baseUrl',
      label: $t('deploy.projectManagement.gitRepoConfig.baseUrl'),
      rules: 'required',
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: $t(
          'deploy.projectManagement.gitRepoConfig.baseUrlPlaceholder',
        ),
      },
    },
    {
      component: 'InputPassword' as const,
      fieldName: 'apiToken',
      label: $t('deploy.projectManagement.gitRepoConfig.apiToken'),
      rules: 'required',
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: $t(
          'deploy.projectManagement.gitRepoConfig.apiTokenPlaceholder',
        ),
      },
    },
    {
      component: 'Input' as const,
      fieldName: 'committerName',
      label: $t('deploy.projectManagement.gitRepoConfig.committerName'),
      rules: 'required',
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: $t(
          'deploy.projectManagement.gitRepoConfig.committerNamePlaceholder',
        ),
      },
    },
    {
      component: 'Input' as const,
      fieldName: 'committerEmail',
      label: $t('deploy.projectManagement.gitRepoConfig.committerEmail'),
      rules: 'required',
      formItemClass: 'col-span-12',
      componentProps: {
        placeholder: $t(
          'deploy.projectManagement.gitRepoConfig.committerEmailPlaceholder',
        ),
      },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  const businessStore = useBusinessStore();
  const isSuperAdmin = businessStore.currentRole?.isSuper === true;

  return [
    ...(isSuperAdmin
      ? [
          {
            component: 'ApiSelect' as const,
            componentProps: {
              api: () =>
                Promise.resolve(
                  businessStore.businessLines.map((item) => ({
                    label: item.businessLine.name,
                    value: item.businessLine.id,
                  })),
                ),
              labelField: 'label',
              valueField: 'value',
            },
            fieldName: 'businessLineId',
            label: $t('common.businessLine'),
          },
        ]
      : []),
    {
      component: 'Input' as const,
      fieldName: 'keyword',
      label: $t('common.keyword'),
      componentProps: {
        placeholder: $t('deploy.projectManagement.gitRepoConfig.searchPlaceholder'),
      },
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<GitRepoConfigApi.GitRepoConfig>,
): VxeTableGridOptions<GitRepoConfigApi.GitRepoConfig>['columns'] {
  return [
    {
      field: 'name',
      title: $t('deploy.projectManagement.gitRepoConfig.name'),
      minWidth: 150,
    },
    {
      field: 'type',
      title: $t('deploy.projectManagement.gitRepoConfig.type'),
      width: 100,
      formatter: () => 'GitLab',
    },
    {
      field: 'baseUrl',
      title: $t('deploy.projectManagement.gitRepoConfig.baseUrl'),
      minWidth: 200,
    },
    {
      field: 'committerName',
      title: $t('deploy.projectManagement.gitRepoConfig.committerName'),
      minWidth: 120,
    },
    {
      field: 'committerEmail',
      title: $t('deploy.projectManagement.gitRepoConfig.committerEmail'),
      minWidth: 180,
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
