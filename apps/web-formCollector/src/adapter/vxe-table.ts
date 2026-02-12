import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import { h } from 'vue';

import { setupVbenVxeTable, useVbenVxeGrid } from '@vben/plugins/vxe-table';
import { isFunction, isString } from '@vben/utils';

import { Button, Image, Popconfirm, Switch } from 'ant-design-vue';
import { IconifyIcon } from '@vben/icons';

import { $t } from '#/locales';

import { useVbenForm } from './form';

type Recordable<T = any> = Record<string, T>;

setupVbenVxeTable({
  configVxeTable: (vxeUI) => {
    vxeUI.setConfig({
      grid: {
        align: 'center',
        border: false,
        columnConfig: {
          resizable: true,
        },
        minHeight: 180,
        formConfig: {
          // 全局禁用vxe-table的表单配置，使用formOptions
          enabled: false,
        },
        proxyConfig: {
          autoLoad: true,
          response: {
            result: 'items',
            total: 'total',
            list: 'items',
          },
          showActiveMsg: true,
          showResponseMsg: false,
        },
        round: true,
        showOverflow: true,
        size: 'small',
      } as VxeTableGridOptions,
    });

    // 表格配置项可以用 cellRender: { name: 'CellImage' },
    vxeUI.renderer.add('CellImage', {
      renderTableDefault(renderOpts, params) {
        const { props } = renderOpts;
        const { column, row } = params;
        return h(Image, { src: row[column.field], ...props });
      },
    });

    // 表格配置项可以用 cellRender: { name: 'CellLink' },
    vxeUI.renderer.add('CellLink', {
      renderTableDefault(renderOpts, params) {
        const { attrs, props } = renderOpts;
        const { row } = params;

        // 支持动态 props
        const finalProps = isFunction(props) ? props({ row }) : props;

        return h(
          Button,
          {
            size: 'small',
            type: 'link',
            onClick: () => attrs?.onClick?.({ row }),
            ...finalProps,
          },
          { default: () => finalProps?.text },
        );
      },
    });

    // 表格配置项可以用 cellRender: { name: 'CellSwitch' },
    vxeUI.renderer.add('CellSwitch', {
      renderTableDefault(renderOpts, params) {
        const { attrs, props } = renderOpts;
        const { column, row } = params;

        // 获取当前值
        const value = row[column.field];

        // 支持动态 props
        const finalProps = isFunction(props) ? props({ row }) : props;

        return h(Switch, {
          checked: value === 1,
          checkedChildren: '启用',
          unCheckedChildren: '禁用',
          onChange: (checked: boolean) => {
            attrs?.onChange?.({ row, checked, value: checked ? 1 : 2 });
          },
          ...finalProps,
        });
      },
    });

    // 表格配置项可以用 cellRender: { name: 'CellOperation' },
    vxeUI.renderer.add('CellOperation', {
      renderTableDefault({ attrs, options, props }, { column, row }) {
        const defaultProps = { size: 'small', type: 'link', ...props };
        let align = 'end';
        switch (column.align) {
          case 'center': {
            align = 'center';
            break;
          }
          case 'left': {
            align: 'start';
            break;
          }
          default: {
            align = 'end';
            break;
          }
        }
        const presets: Recordable<Recordable<any>> = {
          delete: {
            danger: true,
            text: $t('common.delete'),
          },
          edit: {
            text: $t('common.edit'),
          },
          export: {
            text: '数据导出',
          },
          aiPrompt: {
            text: 'AI提示词',
          },
          viewData: {
            text: $t('common.viewData'),
          },
        };

        // 如果 attrs 中有 getOptions 函数，使用它来动态获取选项
        let finalOptions = options || ['edit', 'delete'];
        if (attrs?.getOptions && isFunction(attrs.getOptions)) {
          const dynamicOptions = attrs.getOptions(row);
          if (Array.isArray(dynamicOptions) && dynamicOptions.length > 0) {
            finalOptions = dynamicOptions;
          } else if (
            Array.isArray(dynamicOptions) &&
            dynamicOptions.length === 0
          ) {
            // 如果没有选项，返回空数组，不显示任何按钮
            return h('div');
          }
        }

        const operations: Array<Recordable<any>> = finalOptions
          .map((opt) => {
            if (isString(opt)) {
              return presets[opt]
                ? { code: opt, ...presets[opt], ...defaultProps }
                : {
                    code: opt,
                    text: opt,
                    ...defaultProps,
                  };
            } else {
              return { ...defaultProps, ...presets[opt.code], ...opt };
            }
          })
          .map((opt) => {
            const optBtn: Recordable<any> = {};
            Object.keys(opt).forEach((key) => {
              optBtn[key] = isFunction(opt[key]) ? opt[key](row) : opt[key];
            });
            return optBtn;
          })
          .filter((opt) => opt.show !== false);

        function renderBtn(opt: Recordable<any>, listen = true) {
          return h(
            Button,
            {
              ...props,
              ...opt,
              icon: undefined,
              onClick: listen
                ? () =>
                    attrs?.onClick?.({
                      code: opt.code,
                      row,
                    })
                : undefined,
            },
            {
              default: () => {
                const content = [];
                if (opt.icon) {
                  content.push(
                    h(IconifyIcon, { class: 'size-5', icon: opt.icon }),
                  );
                }
                content.push(opt.text);
                return content;
              },
            },
          );
        }

        function renderConfirm(opt: Recordable<any>) {
          let viewportWrapper: HTMLElement | null = null;
          return h(
            Popconfirm,
            {
              getPopupContainer(el) {
                viewportWrapper = el.closest('.vxe-table--viewport-wrapper');
                return document.body;
              },
              placement: 'topLeft',
              title: $t('ui.actionTitle.delete', [attrs?.nameTitle || '']),
              ...props,
              ...opt,
              icon: undefined,
              onOpenChange: (open: boolean) => {
                // 当弹窗打开时，禁止表格的滚动
                if (open) {
                  viewportWrapper?.style.setProperty('pointer-events', 'none');
                } else {
                  viewportWrapper?.style.removeProperty('pointer-events');
                }
              },
              onConfirm: () => {
                attrs?.onClick?.({
                  code: opt.code,
                  row,
                });
              },
            },
            {
              default: () => renderBtn({ ...opt }, false),
              description: () =>
                h(
                  'div',
                  { class: 'truncate' },
                  $t('ui.actionMessage.deleteConfirm', [
                    row[attrs?.nameField || 'name'],
                  ]),
                ),
            },
          );
        }

        const btns = operations.map((opt) =>
          opt.code === 'delete' ? renderConfirm(opt) : renderBtn(opt),
        );
        return h(
          'div',
          {
            class: 'flex table-operations gap-2',
            style: { justifyContent: align },
          },
          btns,
        );
      },
    });

    // 这里可以自行扩展 vxe-table 的全局配置，比如自定义格式化
    // vxeUI.formats.add
  },
  useVbenForm,
});

export { useVbenVxeGrid };

export type * from '@vben/plugins/vxe-table';
