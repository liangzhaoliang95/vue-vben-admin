<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { BasicOption } from '@vben/types';

import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const router = useRouter();
const authStore = useAuthStore();

const MOCK_USER_OPTIONS: BasicOption[] = [
  {
    label: 'Super',
    value: 'vben',
  },
  {
    label: 'Admin',
    value: 'admin',
  },
  {
    label: 'User',
    value: 'jack',
  },
];

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      dependencies: {
        trigger(values, form) {
          if (values.selectAccount) {
            const findUser = MOCK_USER_OPTIONS.find(
              (item) => item.value === values.selectAccount,
            );
            if (findUser) {
              form.setValues({
                password: '123456',
                username: findUser.value,
              });
            }
          }
        },
        triggerFields: ['selectAccount'],
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
