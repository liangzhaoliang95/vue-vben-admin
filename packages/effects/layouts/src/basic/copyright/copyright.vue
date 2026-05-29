<script lang="ts" setup>
interface Props {
  companyName?: string;
  companySiteLink?: string;
  date?: string;
  icp?: string;
  icpLink?: string;
  appVersion?: string;
  frontendVersion?: string;
}

defineOptions({
  name: 'Copyright',
});

withDefaults(defineProps<Props>(), {
  companyName: 'Vben Admin',
  companySiteLink: '',
  date: '2026',
  icp: '',
  icpLink: '',
  appVersion: '',
  frontendVersion: '',
});
</script>

<template>
  <div class="text-md flex-center">
    <!-- ICP Link -->
    <a
      v-if="icp"
      :href="icpLink || 'javascript:void(0)'"
      class="hover:text-primary-hover mx-1"
      target="_blank"
    >
      {{ icp }}
    </a>

    <!-- Copyright Text -->
    Copyright © {{ date }}

    <!-- Company Link -->
    <a
      v-if="companyName"
      :href="companySiteLink || 'javascript:void(0)'"
      class="hover:text-primary-hover mx-1"
      target="_blank"
    >
      {{ companyName }}
    </a>

    <!-- 同时有前后端版本号时显示 F:vxxx B:vxxx 格式 -->
    <span
      v-if="frontendVersion && appVersion"
      class="ml-2 opacity-60"
    >Web:{{ frontendVersion }} Server:{{ appVersion }}</span>
    <!-- 只有后端版本号 -->
    <span
      v-else-if="appVersion"
      class="ml-2 opacity-60"
    >Server:{{ appVersion }}</span>
    <!-- 只有前端版本号 -->
    <span
      v-else-if="frontendVersion"
      class="ml-2 opacity-60"
    >Web:{{ frontendVersion }}</span>
  </div>
</template>
