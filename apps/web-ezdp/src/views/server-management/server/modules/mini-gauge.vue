<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  value: number; // 0-100
}>();

// SVG 圆弧参数
const R = 28;
const CX = 36;
const CY = 36;
const STROKE = 5;
// 圆弧从 -210° 到 30°，跨度 240°（底部留缺口）
const START_ANGLE = -210;
const SWEEP = 240;

const toRad = (deg: number) => (deg * Math.PI) / 180;

const arcPath = (startDeg: number, sweepDeg: number) => {
  const start = toRad(startDeg);
  const end = toRad(startDeg + sweepDeg);
  const x1 = CX + R * Math.cos(start);
  const y1 = CY + R * Math.sin(start);
  const x2 = CX + R * Math.cos(end);
  const y2 = CY + R * Math.sin(end);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
};

const bgPath = arcPath(START_ANGLE, SWEEP);

const valueSweep = computed(() => (Math.min(Math.max(props.value, 0), 100) / 100) * SWEEP);
const valuePath = computed(() => arcPath(START_ANGLE, valueSweep.value));

// 颜色：绿 → 黄 → 红
const color = computed(() => {
  if (props.value < 60) return '#52c41a';
  if (props.value < 85) return '#faad14';
  return '#ff4d4f';
});

const displayValue = computed(() => `${Math.round(props.value)}%`);
</script>

<template>
  <div class="mini-gauge">
    <svg viewBox="0 0 72 72" width="64" height="64">
      <!-- 背景轨道 -->
      <path
        :d="bgPath"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        :stroke-width="STROKE"
        stroke-linecap="round"
      />
      <!-- 数值弧 -->
      <path
        v-if="valueSweep > 0"
        :d="valuePath"
        fill="none"
        :stroke="color"
        :stroke-width="STROKE"
        stroke-linecap="round"
      />
      <!-- 中心数值 -->
      <text
        :x="CX"
        :y="CY + 1"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="11"
        font-weight="600"
        :fill="color"
      >{{ displayValue }}</text>
      <!-- 标签 -->
      <text
        :x="CX"
        :y="CY + 14"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="8"
        fill="rgba(255,255,255,0.4)"
      >{{ label }}</text>
    </svg>
  </div>
</template>

<style scoped>
.mini-gauge {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
