import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:server',
      order: 10,
      title: $t('serverManagement.title'),
    },
    name: 'ServerManagement',
    path: '/server-management',
    children: [
      {
        name: 'ServerList',
        path: '/server-management/server',
        component: () =>
          import('#/views/server-management/server/list.vue'),
        meta: {
          icon: 'lucide:server',
          title: $t('serverManagement.server.title'),
        },
      },
      {
        name: 'EnvironmentAgentList',
        path: '/server-management/environment-agent',
        component: () =>
          import('#/views/server-management/environment-agent/list.vue'),
        meta: {
          icon: 'lucide:shield-check',
          title: $t('serverManagement.environmentAgent.title'),
        },
      },
    ],
  },
];

export default routes;
