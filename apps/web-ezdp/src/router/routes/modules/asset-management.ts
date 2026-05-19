import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:shield-check',
      order: 11,
      title: $t('assetManagement.title'),
    },
    name: 'AssetManagement',
    path: '/asset-management',
    children: [
      {
        name: 'SslCertCheck',
        path: '/asset-management/ssl-cert-check',
        component: () =>
          import('#/views/asset-management/ssl-cert-check/list.vue'),
        meta: {
          icon: 'lucide:shield-check',
          title: $t('assetManagement.sslCertCheck.title'),
        },
      },
    ],
  },
];

export default routes;
