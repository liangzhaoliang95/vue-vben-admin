import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getSelfUserInfoApi, loginApi, logoutApi, codeLoginApi } from '#/api';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
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
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;

      // 调用后端登录接口，使用 email 和 password
      const { tokenInfo, userInfo: backendUserInfo } = await loginApi({
        email: params.email,
        password: params.password,
      });

      // 如果成功获取到 accessToken
      if (tokenInfo.accessToken) {
        accessStore.setAccessToken(tokenInfo.accessToken);

        // 使用后端返回的完整用户信息
        userInfo = {
          userId: backendUserInfo.userId,
          username: backendUserInfo.userName,
          realName: backendUserInfo.userName,
          avatar: backendUserInfo.avatar || '',
          email: backendUserInfo.email,
          roles: ['user'],
          homePath: '/analytics',
          desc: '',
          token: tokenInfo.accessToken,
        } as UserInfo;

        userStore.setUserInfo(userInfo);
        // 设置默认权限码
        accessStore.setAccessCodes(['AC_100100', 'AC_100110', 'AC_100120']);

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

  /**
   * 验证码登录
   * @param params 登录表单数据 (email, code)
   */
  async function authLoginByCode(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;

      // 调用后端验证码登录接口
      const { tokenInfo, userInfo: backendUserInfo } = await codeLoginApi({
        email: params.email,
        code: params.code,
      });

      // 如果成功获取到 accessToken
      if (tokenInfo.accessToken) {
        accessStore.setAccessToken(tokenInfo.accessToken);

        // 使用后端返回的完整用户信息
        userInfo = {
          userId: backendUserInfo.userId,
          username: backendUserInfo.userName,
          realName: backendUserInfo.userName,
          avatar: backendUserInfo.avatar || '',
          email: backendUserInfo.email,
          roles: ['user'],
          homePath: '/analytics',
          desc: '',
          token: tokenInfo.accessToken,
        } as UserInfo;

        userStore.setUserInfo(userInfo);
        // 设置默认权限码
        accessStore.setAccessCodes(['AC_100100', 'AC_100110', 'AC_100120']);

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
    resetAllStores();
    accessStore.setLoginExpired(false);

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    // 如果 store 中已有用户信息，直接返回
    if (userStore.userInfo) {
      return userStore.userInfo;
    }

    // 否则从后端获取用户信息
    try {
      const backendUserInfo = await getSelfUserInfoApi();

      const userInfo: UserInfo = {
        userId: backendUserInfo.userId,
        username: backendUserInfo.userName,
        realName: backendUserInfo.userName,
        avatar: backendUserInfo.avatar || '',
        email: backendUserInfo.email,
        roles: ['user'],
        homePath: '/analytics',
        desc: '',
      };

      // 保存到 store
      userStore.setUserInfo(userInfo);

      return userInfo;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    authLoginByCode,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
