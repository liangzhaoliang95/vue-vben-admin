<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { $t } from '@vben/locales';
import { useAccessStore, useUserStore, useBusinessStore } from '@vben/stores';

import * as ww from '@wecom/jssdk';

import {
  workWechatLoginApi,
  generateWorkWechatQrcodeApi,
  getAccessCodesApi,
  getBusinessLinesApi,
  getUserInfoApi,
} from '#/api';

defineOptions({ name: 'WorkWechatQrcodeLogin' });

const router = useRouter();
const route = useRoute();

const isLoading = ref(true);
const hasError = ref(false);
const loginStatus = ref<'failed' | 'success' | 'waiting'>('waiting');
let wwLoginInstance: any = null;

// 检查URL参数，如果有code则处理登录
async function checkLoginCode() {
  const code = route.query.code as string;

  if (code) {
    try {
      loginStatus.value = 'waiting';
      const result = await workWechatLoginApi({
        key: code,
      });

      if (result && result.accessToken) {
        loginStatus.value = 'success';
        // 使用和账号登录一样的流程
        await handleLoginSuccess(result.accessToken);
      } else {
        loginStatus.value = 'failed';
        hasError.value = true;
      }
    } catch (error) {
      console.error('企业微信登录失败:', error);
      loginStatus.value = 'failed';
      hasError.value = true;
    }
  }
}

// 处理登录成功（使用和账号登录一样的流程）
async function handleLoginSuccess(accessToken: string) {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const businessStore = useBusinessStore();

  try {
    // 设置 accessToken
    accessStore.setAccessToken(accessToken);

    // 获取用户信息和权限
    const [userInfo, accessCodes, businessLines] = await Promise.all([
      getUserInfoApi(),
      getAccessCodesApi(),
      getBusinessLinesApi(),
    ]);

    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);
    await businessStore.init(true, businessLines ?? []);

    // 检查业务线是否为空，如果为空则跳转到无权限页面
    if (!businessLines || businessLines.length === 0) {
      // 清除登录过期状态
      if (accessStore.loginExpired) {
        accessStore.setLoginExpired(false);
      }
      // 跳转到无权限页面
      router.push('/auth/no-permission');
      return;
    }

    // 清除登录过期状态
    if (accessStore.loginExpired) {
      accessStore.setLoginExpired(false);
    }

    // 跳转到首页
    router.push(userInfo?.homePath || '/');
  } catch (error) {
    console.error('登录后处理失败:', error);
    loginStatus.value = 'failed';
    hasError.value = true;
  }
}

// 初始化企业微信登录组件
async function initWorkWechatLogin(config: { agentId: string; corpId: string }) {
  // 先设置为 false，让容器渲染出来
  isLoading.value = false;

  // 等待 DOM 更新完成
  await nextTick();

  try {
    // 使用 npm 安装的 @wecom/jssdk 创建登录组件
    wwLoginInstance = ww.createWWLoginPanel({
      el: '#ww_login',
      params: {
        login_type: 'CorpApp',
        appid: config.corpId,
        agentid: config.agentId,
        redirect_uri: window.location.href.split('?')[0],
        state: 'WWLogin',
        redirect_type: 'callback',
        panel_size: 'small',
      },
      onCheckWeComLogin({ isWeComLogin }) {
        // 检查企业微信桌面端登录状态（静默处理，不影响扫码登录）
        console.log('企业微信桌面端登录状态:', isWeComLogin);
      },
      onLoginSuccess({ code }) {
        console.log('企业微信登录成功, code:', code);
        // 登录成功后，使用 code 获取 token
        handleLoginSuccessByCode(code);
      },
      onLoginFail(err) {
        console.error('企业微信登录失败:', err);
        hasError.value = true;
        loginStatus.value = 'failed';
      },
    });
  } catch (error) {
    console.error('创建企业微信登录失败:', error);
    hasError.value = true;
  }
}

// 通过 code 处理登录成功
async function handleLoginSuccessByCode(code: string) {
  try {
    const result = await workWechatLoginApi({
      key: code,
    });

    if (result && result.accessToken) {
      loginStatus.value = 'success';
      // 使用和账号登录一样的流程
      await handleLoginSuccess(result.accessToken);
    } else {
      loginStatus.value = 'failed';
      hasError.value = true;
    }
  } catch (error) {
    console.error('获取登录token失败:', error);
    loginStatus.value = 'failed';
    hasError.value = true;
  }
}

