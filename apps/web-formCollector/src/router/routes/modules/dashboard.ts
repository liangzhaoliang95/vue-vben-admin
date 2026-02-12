import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'Analytics',
    path: '/analytics',
    component: () => import('#/views/dashboard/analytics.vue'),
    meta: {
      affixTab: true,
      icon: 'lucide:layout-dashboard',
      order: 1,
      title: '工作台',
    },
  },
  {
    name: 'Guide',
    path: '/guide',
    component: () => import('#/views/dashboard/guide.vue'),
    meta: {
      icon: 'lucide:book-open',
      order: 2,
      title: '使用说明',
    },
  },
];

export default routes;
