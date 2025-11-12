import type { RouteRecordStringComponent } from '@vben-core/typings';

import { computed, ref } from 'vue';

import { acceptHMRUpdate, defineStore } from 'pinia';

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

interface RolePowerResponse {
  buttons?: ButtonPermission[];
  menus?: MenuTreeNode[];
}

interface BusinessApiProvider {
  fetchBusinessLines: () => Promise<BusinessLineRoles[]>;
  fetchRolePower: (roleId: number) => Promise<RolePowerResponse>;
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
    const route: RouteRecordStringComponent = {
      component: node.component,
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
      },
      name: node.code || node.name,
      path: normalizeRoutePath(node.path),
      redirect: node.redirect,
    };

    if (!route.component) {
      delete route.component;
    }

    if (!route.redirect) {
      delete route.redirect;
    }

    if (!route.meta?.icon) {
      delete route.meta?.icon;
    }

    if (!route.meta?.permissions?.length) {
      delete route.meta?.permissions;
    }

    if (!route.meta?.title) {
      delete route.meta?.title;
    }

    if (!route.meta?.order && route.meta?.order !== 0) {
      delete route.meta?.order;
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

async function fetchRolePower(roleId: number) {
  return await getBusinessApiProvider().fetchRolePower(roleId);
}

export const useBusinessStore = defineStore(
  'core-business',
  () => {
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

        currentBusinessLineId.value = targetBusinessLine.businessLine.id;

        const defaultRole =
          targetBusinessLine.roles.find(
            (role) => role.id === persistedRoleId,
          ) ?? targetBusinessLine.roles[0];

        if (defaultRole) {
          currentRoleId.value = defaultRole.id;
          await ensureRoleMenus(defaultRole.id);
          updateUserRoles(defaultRole);
        } else {
          currentRoleId.value = null;
        }

        initialized.value = true;
      } finally {
        loading.value = false;
      }
    }

    async function ensureRoleMenus(roleId: number, force: boolean = false) {
      if (!roleId) {
        return [];
      }
      if (!roleMenuCache.value[roleId] || force) {
        const response = await fetchRolePower(roleId);
        roleMenuCache.value[roleId] = toRouteNodes(response?.menus);
        roleButtonCache.value[roleId] = response?.buttons ?? [];
      }
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
      currentBusinessLineId.value = id;

      const role =
        target.roles.find((item) => item.id === currentRoleId.value) ??
        target.roles[0] ??
        null;

      if (role) {
        await switchRole(role.id);
      } else {
        currentRoleId.value = null;
        updateUserRoles(null);
      }
    }

    async function switchRole(id: number) {
      if (!id) {
        return;
      }
      currentRoleId.value = id;
      const menus = await ensureRoleMenus(id);
      const role = availableRoles.value.find((item) => item.id === id) ?? null;
      updateUserRoles(role ?? null);
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

export type { BusinessLineRoles, RolePowerResponse };
