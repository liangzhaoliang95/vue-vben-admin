import type { RouteRecordStringComponent } from '@vben-core/typings';

import { computed, ref } from 'vue';

import { acceptHMRUpdate, defineStore } from 'pinia';

import { useAccessStore } from './access';
import { useUserStore } from './user';

interface BusinessLineInfo {
  code: string;
  description?: string;
  id: number;
  isDefault?: boolean;
  logoUrl?: string;
  name: string;
}

interface RoleInfo {
  code: string;
  description?: string;
  id: number;
  isSuper?: boolean;
  name: string;
}

interface BusinessLineRoles {
  businessLine: BusinessLineInfo;
  roles: RoleInfo[];
}

interface MenuTreeNode {
  alwaysShow?: boolean;
  children?: MenuTreeNode[];
  code: string;
  component?: string;
  icon?: string;
  keepAlive?: boolean;
  link?: string; // 外链地址（用于IFrameView等组件）
  name: string;
  path: string;
  permissions?: string;
  redirect?: string;
  sortOrder?: number;
  title?: string;
  visible?: boolean;
}

interface ButtonPermission {
  apiMethod?: string;
  apiPath?: string;
  code: string;
  id: number;
  name: string;
  permission: string;
}

interface BusinessApiProvider {
  fetchBusinessLines: () => Promise<BusinessLineRoles[]>;
  fetchRoleMenu: (roleId: number) => Promise<MenuTreeNode[]>;
  fetchRolePowerCodes?: (roleId: number) => Promise<string[]>;
}

let businessApiProvider: BusinessApiProvider | null = null;

let businessAccessRefresher: (() => Promise<void>) | null = null;

export function registerBusinessApiProvider(provider: BusinessApiProvider) {
  businessApiProvider = provider;
}

export function registerBusinessAccessRefresher(handler: () => Promise<void>) {
  businessAccessRefresher = handler;
}

export async function triggerBusinessAccessRefresh() {
  if (businessAccessRefresher) {
    await businessAccessRefresher();
  }
}

function getBusinessApiProvider(): BusinessApiProvider {
  if (!businessApiProvider) {
    throw new Error('[core-business] Business API provider is not registered.');
  }
  return businessApiProvider;
}

function toRouteNodes(nodes: MenuTreeNode[] | undefined) {
  if (!nodes?.length) {
    return [] as RouteRecordStringComponent[];
  }
  return nodes.map((node) => {
    // 后端返回的component路径格式：/dashboard/analytics/index（已去掉 views/ 和 .vue）
    // 前端直接使用，不需要添加 /views 前缀
    // normalizeViewPath 会自动处理路径映射
    const component: string | undefined = node.component;

    const route: RouteRecordStringComponent = {
      component: component || '',
      meta: {
        alwaysShow: node.alwaysShow,
        hideMenu: node.visible === false,
        icon: node.icon,
        keepAlive: node.keepAlive,
        order: node.sortOrder,
        permissions: node.permissions
          ? node.permissions
              .split(',')
              .map((item: string) => item.trim())
              .filter(Boolean)
          : undefined,
        title: node.title || node.name,
        // 如果 component 是 IFrameView 且有 link，将 link 转换为 iframeSrc
        iframeSrc:
          component === 'IFrameView' && node.link ? node.link : undefined,
        // 保留 link 字段用于其他用途（如新窗口打开）
        link: node.link,
      },
      name: node.code || node.name,
      path: normalizeRoutePath(node.path),
      redirect: node.redirect,
    };

    // 如果component为空字符串，删除它
    if (!route.component) {
      (route as any).component = undefined;
    }

    // 如果redirect为空，删除它
    if (!route.redirect) {
      (route as any).redirect = undefined;
    }

    if (!route.meta?.icon) {
      delete route.meta?.icon;
    }

    if (
      route.meta &&
      route.meta.permissions &&
      Array.isArray(route.meta.permissions) &&
      route.meta.permissions.length === 0
    ) {
      delete route.meta.permissions;
    }

    if (!route.meta?.title) {
      delete route.meta?.title;
    }

    if (!route.meta?.order && route.meta?.order !== 0) {
      delete route.meta?.order;
    }

    // 清理未定义的 meta 字段
    if (!route.meta?.iframeSrc) {
      delete route.meta?.iframeSrc;
    }
    if (!route.meta?.link) {
      delete route.meta?.link;
    }

    if (node.children?.length) {
      route.children = toRouteNodes(node.children);
    }

    return route;
  });
}

