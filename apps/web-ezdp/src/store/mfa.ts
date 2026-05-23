import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMFAStore = defineStore('mfa', () => {
  // 是否显示 MFA 验证弹窗
  const visible = ref(false);

  // 当前挂起的 resolve 回调，验证通过时调用 true，取消时调用 false
  let pendingResolve: ((ok: boolean) => void) | null = null;

  /**
   * 触发 MFA 验证弹窗，返回 Promise：
   * - true：用户验证通过
   * - false：用户取消
   */
  function requireVerify(): Promise<boolean> {
    visible.value = true;
    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  function onVerifySuccess() {
    visible.value = false;
    pendingResolve?.(true);
    pendingResolve = null;
  }

  function onVerifyCancel() {
    visible.value = false;
    pendingResolve?.(false);
    pendingResolve = null;
  }

  return { visible, requireVerify, onVerifySuccess, onVerifyCancel };
});
