<script lang="ts" setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { Page } from '@vben/common-ui';
import { Card, Spin, Empty, Input, message, Tree, Tooltip } from 'ant-design-vue';
import { $t } from '#/locales';
import { loadDocList, loadDocContent, markdownToHtml, findDocItem } from './data';
import type { DocItem, DocPageState } from './types';
import hljs from 'highlight.js';

defineOptions({ name: 'DocCenter' });

const docList = ref<DocItem[]>([]);
const searchKeyword = ref('');
const contentRef = ref<HTMLElement | null>(null);
const tocItems = ref<{ id: string; text: string; level: number }[]>([]);
const activeHeading = ref('');

const state = ref<DocPageState>({
  selectedDoc: null,
  content: '',
  loading: false,
  error: null,
});

const expandedKeys = ref<string[]>([]);

const currentDoc = computed(() => {
  if (!state.value.selectedDoc) return null;
  return findDocItem(docList.value, state.value.selectedDoc);
});

// 搜索过滤后的树数据
const filteredDocList = computed(() => {
  if (!searchKeyword.value.trim()) return docList.value;
  return filterDocItems(docList.value, searchKeyword.value.toLowerCase());
});

function filterDocItems(items: DocItem[], keyword: string): DocItem[] {
  const result: DocItem[] = [];
  for (const item of items) {
    if (item.title.toLowerCase().includes(keyword)) {
      result.push(item);
    } else if (item.children) {
      const filteredChildren = filterDocItems(item.children, keyword);
      if (filteredChildren.length > 0) {
        result.push({ ...item, children: filteredChildren });
      }
    }
  }
  return result;
}

const treeData = computed(() => {
  function convertToTreeNode(item: DocItem): any {
    const node: any = {
      key: item.id,
      title: item.title,
      isLeaf: !item.isCategory,
      selectable: !item.isCategory,
      isCategory: item.isCategory,
    };
    if (item.children?.length) {
      node.children = item.children.map(convertToTreeNode);
    }
    return node;
  }
  return filteredDocList.value.map(convertToTreeNode);
});

// 提取目录
function extractToc(html: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const headings = div.querySelectorAll('h1, h2, h3, h4');
  const items: { id: string; text: string; level: number }[] = [];
  headings.forEach((h, index) => {
    const level = parseInt(h.tagName[1]!);
    const text = h.textContent || '';
    const id = `heading-${index}`;
    items.push({ id, text, level });
  });
  return items;
}