function normalizeRoutePath(path: string) {
  if (!path) {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

async function fetchBusinessLines() {
  return await getBusinessApiProvider().fetchBusinessLines();
}

async function fetchRoleMenu(roleId: number) {
  return await getBusinessApiProvider().fetchRoleMenu(roleId);
}

async function fetchRolePowerCodes(roleId: number): Promise<string[]> {
  const provider = getBusinessApiProvider();
  if (provider.fetchRolePowerCodes) {
    return await provider.fetchRolePowerCodes(roleId);
  }
  return [];
}

export const useBusinessStore = defineStore(
  'core-business',
  () => {
    const accessStore = useAccessStore();
    const businessLines = ref<BusinessLineRoles[]>([]);
    const currentBusinessLineId = ref<null | number>(null);
    const currentRoleId = ref<null | number>(null);
    const roleMenuCache = ref<Record<number, RouteRecordStringComponent[]>>({});
    const roleButtonCache = ref<Record<number, ButtonPermission[]>>({});
    const initialized = ref(false);
    const loading = ref(false);

    const businessLineOptions = computed(() =>
      businessLines.value.map(({ businessLine }) => ({
        id: businessLine.id,
        label: businessLine.name,
        logoUrl: businessLine.logoUrl,
        value: String(businessLine.id),
      })),
    );

    const currentBusinessLine = computed(
      () =>
        businessLines.value.find(
          (item) => item.businessLine.id === currentBusinessLineId.value,
        ) || null,
    );

    const availableRoles = computed(
      () => currentBusinessLine.value?.roles ?? [],
    );

    const currentRole = computed(
      () =>
        availableRoles.value.find((role) => role.id === currentRoleId.value) ||
        null,
    );

    function setBusinessLines(list: BusinessLineRoles[]) {
      businessLines.value = Array.isArray(list) ? [...list] : [];
    }

    async function init(
      force: boolean = false,
      presetBusinessLines?: BusinessLineRoles[],
    ) {
      if (initialized.value && !force) {
        return;
      }
      try {
        loading.value = true;
        let list: BusinessLineRoles[] = [];

        if (Array.isArray(presetBusinessLines)) {
          list = presetBusinessLines;
        } else if (!force && businessLines.value.length > 0) {
          list = businessLines.value;
        } else if (businessApiProvider) {
          list = await fetchBusinessLines();
        } else {
          // 尚未注册 API 提供者时，保留当前数据等待后续初始化
          initialized.value = false;
          return;
        }

        setBusinessLines(list);

        if (businessLines.value.length === 0) {
          currentBusinessLineId.value = null;
          currentRoleId.value = null;
          initialized.value = true;
          return;
        }

        const persistedBusinessLineId = currentBusinessLineId.value;
        const persistedRoleId = currentRoleId.value;

        const defaultBusinessLine =
          businessLines.value.find((item) => item.businessLine.isDefault) ??
          businessLines.value[0];

        const targetBusinessLine =
          businessLines.value.find(
            (item) => item.businessLine.id === persistedBusinessLineId,
          ) ?? defaultBusinessLine;

        if (targetBusinessLine) {
          currentBusinessLineId.value = targetBusinessLine.businessLine.id;

          const defaultRole =
            targetBusinessLine.roles.find(
              (role) => role.id === persistedRoleId,
            ) ?? targetBusinessLine.roles[0];

          if (defaultRole) {
            currentRoleId.value = defaultRole.id;
            await ensureRoleMenus(defaultRole.id);
            updateUserRoles(defaultRole);

            // 获取并更新权限码
            try {
              const powerCodes = await fetchRolePowerCodes(defaultRole.id);
              accessStore.setAccessCodes(powerCodes);
            } catch (error) {
              console.error('获取权限码失败:', error);
              accessStore.setAccessCodes([]);
            }
          } else {
            currentRoleId.value = null;
            accessStore.setAccessCodes([]);
          }
        }

        initialized.value = true;
      } finally {
        loading.value = false;
      }
    }

    async function ensureRoleMenus(roleId: number, force: boolean = false) {
      if (!roleId) {
        // 如果没有角色ID，清空缓存并返回空数组
        roleMenuCache.value = {};
        return [];
      }
      if (!roleMenuCache.value[roleId] || force) {
        // 调用 getRoleMenu 接口，直接返回菜单数组
        const menus = await fetchRoleMenu(roleId);

        // 确保 menus 是数组
        if (!Array.isArray(menus)) {
          console.error('getRoleMenu 返回的数据格式错误，期望数组:', menus);
          roleMenuCache.value[roleId] = [];
          return [];
        }

        // 转换菜单数据
        const routeNodes = toRouteNodes(menus);
        roleMenuCache.value[roleId] = routeNodes;
      }
      // 确保返回的是数组，即使缓存中有数据也要返回
      return roleMenuCache.value[roleId] ?? [];
    }

    async function ensureCurrentRoleMenus(force: boolean = false) {
      if (!currentRoleId.value) {
        return [];
      }
      return await ensureRoleMenus(currentRoleId.value, force);
    }

    function updateUserRoles(role: null | RoleInfo) {
      const userStore = useUserStore();
      if (!role) {
        userStore.setUserRoles([]);
        return;
      }
      userStore.setUserRoles(role.code ? [role.code] : []);
    }

    async function switchBusinessLine(id: number) {
      if (currentBusinessLineId.value === id) {
        return;
      }
      await init();

      const target = businessLines.value.find(
        (item) => item.businessLine.id === id,
      );
      if (!target) {
        return;
      }

      // 切换业务线前，先清空菜单缓存，确保获取新业务线的菜单
      roleMenuCache.value = {};

      currentBusinessLineId.value = id;

      const role =
        target.roles.find((item) => item.id === currentRoleId.value) ??
        target.roles[0] ??
        null;

      if (role) {
        await switchRole(role.id);
        // 切换角色后，需要重新生成路由和菜单
        // 标记需要重新生成，路由守卫会检测到并重新生成
        accessStore.setIsAccessChecked(false);
      } else {
        currentRoleId.value = null;
        updateUserRoles(null);
        // 没有角色时，清空权限码、菜单和路由
        accessStore.setAccessCodes([]);
        accessStore.setAccessMenus([]);
        accessStore.setAccessRoutes([]);
        accessStore.setIsAccessChecked(false);
      }
    }

    async function switchRole(id: number) {
      if (!id) {
        return;
      }
      currentRoleId.value = id;
      // 强制刷新菜单，不使用缓存
      const menus = await ensureRoleMenus(id, true);
      const role = availableRoles.value.find((item) => item.id === id) ?? null;
      updateUserRoles(role ?? null);

      // 获取并更新权限码
      try {
        const powerCodes = await fetchRolePowerCodes(id);
        accessStore.setAccessCodes(powerCodes);
      } catch (error) {
        console.error('获取权限码失败:', error);
        accessStore.setAccessCodes([]);
      }

      return menus;
    }

    function getCurrentButtons() {
      if (!currentRoleId.value) {
        return [];
      }
      return roleButtonCache.value[currentRoleId.value] ?? [];
    }

    function reset() {
      businessLines.value = [];
      currentBusinessLineId.value = null;
      currentRoleId.value = null;
      roleMenuCache.value = {};
      roleButtonCache.value = {};
      initialized.value = false;
      loading.value = false;
    }

    return {
      availableRoles,
      businessLineOptions,
      businessLines,
      currentBusinessLine,
      currentBusinessLineId,
      currentRole,
      currentRoleId,
      setBusinessLines,
      ensureCurrentRoleMenus,
      ensureRoleMenus,
      getCurrentButtons,
      init,
      initialized,
      loading,
      reset,
      switchBusinessLine,
      switchRole,
    };
  },
  {
    persist: {
      pick: ['businessLines', 'currentBusinessLineId', 'currentRoleId'],
    },
  },
);

const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useBusinessStore, hot));
}

export type { BusinessLineRoles, MenuTreeNode };
