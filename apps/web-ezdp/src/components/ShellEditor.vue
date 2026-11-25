<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';

hljs.registerLanguage('bash', bash);

interface Props {
  value?: string;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  value: '',
  placeholder: '',
  minRows: 6,
  maxRows: 20,
  disabled: false,
});

const emit = defineEmits<{
  'update:value': [val: string];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

const highlighted = computed(() => {
  if (!props.value) return '';
  const result = hljs.highlight(props.value, {
    language: 'bash',
    ignoreIllegals: true,
  });
  // 末尾加一个空行，防止最后一行高亮块高度塌陷
  return result.value + '\n';
});

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const lineHeight = Number.parseInt(getComputedStyle(el).lineHeight) || 20;
  const min = props.minRows * lineHeight + 16;
  const max = props.maxRows * lineHeight + 16;
  const scrollH = el.scrollHeight;
  el.style.height = `${Math.min(Math.max(scrollH, min), max)}px`;
}

function onInput(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value;
  emit('update:value', val);
  nextTick(autoResize);
}

function onScroll() {
  if (containerRef.value && textareaRef.value) {
    containerRef.value.scrollTop = textareaRef.value.scrollTop;
    containerRef.value.scrollLeft = textareaRef.value.scrollLeft;
  }
}

watch(
  () => props.value,
  () => nextTick(autoResize),
);

onMounted(() => {
  nextTick(autoResize);
});
</script>

<template>
  <div class="shell-editor-wrapper">
    <!-- 高亮层（只读，作为背景） -->
    <div ref="containerRef" aria-hidden="true" class="shell-editor-highlight">
      <pre><code class="hljs language-bash" v-html="highlighted || ' '" /></pre>
    </div>
    <!-- 编辑层（透明文字，覆盖在高亮层上） -->
    <textarea
      ref="textareaRef"
      :disabled="disabled"
      :placeholder="placeholder"
      :value="value"
      class="shell-editor-textarea"
      spellcheck="false"
      @input="onInput"
      @scroll="onScroll"
    />
  </div>
</template>

<style scoped>
.shell-editor-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 20px;
  background: #1e1e1e;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  transition: border-color 0.2s;
}

.shell-editor-wrapper:focus-within {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgb(22 119 255 / 20%);
}

/* 高亮层：绝对定位，作为视觉背景 */
.shell-editor-highlight {
  position: absolute;
  inset: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  pointer-events: none;
}

.shell-editor-highlight pre {
  padding: 8px 12px;
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  word-break: break-all;
  white-space: pre-wrap;
  background: transparent;
}

.shell-editor-highlight code {
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  word-break: break-all;
  white-space: pre-wrap;
  background: transparent;
}

/* 编辑层：透明文字，让高亮层透出 */
.shell-editor-textarea {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 120px;
  padding: 8px 12px;
  margin: 0;
  overflow: auto;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: transparent;
  word-break: break-all;
  white-space: pre-wrap;
  caret-color: #fff;
  resize: vertical;
  outline: none;
  background: transparent;
  border: none;
}

.shell-editor-textarea::placeholder {
  color: #666;
}

.shell-editor-textarea:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* hljs 暗色主题 token 颜色（github-dark 风格） */
:deep(.hljs) {
  color: #e6edf3;
}

:deep(.hljs-comment),
:deep(.hljs-quote) {
  font-style: italic;
  color: #8b949e;
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-subst) {
  color: #ff7b72;
}

:deep(.hljs-string),
:deep(.hljs-doctag) {
  color: #a5d6ff;
}

:deep(.hljs-number),
:deep(.hljs-literal),
:deep(.hljs-variable),
:deep(.hljs-template-variable),
:deep(.hljs-tag .hljs-attr) {
  color: #79c0ff;
}

:deep(.hljs-title),
:deep(.hljs-section),
:deep(.hljs-selector-id) {
  color: #d2a8ff;
}

/* stylelint-disable selector-class-pattern */
:deep(.hljs-built_in),
:deep(.hljs-name),
:deep(.hljs-type) {
  color: #ffa657;
}
/* stylelint-enable selector-class-pattern */

:deep(.hljs-params) {
  color: #e6edf3;
}

:deep(.hljs-meta) {
  color: #79c0ff;
}

:deep(.hljs-symbol),
:deep(.hljs-bullet) {
  color: #f78166;
}

:deep(.hljs-addition) {
  color: #aff5b4;
  background: #033a16;
}

:deep(.hljs-deletion) {
  color: #ffdcd7;
  background: #67060c;
}
</style>
