import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: '概览',
    },
    name: 'Dashboard',
    path: '/dashboard',
    redirect: '/dashboard/analytics',
    children: [
      {
        name: 'Analytics',
        path: '/dashboard/analytics',
        component: () => import('#/views/dashboard/analytics.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:area-chart',
          title: '分析页',
        },
      },
      {
        name: 'Guide',
        path: '/dashboard/guide',
        component: () => import('#/views/dashboard/guide.vue'),
        meta: {
          icon: 'lucide:book-open',
          title: '使用说明',
        },
      },
    ],
  },
];

export default routes;
