import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';

import { $t } from '#/locales';

const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/_core/fallback/not-found.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  // 文档中心页面 - 公共页面，无需登录即可访问
  {
    name: 'Docs',
    path: '/docs',
    component: () => import('#/views/docs/index.vue'),
    meta: {
      title: $t('page.docs.title'),
      hideInMenu: true,
      hideInBreadcrumb: false,
      keepAlive: true,
    },
  },
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/',
    redirect: preferences.app.defaultHomePath,
    children: [
      // 项目配置详情页 - 无需权限检查，只要登录即可访问
      {
        name: 'ProjectConfigDetail',
        path: 'project-management/project-config/detail',
        component: () =>
          import('#/views/project-management/project-config/detail.vue'),
        meta: {
          activePath: '/project-management/project-config',
          fullPathKey: false,
          hideInMenu: true,
          hideInBreadcrumb: false,
          title: $t('deploy.projectManagement.projectConfig.title'),
        },
      },
      // 工作台 - 预置路由，所有登录用户均可访问，不依赖角色权限
      {
        name: 'Workspace',
        path: '/workspace',
        component: () =>
          import('#/views/dashboard/workspace/index.vue'),
        meta: {
          affixTab: true,
          icon: 'carbon:workspace',
          order: -1,
          title: $t('page.dashboard.workspace'),
        },
      },
      // 个人设置 - 所有登录用户均可访问
      {
        name: 'Profile',
        path: '/profile',
        component: () => import('#/views/profile/index.vue'),
        meta: {
          hideInMenu: true,
          hideInBreadcrumb: false,
          title: $t('system.mfa.personalSettings'),
        },
      },
    ],
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: LOGIN_PATH,
    children: [
      {
        name: 'Login',
        path: 'login',
        component: () => import('#/views/_core/authentication/login.vue'),
        meta: {
          title: $t('page.auth.login'),
        },
      },
      {
        name: 'CodeLogin',
        path: 'code-login',
        component: () => import('#/views/_core/authentication/code-login.vue'),
        meta: {
          title: $t('page.auth.codeLogin'),
        },
      },
      {
        name: 'QrCodeLogin',
        path: 'qrcode-login',
        component: () =>
          import('#/views/_core/authentication/qrcode-login.vue'),
        meta: {
          title: $t('page.auth.qrcodeLogin'),
        },
      },
      {
        name: 'WorkWechatQrcodeLogin',
        path: 'work-wechat-qrcode-login',
        component: () =>
          import('#/views/_core/authentication/work-wechat-qrcode-login.vue'),
        meta: {
          title: $t('authentication.workWechatQrcodeLogin'),
        },
      },
      {
        name: 'NoPermission',
        path: 'no-permission',
        component: () =>
          import('#/views/_core/authentication/no-permission.vue'),
        meta: {
          title: $t('authentication.noPermissionTitle'),
        },
      },
      {
        name: 'ForgetPassword',
        path: 'forget-password',
        component: () =>
          import('#/views/_core/authentication/forget-password.vue'),
        meta: {
          title: $t('page.auth.forgetPassword'),
        },
      },
      {
        name: 'Register',
        path: 'register',
        component: () => import('#/views/_core/authentication/register.vue'),
        meta: {
          title: $t('page.auth.register'),
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
