import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useBusinessStore, useUserStore } from '@vben/stores';

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

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const businessStore = useBusinessStore();
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

        if (accessStore.loginExpired) {
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

    // 4. 清除当前 authStore
    loginLoading.value = false;

    // 直接使用 window.location.replace 强制跳转，确保页面刷新
    const redirectQuery = redirect
      ? `?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`
      : '';
    const loginUrl = `${LOGIN_PATH}${redirectQuery}`;
    window.location.replace(loginUrl);
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    userInfo = await getUserInfoApi();
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
