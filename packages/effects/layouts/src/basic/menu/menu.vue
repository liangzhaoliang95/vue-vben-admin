<script lang="ts" setup>
import type { MenuRecordRaw } from '@vben/types';

import type { MenuProps } from '@vben-core/menu-ui';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { SvgAvatar2Icon } from '@vben/icons';
import { preferences } from '@vben/preferences';
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
  accordion: undefined, // 使用 undefined，让组件从 preferences 读取
  menus: () => [],
});

const emit = defineEmits<{
  open: [string, string[]];
  select: [string, string?];
}>();

const businessStore = useBusinessStore();
const router = useRouter();

// 切换业务线的 loading 状态
const switchingBusinessLine = ref(false);

// 从配置中获取 accordion 值，如果 props 中未指定则使用全局配置
const accordion = computed(() => {
  return props.accordion ?? preferences.navigation.accordion;
});

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
    switchingBusinessLine.value = true;
    try {
      await businessStore.switchBusinessLine(id);
      // 先跳转到根路由，确保reload后停留在首页
      await router.replace('/');
      // 使用页面刷新确保菜单100%正确更新
      window.location.reload();
    } catch (error) {
      console.error('切换业务线失败:', error);
      switchingBusinessLine.value = false;
    }
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
  <!-- 菜单收起时只显示 logo 图标 -->
  <div v-if="collapse" class="business-line-collapsed">
    <img
      v-if="selectedOption?.logoUrl"
      :src="selectedOption.logoUrl"
      :alt="selectedOption.label"
      class="size-6 object-contain"
    />
    <SvgAvatar2Icon v-else class="size-6" />
  </div>

  <!-- 菜单展开时显示完整下拉 -->
  <div v-else class="business-line-select">
    <Select
      v-model="selectedValue"
      :disabled="switchingBusinessLine || businessStore.loading"
    >
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
            :class="{
              'business-line-item-selected':
                option.value === selectedValue,
            }"
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
    width: 90%;
    margin: 0 10px 10px auto;
  }
}

// 收起状态只显示 logo
.business-line-collapsed {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px 0;
}
</style>

<style lang="scss">
// 业务线下拉内容样式 - 不使用 scoped，因为 SelectContent 通过 Portal 渲染到 body
.business-line-select-content {
  // 增加宽度，适应业务线名称
  min-width: 200px !important;
  width: auto !important;
  // 移除最大高度限制，让所有业务线一次性显示
  max-height: none !important;

  // 隐藏选中项的对钩图标，添加边框高亮效果
  .business-line-item-selected {
    border: 1px solid hsl(var(--primary)) !important;
    background-color: hsl(var(--accent) / 30%) !important;
    border-radius: 4px !important;

    // 隐藏右侧的对钩指示器容器
    > span.absolute {
      display: none !important;
    }
  }

  // 调整所有选项的右侧 padding（因为隐藏了对钩）
  [role="option"] {
    padding-right: 0.5rem !important;
  }
}
</style>
