<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationRegister, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import { checkEmailExistsApi, registerApi, sendRegisterCodeApi } from '#/api/core/auth';

defineOptions({ name: 'Register' });

const router = useRouter();
const loading = ref(false);
const checkingEmail = ref(false);
const currentEmail = ref(''); // 保存当前输入的邮箱

// 检查邮箱是否已存在
async function checkEmail(email: string) {
  if (!email) return;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return;

  try {
    checkingEmail.value = true;
    const result = await checkEmailExistsApi({ email });
    if (result.exists) {
      message.warning('该邮箱已被注册');
      return false;
    }
    return true;
  } catch (error: any) {
    // 忽略检查错误
    return true;
  } finally {
    checkingEmail.value = false;
  }
}

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

  // 检查邮箱是否已存在
  const canSend = await checkEmail(email);
  if (!canSend) {
    return false;
  }

  try {
    await sendRegisterCodeApi({ email });
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
        placeholder: '请输入邮箱',
        onChange: (e: Event) => {
          currentEmail.value = (e.target as HTMLInputElement).value;
        },
        onBlur: async (e: FocusEvent) => {
          const email = (e.target as HTMLInputElement).value;
          if (email) {
            await checkEmail(email);
          }
        },
      },
      fieldName: 'email',
      label: $t('authentication.email'),
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
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'userName',
      label: $t('authentication.username'),
      rules: z
        .string()
        .min(2, { message: '用户名至少2个字符' })
        .max(50, { message: '用户名最多50个字符' }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
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
        placeholder: $t('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ required_error: $t('authentication.passwordTip') })
            .min(1, { message: $t('authentication.passwordTip') })
            .refine((value) => value === password, {
              message: $t('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: $t('authentication.confirmPassword'),
    },
    {
      component: 'VbenCheckbox',
      fieldName: 'agreePolicy',
      renderComponentContent: () => ({
        default: () =>
          h('span', [
            $t('authentication.agree'),
            h(
              'a',
              {
                class: 'vben-link ml-1 ',
                href: '',
              },
              `${$t('authentication.privacyPolicy')} & ${$t('authentication.terms')}`,
            ),
          ]),
      }),
      rules: z.boolean().refine((value) => !!value, {
        message: $t('authentication.agreeTip'),
      }),
    },
  ];
});

async function handleSubmit(values: Recordable<any>) {
  try {
    loading.value = true;
    const result = await registerApi({
      email: values.email,
      userName: values.userName,
      password: values.password,
      code: values.code,
    });
    message.success('注册成功！');
    router.push('/auth/login');
  } catch (error: any) {
    // 错误消息已由 HTTP 拦截器处理,这里不需要再次显示
    // message.error(error.message || '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthenticationRegister
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleSubmit"
  />
</template>
