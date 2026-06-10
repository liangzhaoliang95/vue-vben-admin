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
        component: () => import('#/views/server-management/server/list.vue'),
        meta: {
          icon: 'lucide:server',
          title: $t('serverManagement.server.title'),
        },
      },
      {
        name: 'ServiceBrowser',
        path: '/server-management/service-browser',
        component: () =>
          import('#/views/server-management/service-browser/index.vue'),
        meta: {
          icon: 'lucide:monitor-play',
          title: $t('serverManagement.serviceBrowser.title'),
        },
      },
    ],
  },
];

export default routes;
