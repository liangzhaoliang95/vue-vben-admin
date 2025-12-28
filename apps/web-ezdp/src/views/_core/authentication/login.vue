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

// 跳转到文档页面
function goToDocs() {
  console.log('跳转到文档页面');
  router.push('/docs');
}
</script>

<template>
  <div class="login-wrapper">
    <AuthenticationLogin
      :form-schema="formSchema"
      :show-third-party-login="false"
      :show-register="false"
      :show-forget-password="false"
      :show-code-login="false"
      :show-qrcode-login="false"
      :loading="authStore.loginLoading"
      @submit="authStore.authLogin"
    />
    <div class="login-footer-links">
      <a href="javascript:void(0)" @click="goToDocs" class="doc-link">
        📚 {{ $t('page.docs.title') }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  position: relative;
}

.login-footer-links {
  text-align: center;
  margin-top: 16px;
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
}

.doc-link {
  color: #1890ff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(24, 144, 255, 0.05);
  border: 1px solid transparent;
}

.doc-link:hover {
  color: #fff;
  background: #1890ff;
  border-color: #1890ff;
  text-decoration: none;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.doc-link:active {
  transform: translateY(0);
}
</style>
