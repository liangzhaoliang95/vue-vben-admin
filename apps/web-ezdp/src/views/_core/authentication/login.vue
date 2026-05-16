<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const router = useRouter();
const authStore = useAuthStore();

const SESSION_KEY = 'ezdp_pwd_login_unlocked';

// 判断是否为内网访问（IP 地址或 localhost）
function isIntranetAccess(): boolean {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  // 匹配私有 IP 段：10.x.x.x / 172.16-31.x.x / 192.168.x.x
  return /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|\d+\.\d+\.\d+\.\d+)$/.test(hostname);
}

const forceShowPasswordLogin = ref(
  sessionStorage.getItem(SESSION_KEY) === '1',
);

// 挂载到 window，供控制台调用：ezdp.enableLogin()
function mountConsoleHelper() {
  (window as any).ezdp = {
    enableLogin() {
      sessionStorage.setItem(SESSION_KEY, '1');
      forceShowPasswordLogin.value = true;
      console.log('[ezdp] 账号密码登录已解锁');
    },
  };
}

onMounted(() => {
  mountConsoleHelper();
  // 域名（公网）访问时直接跳转企微扫码，不显示账号密码登录
  if (!isIntranetAccess() && !forceShowPasswordLogin.value) {
    router.replace('/auth/work-wechat-qrcode-login');
  }
});

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'loginName',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});

function handleWorkWechatLogin() {
  router.push('/auth/work-wechat-qrcode-login');
}
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :show-third-party-login="true"
    :show-register="false"
    :show-forget-password="false"
    :show-code-login="false"
    :show-qrcode-login="false"
    :loading="authStore.loginLoading"
    @submit="authStore.authLogin"
  >
    <template #third-party-login>
      <div class="my-4 flex flex-col items-center gap-3">
        <div class="text-muted-foreground text-xs">
          {{ $t('authentication.thirdPartyLogin') }}
        </div>
        <div class="flex gap-4">
          <button
            class="text-muted-foreground hover:text-primary flex items-center justify-center rounded-lg border p-2 transition-colors"
            type="button"
            aria-label="企业微信登录"
            @click="handleWorkWechatLogin"
          >
            <img
              alt="企业微信"
              class="h-6 w-6"
              src="https://developer.work.weixin.qq.com/favicon.ico"
            />
          </button>
        </div>
      </div>
    </template>
  </AuthenticationLogin>
</template>
