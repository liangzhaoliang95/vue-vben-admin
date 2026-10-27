import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';
import { useBusinessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  // layoutMap 的 key 必须是字符串，与后端返回的 component 字段匹配
  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  const businessStore = useBusinessStore();

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      // 延迟显示loading，避免快速请求时的闪烁（小于300ms的请求不显示loading）
      let hideLoading: (() => void) | null = null;
      const loadingTimer = setTimeout(() => {
        hideLoading = message.loading({
          content: `${$t('common.loadingMenu')}...`,
          duration: 0, // 设置为 0 表示不自动关闭
        });
      }, 300);

      try {
        // 使用后端真实接口获取当前角色的菜单
        const menus = await businessStore.ensureCurrentRoleMenus(true);
        return menus;
      } finally {
        // 菜单加载完成后清除定时器并关闭 loading
        clearTimeout(loadingTimer);
        hideLoading?.();
      }
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
