import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'ant-design:console-outlined',
      order: 100,
      title: $t('routes.terminal'),
    },
    name: 'Terminal',
    path: '/terminal',
    children: [
      {
        name: 'TerminalIndex',
        path: '',
        component: () => import('#/views/terminal/index.vue'),
        meta: {
          icon: 'ant-design:console-outlined',
          title: $t('routes.terminal'),
        },
      },
    ],
  },
];

export default routes;
