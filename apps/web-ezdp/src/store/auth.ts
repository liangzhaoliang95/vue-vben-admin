import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import {
  useAccessStore,
  useBusinessStore,
  useTabbarStore,
  useUserStore,
} from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  getAccessCodesApi,
  getBusinessLinesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
} from '#/api';
import { $t } from '#/locales';

import { useWebSocketStore } from './websocket';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const businessStore = useBusinessStore();
  const tabbarStore = useTabbarStore();
  const wsStore = useWebSocketStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { accessToken } = await loginApi(params);

      // 如果成功获取到 accessToken
      if (accessToken) {
        accessStore.setAccessToken(accessToken);

        // 获取用户信息并存储到 accessStore 中
        const [fetchUserInfoResult, accessCodes, businessLines] =
          await Promise.all([
            fetchUserInfo(),
            getAccessCodesApi(),
            getBusinessLinesApi(),
          ]);

        userInfo = fetchUserInfoResult;

        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(accessCodes);

        await businessStore.init(true, businessLines ?? []);

        // 检查业务线是否为空，如果为空则跳转到无权限页面
        if (!businessLines || businessLines.length === 0) {
          if (accessStore.loginExpired) {
            accessStore.setLoginExpired(false);
          } else {
            await router.push('/auth/no-permission');
          }
          // 显示无权限通知
          notification.warning({
            description: $t('authentication.noPermissionDescription'),
            duration: 5,
            message: $t('authentication.noPermissionTitle'),
          });
        } else if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo.homePath || preferences.app.defaultHomePath,
              );
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }

    // 手动清除各个 store（不调用 resetAllStores，因为 core-business 没有 $reset 方法）
    // 1. 清除 accessStore
    accessStore.setAccessToken(null);
    accessStore.setRefreshToken(null);
    accessStore.setAccessCodes([]);
    accessStore.setAccessMenus([]);
    accessStore.setAccessRoutes([]);
    accessStore.setIsAccessChecked(false);
    accessStore.setLoginExpired(false);
    accessStore.unlockScreen();

    // 2. 清除 userStore
    userStore.setUserInfo(null);
    userStore.setUserRoles([]);

    // 3. 清除 businessStore（使用 reset 方法，不是 $reset）
    businessStore.reset();

    // 4. 清除 tabbar（避免切换账号后看到上一个用户的标签页）
    const affixTabs = tabbarStore.tabs.filter((tab) => tab?.meta?.affixTab === true);
    tabbarStore.tabs = affixTabs.length > 0 ? affixTabs : [];
    tabbarStore.updateCacheTabs();

    // 5. 清除 WebSocket 连接
    wsStore.disconnectAll();

    // 6. 清除当前 authStore
    loginLoading.value = false;

    // 直接使用 window.location.replace 强制跳转，确保页面刷新
    const redirectQuery = redirect
      ? `?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`
      : '';
    // 在 hash 模式下，需要添加 # 前缀
    const loginUrl =
      import.meta.env.VITE_ROUTER_HISTORY === 'hash'
        ? `#${LOGIN_PATH}${redirectQuery}`
        : `${LOGIN_PATH}${redirectQuery}`;
    window.location.replace(loginUrl);
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    userInfo = await getUserInfoApi();
    // 如果后端不返回 homePath，使用默认值
    if (userInfo && !userInfo.homePath) {
      userInfo.homePath = preferences.app.defaultHomePath;
    }
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
