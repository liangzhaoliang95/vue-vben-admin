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
      // 显示 loading 提示
      const hideLoading = message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 0, // 设置为 0 表示不自动关闭
      });

      try {
        // 使用后端真实接口获取当前角色的菜单
        const menus = await businessStore.ensureCurrentRoleMenus(true);
        return menus;
      } finally {
        // 菜单加载完成后关闭 loading
        hideLoading();
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
