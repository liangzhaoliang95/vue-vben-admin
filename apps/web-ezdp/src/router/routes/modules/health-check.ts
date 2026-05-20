import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:heart-pulse',
      order: 11,
      title: $t('healthCheck.title'),
    },
    name: 'HealthCheck',
    path: '/health-check',
    children: [
      {
        name: 'SslCertCheck',
        path: '/health-check/ssl-cert-check',
        component: () =>
          import('#/views/health-check/ssl-cert-check/list.vue'),
        meta: {
          icon: 'lucide:shield-check',
          title: $t('healthCheck.sslCertCheck.title'),
        },
      },
      {
        name: 'ImageCheck',
        path: '/health-check/image-check',
        component: () =>
          import('#/views/health-check/image-check/list.vue'),
        meta: {
          icon: 'mdi:docker',
          title: $t('healthCheck.imageCheck.title'),
        },
      },
    ],
  },
];

export default routes;
