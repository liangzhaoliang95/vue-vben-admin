<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationForgetPassword, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Button, message } from 'ant-design-vue';

import {
  resetPasswordApi,
  sendResetPasswordCodeApi,
} from '#/api/core/auth';

defineOptions({ name: 'ForgetPassword' });

const router = useRouter();
const loading = ref(false);
const sendingCode = ref(false);
const countdown = ref(0);
let timer: NodeJS.Timeout | null = null;

// 发送验证码
async function sendCode(email: string) {
  if (!email) {
    message.warning('请先输入邮箱');
    return;
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    message.warning('请输入有效的邮箱地址');
    return;
  }

  try {
    sendingCode.value = true;
    await sendResetPasswordCodeApi({ email });
    message.success('验证码已发送，请查收邮件');

    // 开始倒计时
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    }, 1000);
  } catch (error: any) {
    message.error(error.message || '发送验证码失败');
  } finally {
    sendingCode.value = false;
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: 'example@example.com',
      },
      fieldName: 'email',
      label: $t('authentication.email'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.emailTip') })
        .email($t('authentication.emailValidErrorTip')),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入邮箱验证码',
      },
      fieldName: 'code',
      label: '邮箱验证码',
      suffix: ({ form }) =>
        h(
          Button,
          {
            disabled: countdown.value > 0 || sendingCode.value,
            loading: sendingCode.value,
            size: 'small',
            type: 'link',
            onClick: () => {
              const email = form.values.email;
              sendCode(email);
            },
          },
          {
            default: () =>
              countdown.value > 0
                ? `${countdown.value}秒后重试`
                : '发送验证码',
          },
        ),
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
    message.error(error.message || '密码重置失败');
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
