import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:file-text',
      order: 2,
      title: '表单采集器',
    },
    name: 'FormCollector',
    path: '/formCollector',
    children: [
      {
        name: 'TaskList',
        path: '/formCollector/task-list',
        component: () => import('#/views/formCollector/task-list.vue'),
        meta: {
          icon: 'lucide:list',
          title: '任务管理',
        },
      },
      {
        name: 'DataList',
        path: '/formCollector/data-list',
        component: () => import('#/views/formCollector/data-list.vue'),
        meta: {
          activePath: '/formCollector/task-list',
          icon: 'lucide:database',
          title: '数据列表',
          hideInMenu: true,
        },
      },
    ],
  },
];

export default routes;
