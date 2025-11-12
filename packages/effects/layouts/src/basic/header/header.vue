<script lang="ts" setup>
import { computed, onMounted, useSlots } from 'vue';

import { useRefresh } from '@vben/hooks';
import { RotateCw } from '@vben/icons';
import { preferences, usePreferences } from '@vben/preferences';
import {
  triggerBusinessAccessRefresh,
  useAccessStore,
  useBusinessStore,
} from '@vben/stores';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  VbenAvatar,
  VbenFullScreen,
  VbenIconButton,
} from '@vben-core/shadcn-ui';

import { message } from 'ant-design-vue';

import {
  GlobalSearch,
  LanguageToggle,
  PreferencesButton,
  ThemeToggle,
  TimezoneButton,
} from '../../widgets';

interface Props {
  /**
   * Logo 主题
   */
  theme?: string;
}

defineOptions({
  name: 'LayoutHeader',
});

withDefaults(defineProps<Props>(), {
  theme: 'light',
});

const emit = defineEmits<{ clearPreferencesAndLogout: [] }>();

const REFERENCE_VALUE = 50;

const accessStore = useAccessStore();
const businessStore = useBusinessStore();
const { globalSearchShortcutKey, preferencesButtonPosition } = usePreferences();
const slots = useSlots();
const { refresh } = useRefresh();

const BUSINESS_SWITCH_MESSAGE_KEY = 'business-line-switch';

const rightSlots = computed(() => {
  const list = [{ index: REFERENCE_VALUE + 100, name: 'user-dropdown' }];
  if (preferences.widget.globalSearch) {
    list.push({
      index: REFERENCE_VALUE,
      name: 'global-search',
    });
  }

  if (preferencesButtonPosition.value.header) {
    list.push({
      index: REFERENCE_VALUE + 10,
      name: 'preferences',
    });
  }
  if (preferences.widget.themeToggle) {
    list.push({
      index: REFERENCE_VALUE + 20,
      name: 'theme-toggle',
    });
  }
  if (preferences.widget.languageToggle) {
    list.push({
      index: REFERENCE_VALUE + 30,
      name: 'language-toggle',
    });
  }
  if (preferences.widget.timezone) {
    list.push({
      index: REFERENCE_VALUE + 40,
      name: 'timezone',
    });
  }
  if (preferences.widget.fullscreen) {
    list.push({
      index: REFERENCE_VALUE + 50,
      name: 'fullscreen',
    });
  }
  if (preferences.widget.notification) {
    list.push({
      index: REFERENCE_VALUE + 60,
      name: 'notification',
    });
  }

  Object.keys(slots).forEach((key) => {
    const name = key.split('-');
    if (key.startsWith('header-right')) {
      list.push({ index: Number(name[2]), name: key });
    }
  });
  return list.sort((a, b) => a.index - b.index);
});

const leftSlots = computed(() => {
  const list: Array<{ index: number; name: string }> = [];

  if (preferences.widget.refresh) {
    list.push({
      index: 0,
      name: 'refresh',
    });
  }

  Object.keys(slots).forEach((key) => {
    const name = key.split('-');
    if (key.startsWith('header-left')) {
      list.push({ index: Number(name[2]), name: key });
    }
  });
  return list.sort((a, b) => a.index - b.index);
});

const businessLineOptions = computed(() => businessStore.businessLineOptions);

const hasBusinessLineOptions = computed(
  () => businessLineOptions.value.length > 0,
);

const businessLineValue = computed({
  get() {
    return businessStore.currentBusinessLineId === null
      ? ''
      : String(businessStore.currentBusinessLineId);
  },
  async set(value: string) {
    if (!value) {
      return;
    }
    const id = Number(value);
    if (!Number.isFinite(id) || businessStore.currentBusinessLineId === id) {
      return;
    }
    await handleBusinessLineChange(id);
  },
});

const businessLineLoading = computed(() => businessStore.loading);

async function handleBusinessLineChange(id: number) {
  try {
    message.loading({
      content: '正在切换业务线...',
      duration: 0,
      key: BUSINESS_SWITCH_MESSAGE_KEY,
    });
    await businessStore.switchBusinessLine(id);
    await rebuildAccess();
    message.success({
      content: '业务线切换成功',
      key: BUSINESS_SWITCH_MESSAGE_KEY,
    });
  } catch (error) {
    console.error(error);
    message.error((error as Error)?.message || '业务线切换失败，请稍后重试');
  }
}

async function rebuildAccess() {
  await triggerBusinessAccessRefresh();
  await refresh();
}

function clearPreferencesAndLogout() {
  emit('clearPreferencesAndLogout');
}

onMounted(() => {
  void businessStore.init();
});
</script>

<template>
  <template
    v-for="slot in leftSlots.filter((item) => item.index < REFERENCE_VALUE)"
    :key="slot.name"
  >
    <slot :name="slot.name">
      <template v-if="slot.name === 'refresh'">
        <VbenIconButton class="my-0 mr-1 rounded-md" @click="refresh">
          <RotateCw class="size-4" />
        </VbenIconButton>
      </template>
    </slot>
  </template>
  <div class="flex-center hidden lg:block">
    <slot name="breadcrumb"></slot>
  </div>
  <template
    v-for="slot in leftSlots.filter((item) => item.index > REFERENCE_VALUE)"
    :key="slot.name"
  >
    <slot :name="slot.name"></slot>
  </template>
  <div
    :class="`menu-align-${preferences.header.menuAlign}`"
    class="flex h-full min-w-0 flex-1 items-center"
  >
    <slot name="menu"></slot>
  </div>
  <div class="flex h-full min-w-0 flex-shrink-0 items-center">
    <template v-for="slot in rightSlots" :key="slot.name">
      <slot :name="slot.name">
        <template v-if="slot.name === 'global-search'">
          <div
            v-if="hasBusinessLineOptions"
            class="mr-1 flex items-center sm:mr-4"
          >
            <Select v-model="businessLineValue" :disabled="businessLineLoading">
              <SelectTrigger class="h-9 min-w-[180px]">
                <SelectValue placeholder="选择业务线" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in businessLineOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  <div class="flex items-center gap-2">
                    <VbenAvatar
                      v-if="option.logoUrl"
                      :alt="option.label"
                      :src="option.logoUrl"
                      class="size-5"
                      shape="square"
                    />
                    <span class="truncate">{{ option.label }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <GlobalSearch
            :enable-shortcut-key="globalSearchShortcutKey"
            :menus="accessStore.accessMenus"
            class="mr-1 sm:mr-4"
          />
        </template>

        <template v-else-if="slot.name === 'preferences'">
          <PreferencesButton
            class="mr-1"
            @clear-preferences-and-logout="clearPreferencesAndLogout"
          />
        </template>
        <template v-else-if="slot.name === 'theme-toggle'">
          <ThemeToggle class="mr-1 mt-[2px]" />
        </template>
        <template v-else-if="slot.name === 'language-toggle'">
          <LanguageToggle class="mr-1" />
        </template>
        <template v-else-if="slot.name === 'fullscreen'">
          <VbenFullScreen class="mr-1" />
        </template>
        <template v-else-if="slot.name === 'timezone'">
          <TimezoneButton class="mr-1 mt-[2px]" />
        </template>
      </slot>
    </template>
  </div>
</template>
<style lang="scss" scoped>
.menu-align-start {
  --menu-align: start;
}

.menu-align-center {
  --menu-align: center;
}

.menu-align-end {
  --menu-align: end;
}
</style>
