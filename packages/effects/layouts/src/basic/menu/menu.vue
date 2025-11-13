<script lang="ts" setup>
import type { MenuRecordRaw } from '@vben/types';

import type { MenuProps } from '@vben-core/menu-ui';

import { computed } from 'vue';

import { SvgAvatar2Icon } from '@vben/icons';
import { useBusinessStore } from '@vben/stores';

import { Menu } from '@vben-core/menu-ui';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vben-core/shadcn-ui';

interface Props extends MenuProps {
  menus?: MenuRecordRaw[];
}

const props = withDefaults(defineProps<Props>(), {
  accordion: true,
  menus: () => [],
});

const emit = defineEmits<{
  open: [string, string[]];
  select: [string, string?];
}>();

const businessStore = useBusinessStore();

// 业务线选项
const businessLineOptions = computed(() => businessStore.businessLineOptions);

// 当前选中的业务线值
const selectedValue = computed({
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
    await businessStore.switchBusinessLine(id);
  },
});

// 根据选中的值获取对应的业务线选项
const selectedOption = computed(() => {
  return businessLineOptions.value.find(
    (opt) => opt.value === selectedValue.value,
  );
});

function handleMenuSelect(key: string) {
  emit('select', key, props.mode);
}

function handleMenuOpen(key: string, path: string[]) {
  emit('open', key, path);
}
</script>

<template>
  <div class="business-line-select">
    <Select v-model="selectedValue">
      <SelectTrigger class="business-line-select-trigger">
        <div v-if="selectedOption" class="flex items-center">
          <img
            v-if="selectedOption.logoUrl"
            :src="selectedOption.logoUrl"
            :alt="selectedOption.label"
            class="mr-2 size-5 object-contain"
          />
          <SvgAvatar2Icon v-else class="mr-2 size-5" />
          <span>{{ selectedOption.label }}</span>
        </div>
        <SelectValue v-else placeholder="选择业务线" />
      </SelectTrigger>
      <SelectContent class="business-line-select-content">
        <SelectGroup>
          <SelectItem
            v-for="option in businessLineOptions"
            :key="option.value"
            :value="option.value"
          >
            <div class="flex items-center">
              <img
                v-if="option.logoUrl"
                :src="option.logoUrl"
                :alt="option.label"
                class="mr-2 size-5 object-contain"
              />
              <SvgAvatar2Icon v-else class="mr-2 size-5" />
              <span>{{ option.label }}</span>
            </div>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
  <Menu
    :accordion="accordion"
    :collapse="collapse"
    :collapse-show-title="collapseShowTitle"
    :default-active="defaultActive"
    :menus="menus"
    :mode="mode"
    :rounded="rounded"
    scroll-to-active
    :theme="theme"
    @open="handleMenuOpen"
    @select="handleMenuSelect"
  />
</template>
<style lang="scss" scoped>
$namespace: vben;
// select 需要居中撑满
.business-line-select {
  width: 100%;
  text-align: center;
  // 背景色浅灰
  border-radius: 10px;

  :deep(.business-line-select-trigger) {
    width: 95%;
    margin: 0 auto;
  }
}

:deep(.business-line-select-content) {
  width: 100px !important;
}
</style>
