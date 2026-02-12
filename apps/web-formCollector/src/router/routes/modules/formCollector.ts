import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'TaskList',
    path: '/task-list',
    component: () => import('#/views/formCollector/task-list.vue'),
    meta: {
      icon: 'lucide:list-checks',
      order: 3,
      title: '任务管理',
    },
  },
  {
    name: 'DataList',
    path: '/data-list',
    component: () => import('#/views/formCollector/data-list.vue'),
    meta: {
      activePath: '/task-list',
      icon: 'lucide:database',
      title: '数据列表',
      hideInMenu: true,
    },
  },
];

export default routes;
