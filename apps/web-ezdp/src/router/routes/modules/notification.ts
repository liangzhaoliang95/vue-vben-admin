import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:bell',
      order: 20,
      title: $t('notification.management.title'),
    },
    name: 'NotificationManagement',
    path: '/notification-management',
    children: [
      {
        name: 'NotificationChannel',
        path: '/notification-management/channel',
        component: () =>
          import(
            '#/views/notification-management/channel/list.vue'
          ),
        meta: {
          icon: 'lucide:radio',
          title: $t('notification.channel.title'),
          authority: ['notification:channel:view'],
        },
      },
      {
        name: 'NotificationScenario',
        path: '/notification-management/scenario',
        component: () =>
          import(
            '#/views/notification-management/scenario/list.vue'
          ),
        meta: {
          icon: 'lucide:settings-2',
          title: $t('notification.scenario.title'),
          authority: ['notification:scenario:view'],
        },
      },
      {
        name: 'NotificationAnnouncement',
        path: '/notification-management/announcement',
        component: () =>
          import(
            '#/views/notification-management/announcement/list.vue'
          ),
        meta: {
          icon: 'lucide:megaphone',
          title: $t('notification.announcement.title'),
          authority: ['notification:announcement:view'],
        },
      },
    ],
  },
];

export default routes;