// 返回账号登录
function handleBackToLogin() {
  router.push('/auth/login');
}

// 判断是否为内网访问（IP 地址或 localhost），内网才允许返回账号登录
const canBackToLogin = computed(() => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|\d+\.\d+\.\d+\.\d+)$/.test(hostname);
});

// 重新生成二维码
async function handleRetryQrcode() {
  // 重置状态
  hasError.value = false;
  isLoading.value = true;
  loginStatus.value = 'waiting';

  // 清理旧的登录实例
  if (wwLoginInstance && wwLoginInstance.unmount) {
    wwLoginInstance.unmount();
    wwLoginInstance = null;
  }

  try {
    // 重新获取企业微信配置
    const result = await generateWorkWechatQrcodeApi();

    if (result) {
      const config = {
        agentId: result.agentId || 'your_agent_id',
        corpId: result.corpId || 'your_corp_id',
      };
      // 重新初始化登录组件
      await initWorkWechatLogin(config);
    }
  } catch (error) {
    console.error('重新加载企业微信配置失败:', error);
    isLoading.value = false;
    hasError.value = true;
  }
}

// 组件卸载时清理
onBeforeUnmount(() => {
  if (wwLoginInstance && wwLoginInstance.unmount) {
    wwLoginInstance.unmount();
  }
});

onMounted(async () => {
  // 先检查是否有code参数
  await checkLoginCode();

  // 如果没有code且登录状态为等待中，则初始化企业微信登录
  if (!route.query.code && loginStatus.value === 'waiting') {
    try {
      // 获取企业微信配置
      const result = await generateWorkWechatQrcodeApi();

      if (result) {
        const config = {
          agentId: result.agentId || 'your_agent_id',
          corpId: result.corpId || 'your_corp_id',
        };
        // 初始化登录组件
        initWorkWechatLogin(config);
      }
    } catch (error) {
      console.error('加载企业微信配置失败:', error);
      isLoading.value = false;
      hasError.value = true;
    }
  } else {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="flex h-full w-full flex-col items-center justify-center">
    <!-- 标题 -->
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold">
        {{ $t('authentication.workWechatQrcodeLogin') }}
      </h1>
      <p class="text-muted-foreground mt-2 text-sm">
        {{ $t('authentication.workWechatQrcodeSubtitle') }}
      </p>
    </div>

    <!-- 二维码区域 -->
    <div class="bg-card relative rounded-lg border p-8 shadow-sm">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex h-64 w-64 items-center justify-center">
        <div class="text-center">
          <div class="text-muted-foreground mb-2">
            {{ $t('authentication.workWechatQrcodeLoading') }}
          </div>
        </div>
      </div>

      <!-- 登录成功 -->
      <div
        v-if="loginStatus === 'success'"
        class="flex h-64 w-64 flex-col items-center justify-center"
      >
        <div class="text-center">
          <div class="mb-2 text-6xl text-green-600">✓</div>
          <div class="text-muted-foreground mb-2">登录成功，正在跳转...</div>
        </div>
      </div>

      <!-- 加载失败 -->
      <div
        v-if="hasError"
        class="flex h-64 w-64 flex-col items-center justify-center"
      >
        <div class="text-center">
          <div class="text-destructive mb-4">二维码加载失败或登录失败</div>
          <div class="flex flex-col gap-2">
            <button
              class="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2 text-sm"
              type="button"
              @click="handleRetryQrcode"
            >
              重新生成二维码
            </button>
            <button
              v-if="canBackToLogin"
              class="border-input bg-background hover:bg-accent hover:text-accent-foreground rounded border px-4 py-2 text-sm"
              type="button"
              @click="handleBackToLogin"
            >
              返回账号登录
            </button>
          </div>
        </div>
      </div>

      <!-- 企业微信登录容器 -->
      <div
        v-if="!isLoading && !hasError && loginStatus === 'waiting'"
        id="ww_login"
        class="ww-login-container"
      ></div>
    </div>

    <!-- 返回账号登录（仅内网访问时显示） -->
    <div v-if="canBackToLogin" class="mt-6 text-center text-sm">
      <span class="text-muted-foreground">
        {{ $t('authentication.alreadyHaveAccount') }}
      </span>
      <button
        class="text-primary hover:underline"
        type="button"
        @click="handleBackToLogin"
      >
        {{ $t('authentication.goToLogin') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ww-login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}
</style>