// 给内容中的标题添加 id，并给代码块添加高亮和复制按钮
function enhanceContent(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  // 给标题添加 id
  const headings = div.querySelectorAll('h1, h2, h3, h4');
  headings.forEach((h, index) => {
    h.id = `heading-${index}`;
  });

  // 代码高亮 + 复制按钮
  const codeBlocks = div.querySelectorAll('pre code');
  codeBlocks.forEach((block) => {
    hljs.highlightElement(block as HTMLElement);
    const pre = block.parentElement!;
    pre.style.position = 'relative';

    // 获取语言
    const langClass = Array.from(block.classList).find((c) => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : '';

    // 添加语言标签和复制按钮的包装
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="code-lang">${lang || 'code'}</span>
      <button class="copy-btn" data-code="${encodeURIComponent(block.textContent || '')}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        复制
      </button>
    `;

    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });

  return div.innerHTML;
}

async function loadDoc(docId: string) {
  state.value.selectedDoc = docId;
  state.value.loading = true;
  state.value.error = null;
  state.value.content = '';
  tocItems.value = [];

  try {
    const doc = findDocItem(docList.value, docId);
    if (!doc?.fileName) throw new Error('文档不存在');

    const content = await loadDocContent(doc.fileName);
    const html = markdownToHtml(content);
    tocItems.value = extractToc(html);
    state.value.content = enhanceContent(html);

    await nextTick();
    bindCopyButtons();
    setupScrollSpy();
  } catch (error: any) {
    state.value.error = error.message || '加载文档失败';
    message.error(`加载文档失败: ${error.message}`);
  } finally {
    state.value.loading = false;
  }
}

function bindCopyButtons() {
  const buttons = contentRef.value?.querySelectorAll('.copy-btn');
  buttons?.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = decodeURIComponent((btn as HTMLElement).dataset.code || '');
      try {
        await navigator.clipboard.writeText(code);
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          已复制
        `;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            复制
          `;
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        message.error('复制失败');
      }
    });
  });
}

function setupScrollSpy() {
  const container = contentRef.value?.closest('.doc-body') as HTMLElement;
  if (!container) return;

  const handler = () => {
    const headings = contentRef.value?.querySelectorAll('h1, h2, h3, h4');
    if (!headings) return;
    let current = '';
    headings.forEach((h) => {
      const rect = h.getBoundingClientRect();
      if (rect.top <= 120) current = h.id;
    });
    if (current) activeHeading.value = current;
  };

  container.addEventListener('scroll', handler, { passive: true });
}

function scrollToHeading(id: string) {
  const el = contentRef.value?.querySelector(`#${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    activeHeading.value = id;
  }
}

function onTreeSelect(selectedKeys: string[]) {
  if (selectedKeys.length > 0) loadDoc(selectedKeys[0]!);
}

function findFirstSelectableDoc(items: DocItem[]): DocItem | null {
  for (const item of items) {
    if (!item.isCategory && item.fileName) return item;
    if (item.children) {
      const found = findFirstSelectableDoc(item.children);
      if (found) return found;
    }
  }
  return null;
}

function collectCategoryKeys(items: DocItem[], keys: string[] = []): string[] {
  for (const item of items) {
    if (item.isCategory) keys.push(item.id);
    if (item.children) collectCategoryKeys(item.children, keys);
  }
  return keys;
}

// 搜索时展开所有节点
watch(searchKeyword, (val) => {
  if (val) {
    expandedKeys.value = collectCategoryKeys(filteredDocList.value);
  }
});

onMounted(async () => {
  try {
    const docs = await loadDocList();
    docList.value = docs;
    expandedKeys.value = collectCategoryKeys(docs);
    const firstDoc = findFirstSelectableDoc(docs);
    if (firstDoc) await loadDoc(firstDoc.id);
  } catch (error: any) {
    message.error(`加载文档列表失败: ${error.message}`);
  }
});
</script>

<template>
  <Page :title="$t('page.docs.title')" :description="$t('page.docs.description')">
    <div class="doc-layout">
      <!-- 左侧导航 -->
      <aside class="doc-sidebar">
        <div class="sidebar-search">
          <Input
            v-model:value="searchKeyword"
            placeholder="搜索文档..."
            allow-clear
            size="small"
          >
            <template #prefix>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </template>
          </Input>
        </div>
        <div class="sidebar-tree">
          <Tree
            v-model:expanded-keys="expandedKeys"
            :tree-data="treeData"
            :selected-keys="state.selectedDoc ? [state.selectedDoc] : []"
            :show-line="false"
            :show-icon="false"
            :block-node="true"
            @select="onTreeSelect"
          >
            <template #title="{ title, isCategory }">
              <span :class="['tree-node', isCategory ? 'tree-category' : 'tree-leaf']">
                <span v-if="isCategory" class="tree-icon category-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                  </svg>
                </span>
                <span v-else class="tree-icon leaf-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </span>
                {{ title }}
              </span>
            </template>
          </Tree>
        </div>
      </aside>

      <!-- 中间内容区 -->
      <main class="doc-main">
        <Spin :spinning="state.loading" size="large">
          <div v-if="state.error" class="doc-empty-state">
            <Empty :description="state.error" />
          </div>
          <div v-else-if="!state.content && !state.loading" class="doc-empty-state">
            <div class="welcome-box">
              <div class="welcome-icon">📚</div>
              <h2>Build Agent 接入文档</h2>
              <p>从左侧选择文档开始阅读</p>
            </div>
          </div>
          <article v-else class="doc-article">
            <div ref="contentRef" class="markdown-body" v-html="state.content" />
          </article>
        </Spin>
      </main>

      <!-- 右侧目录 -->
      <nav v-if="tocItems.length > 0" class="doc-toc">
        <div class="toc-title">本页目录</div>
        <ul class="toc-list">
          <li
            v-for="item in tocItems"
            :key="item.id"
            :class="['toc-item', `toc-h${item.level}`, { active: activeHeading === item.id }]"
            @click="scrollToHeading(item.id)"
          >
            {{ item.text }}
          </li>
        </ul>
      </nav>
    </div>
  </Page>
</template>

<style scoped>
@import 'highlight.js/styles/github-dark.css';

.doc-layout {
  display: flex;
  gap: 24px;
  height: calc(100vh - 180px);
  min-height: 600px;
}

/* 左侧导航 */
.doc-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--vben-background-color);
  border-radius: 8px;
  border: 1px solid var(--vben-border-color);
  overflow: hidden;
}

.sidebar-search {
  padding: 16px;
  border-bottom: 1px solid var(--vben-border-color);
}

