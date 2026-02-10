<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationForgetPassword, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import {
  resetPasswordApi,
  sendResetPasswordCodeApi,
} from '#/api/core/auth';

defineOptions({ name: 'ForgetPassword' });

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
    await sendResetPasswordCodeApi({ email });
    message.success('验证码已发送，请查收邮件');
    return true;
  } catch (error: any) {
    message.error(error.message || '发送验证码失败');
    return false;
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: 'example@example.com',
        onChange: (e: Event) => {
          currentEmail.value = (e.target as HTMLInputElement).value;
        },
      },
      fieldName: 'email',
      label: $t('authentication.email'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.emailTip') })
        .email($t('authentication.emailValidErrorTip')),
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
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请输入新密码',
      },
      fieldName: 'newPassword',
      label: '新密码',
      renderComponentContent() {
        return {
          strengthText: () => $t('authentication.passwordStrength'),
        };
      },
      rules: z
        .string()
        .min(6, { message: '密码至少6个字符' })
        .max(20, { message: '密码最多20个字符' }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: '请再次输入新密码',
      },
      dependencies: {
        rules(values) {
          const { newPassword } = values;
          return z
            .string({ required_error: '请确认密码' })
            .min(1, { message: '请确认密码' })
            .refine((value) => value === newPassword, {
              message: $t('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['newPassword'],
      },
      fieldName: 'confirmPassword',
      label: $t('authentication.confirmPassword'),
    },
  ];
});

async function handleSubmit(values: Recordable<any>) {
  try {
    loading.value = true;
    await resetPasswordApi({
      email: values.email,
      code: values.code,
      newPassword: values.newPassword,
    });
    message.success('密码重置成功！');
    router.push('/auth/login');
  } catch (error: any) {
    // 错误消息已由 HTTP 拦截器处理,这里不需要再次显示
    // message.error(error.message || '密码重置失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthenticationForgetPassword
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleSubmit"
  />
</template>
