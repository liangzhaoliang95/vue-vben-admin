<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import { sendLoginCodeApi } from '#/api/core/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'CodeLogin' });

const authStore = useAuthStore();
const router = useRouter();
const loading = ref(false);
const currentEmail = ref(''); // 保存当前输入的邮箱

// 发送验证码
async function handleSendCode() {
  const email = currentEmail.value;

  if (!email) {
    message.warning('请先输入邮箱');
    return false;
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    message.warning('请输入有效的邮箱地址');
    return false;
  }

  try {
    await sendLoginCodeApi({ email });
    message.success('验证码已发送，请查收邮件');
    return true;
  } catch (error: any) {
    // 错误消息已由 HTTP 拦截器处理
    return false;
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入邮箱',
        onChange: (e: Event) => {
          currentEmail.value = (e.target as HTMLInputElement).value;
        },
      },
      fieldName: 'email',
      label: '邮箱',
      rules: z.string().email({ message: '请输入有效的邮箱地址' }),
    },
    {
      component: 'VbenPinInput',
      componentProps: {
        codeLength: 6,
        placeholder: '请输入邮箱验证码',
        createText: (countdown: number) => {
          return countdown > 0 ? `${countdown}秒后重试` : '发送验证码';
        },
        handleSendCode: handleSendCode,
      },
      fieldName: 'code',
      label: '邮箱验证码',
      rules: z
        .string()
        .length(6, { message: '验证码必须是6位' })
        .regex(/^\d{6}$/, { message: '验证码必须是6位数字' }),
    },
  ];
});

/**
 * 异步处理登录操作
 * Asynchronously handle the login process
 * @param values 登录表单数据
 */
async function handleLogin(values: Recordable<any>) {
  try {
    loading.value = true;
    await authStore.authLoginByCode(values);
  } catch (error: any) {
    // 错误消息已由 HTTP 拦截器处理
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthenticationCodeLogin
    :form-schema="formSchema"
    :loading="loading"
    title="验证码登录 📧"
    sub-title="使用邮箱验证码快速登录"
    @submit="handleLogin"
  />
</template>