.sidebar-search :deep(.ant-input-affix-wrapper) {
  border-radius: 6px;
}

.sidebar-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.tree-icon {
  display: flex;
  align-items: center;
  opacity: 0.6;
}

.category-icon {
  color: #1890ff;
}

.leaf-icon {
  color: #52c41a;
}

.tree-category {
  font-weight: 600;
  color: var(--vben-text-color);
}

.tree-leaf {
  color: var(--vben-text-color-secondary);
}

:deep(.ant-tree-node-selected) .tree-node {
  background: var(--vben-primary-color-light);
  color: var(--vben-primary-color);
}

:deep(.ant-tree-node-selected) .tree-icon {
  opacity: 1;
}

/* 中间内容区 */
.doc-main {
  flex: 1;
  min-width: 0;
  background: var(--vben-background-color);
  border-radius: 8px;
  border: 1px solid var(--vben-border-color);
  overflow-y: auto;
  padding: 32px;
}

.doc-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.welcome-box {
  text-align: center;
}

.welcome-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.welcome-box h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--vben-text-color);
}

.welcome-box p {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
}

/* Markdown 内容样式 */
.markdown-body {
  color: var(--vben-text-color);
  line-height: 1.8;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--vben-text-color);
  scroll-margin-top: 80px;
}

.markdown-body :deep(h1) {
  font-size: 32px;
  border-bottom: 2px solid var(--vben-border-color);
  padding-bottom: 12px;
}

.markdown-body :deep(h2) {
  font-size: 24px;
  border-bottom: 1px solid var(--vben-border-color);
  padding-bottom: 8px;
}

.markdown-body :deep(h3) {
  font-size: 20px;
}

.markdown-body :deep(h4) {
  font-size: 16px;
}

.markdown-body :deep(p) {
  margin-bottom: 16px;
}

.markdown-body :deep(a) {
  color: var(--vben-primary-color);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin-bottom: 16px;
  padding-left: 24px;
}

.markdown-body :deep(li) {
  margin-bottom: 8px;
}

.markdown-body :deep(blockquote) {
  margin: 16px 0;
  padding: 12px 16px;
  border-left: 4px solid var(--vben-primary-color);
  background: var(--vben-background-color-deep);
  border-radius: 4px;
}

.markdown-body :deep(table) {
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
  border: 1px solid var(--vben-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 12px 16px;
  border: 1px solid var(--vben-border-color);
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--vben-background-color-deep);
  font-weight: 600;
}

.markdown-body :deep(code) {
  padding: 2px 6px;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: #e83e8c;
}

/* 代码块样式 */
.markdown-body :deep(.code-block-wrapper) {
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vben-border-color);
}

.markdown-body :deep(.code-block-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #1f2937;
  border-bottom: 1px solid #374151;
}

.markdown-body :deep(.code-lang) {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.markdown-body :deep(.copy-btn) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.markdown-body :deep(.copy-btn:hover) {
  background: #374151;
  color: #fff;
  border-color: #4b5563;
}

.markdown-body :deep(.copy-btn.copied) {
  color: #10b981;
  border-color: #10b981;
}

.markdown-body :deep(pre) {
  margin: 0;
  padding: 16px;
  background: #0d1117 !important;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1.6;
}

/* 右侧目录 */
.doc-toc {
  width: 220px;
  flex-shrink: 0;
  background: var(--vben-background-color);
  border-radius: 8px;
  border: 1px solid var(--vben-border-color);
  padding: 16px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  position: sticky;
  top: 0;
}

.toc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vben-border-color);
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  border-left: 2px solid transparent;
}

.toc-item:hover {
  background: var(--vben-background-color-deep);
  color: var(--vben-text-color);
}

.toc-item.active {
  color: var(--vben-primary-color);
  background: var(--vben-primary-color-light);
  border-left-color: var(--vben-primary-color);
  font-weight: 500;
}

.toc-h1 {
  padding-left: 12px;
}

.toc-h2 {
  padding-left: 20px;
}

.toc-h3 {
  padding-left: 28px;
  font-size: 12px;
}

.toc-h4 {
  padding-left: 36px;
  font-size: 12px;
}

/* 响应式 */
@media (max-width: 1400px) {
  .doc-toc {
    display: none;
  }
}

@media (max-width: 768px) {
  .doc-layout {
    flex-direction: column;
    height: auto;
  }

  .doc-sidebar {
    width: 100%;
    height: 300px;
  }

  .doc-main {
    padding: 16px;
  }
}
</style>
