<script lang="ts" setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Spin, Empty, Input, message, Tree, Table } from 'ant-design-vue';
import { $t } from '#/locales';
import { loadDocList, loadDocContent, findDocItem } from './data';
import type { DocItem, DocPageState } from './types';
import { SystemConfig } from '#/api/system/config';

defineOptions({ name: 'DocCenter' });

const route = useRoute();
const docList = ref<DocItem[]>([]);
const searchKeyword = ref('');
const contentRef = ref<HTMLElement | null>(null);
const tocItems = ref<{ id: string; text: string; level: number }[]>([]);
const activeHeading = ref('');
const systemConfig = ref<SystemConfig.ConfigData | null>(null);

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
    h.id = id; // 直接给标题添加 id
    items.push({ id, text, level });
  });
  return items;
}

async function loadDoc(docId: string) {
  state.value.selectedDoc = docId;
  state.value.loading = true;
  state.value.error = null;
  state.value.content = '';
  tocItems.value = [];

  try {
    const doc = findDocItem(docList.value, docId);
    if (!doc) throw new Error('文档不存在');

    // 如果是事件类型或 HTTP API 类型，不需要加载 HTML 内容
    if (doc.apiType === 'event' || doc.apiType === 'httpApi') {
      state.value.loading = false;
      return;
    }

    if (!doc.fileName) throw new Error('文档不存在');

    let htmlContent = await loadDocContent(doc.fileName);

    // 如果是 DeployAgent 概述页面，使用系统配置替换域名
    if (docId === 'deployAgent-overview' && systemConfig.value) {
      const platformDomain = systemConfig.value.platformDomain || 'https://simple.plaso.cn';
      const apiPrefix = systemConfig.value.apiPrefix || '/server/ezdp';
      const fullApiUrl = `${platformDomain}${apiPrefix}`;

      // 替换域名占位符
      htmlContent = htmlContent.replace(/https:\/\/simple\.plaso\.cn/g, platformDomain);
      htmlContent = htmlContent.replace(/\/server\/ezdp/g, apiPrefix);
      htmlContent = htmlContent.replace(/https:\/\/simple\.plaso\.cn\/server\/ezdp/g, fullApiUrl);
    }

    // 如果是 ServerAgent 文档，使用系统配置替换连接地址
    if ((docId === 'serverAgent-overview' || docId === 'serverAgent-authentication') && systemConfig.value) {
      const serverAgentAddr = systemConfig.value.serverAgentAddr || 'your-ezdp-server.com:82';
      htmlContent = htmlContent.replace(/your-ezdp-server\.com:82/g, serverAgentAddr);
    }

    tocItems.value = extractToc(htmlContent);
    state.value.content = htmlContent;

    await nextTick();
    setupScrollSpy();
  } catch (error: any) {
    state.value.error = error.message || '加载文档失败';
    message.error('加载文档失败: ' + error.message);
  } finally {
    state.value.loading = false;
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    message.success('已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
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
  const el = contentRef.value?.querySelector('#' + id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    activeHeading.value = id;
  }
}

function onTreeSelect(selectedKeys: (string | number)[]) {
  if (selectedKeys.length > 0) {
    const key = selectedKeys[0]!;
    const doc = findDocItem(docList.value, key);
    if (doc && !doc.isCategory) {
      loadDoc(key);
    }
  }
}

function findFirstSelectableDoc(items: DocItem[]): DocItem | null {
  for (const item of items) {
    if (!item.isCategory && (item.fileName || item.apiType === 'event')) return item;
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

function handleContentClick(e: MouseEvent) {
  const card = (e.target as HTMLElement).closest('[data-event-id]') as HTMLElement | null;
  if (!card) return;
  const eventId = card.dataset.eventId;
  if (eventId) loadDoc(eventId);
}

// 将字段数据转换为树形结构
function transformFieldsToTreeData(fields: any[]) {
  return fields.map((field) => {
    const row: any = {
      key: field.name,
      name: field.name,
      type: field.type,
      required: field.required,
      description: field.description,
      enumValues: field.enumValues,
    };
    if (field.nested && field.nested.fields) {
      row.children = field.nested.fields.map((nf: any) => ({
        key: `${field.name}.${nf.name}`,
        name: nf.name,
        type: nf.type,
        required: nf.required,
        description: nf.description,
      }));
    }
    return row;
  });
}

// 表格列定义
const paramColumns = [
  {
    title: '参数名',
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 120,
  },
  {
    title: '必填',
    dataIndex: 'required',
    key: 'required',
    width: 80,
  },
  {
    title: '说明',
    dataIndex: 'description',
    key: 'description',
  },
];

onMounted(async () => {
  try {
    // 加载系统配置
    try {
      const config = await SystemConfig.getConfig();
      systemConfig.value = config;
    } catch (error) {
      console.warn('加载系统配置失败，使用默认配置:', error);
      // 使用默认配置
      systemConfig.value = {
        platformDomain: 'https://simple.plaso.cn',
        apiPrefix: '/server/ezdp',
      };
    }

    const docs = await loadDocList();
    docList.value = docs;
    expandedKeys.value = collectCategoryKeys(docs);

    const targetDocId = route.query.doc as string | undefined;
    if (targetDocId && findDocItem(docs, targetDocId)) {
      await loadDoc(targetDocId);
    } else {
      const firstDoc = findFirstSelectableDoc(docs);
      if (firstDoc) await loadDoc(firstDoc.id);
    }
  } catch (error: any) {
    message.error('加载文档列表失败: ' + error.message);
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
          <div v-else-if="!currentDoc && !state.loading" class="doc-empty-state">
            <div class="welcome-box">
              <div class="welcome-icon">📚</div>
              <h2>Agent 接入文档中心</h2>
              <p>从左侧选择文档开始阅读</p>
            </div>
          </div>
          <!-- HTTP API 文档 - Apifox 风格 -->
          <div v-else-if="currentDoc?.apiType === 'httpApi' && currentDoc.httpApiData" class="api-doc">
            <!-- 顶部 API 信息栏 -->
            <div class="api-header">
              <div class="api-header-left">
                <div class="api-title-row">
                  <span class="api-method-badge method-up">POST</span>
                  <h1 class="api-title">{{ currentDoc.httpApiData.apiName }}</h1>
                </div>
                <div class="api-event-path">
                  <span class="event-path-label">接口路径</span>
                  <code class="event-path-value">{{ currentDoc.httpApiData.apiPath }}</code>
                </div>
              </div>
              <div class="api-header-right">
                <span class="api-direction-badge server-to-client">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                  </svg>
                  客户端 → 服务端
                </span>
              </div>
            </div>

            <p class="api-desc">{{ currentDoc.httpApiData.description }}</p>

            <!-- 双栏主体 -->
            <div class="api-body">
              <!-- 左栏：参数定义 -->
              <div class="api-params-col">
                <!-- 请求参数区块 -->
                <div v-if="currentDoc.httpApiData.request" class="params-block">
                  <div class="params-block-header">
                    <span class="params-block-title">请求参数</span>
                    <span class="params-schema-name">{{ currentDoc.httpApiData.request.name }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="transformFieldsToTreeData(currentDoc.httpApiData.request.fields)"
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot">*</span>
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span class="type-pill" :class="'type-' + record.type">{{ record.type }}</span>
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes">必填</span>
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{ record.description }}</span>
                          <span v-if="record.enumValues" class="enum-values">
                            枚举值: {{ record.enumValues.join(' | ') }}
                          </span>
                        </template>
                      </template>
                    </Table>
                  </div>
                </div>

                <!-- 响应参数区块 -->
                <div v-if="currentDoc.httpApiData.response" class="params-block" style="margin-top: 24px;">
                  <div class="params-block-header">
                    <span class="params-block-title">响应参数</span>
                    <span class="params-schema-name">{{ currentDoc.httpApiData.response.name }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="transformFieldsToTreeData(currentDoc.httpApiData.response.fields)"
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot">*</span>
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span class="type-pill" :class="'type-' + record.type">{{ record.type }}</span>
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes">必填</span>
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{ record.description }}</span>
                          <span v-if="record.enumValues" class="enum-values">
                            枚举值: {{ record.enumValues.join(' | ') }}
                          </span>
                        </template>
                      </template>
                    </Table>
                  </div>
                </div>
              </div>

              <!-- 右栏：JSON 示例 -->
              <div class="api-examples-col">
                <div v-if="currentDoc.httpApiData.request" class="example-block">
                  <div class="example-header">
                    <span class="example-title">请求示例</span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button class="copy-btn" @click="copyCode(currentDoc.httpApiData.request.example)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre class="code-box"><code>{{ currentDoc.httpApiData.request.example }}</code></pre>
                  </div>
                </div>

                <div v-if="currentDoc.httpApiData.response" class="example-block">
                  <div class="example-header">
                    <span class="example-title">响应示例</span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button class="copy-btn" @click="copyCode(currentDoc.httpApiData.response ? currentDoc.httpApiData.response.example : currentDoc.httpApiData.example)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre class="code-box"><code>{{ currentDoc.httpApiData.response ? currentDoc.httpApiData.response.example : currentDoc.httpApiData.example }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Event API 文档 - Apifox 风格 -->
          <div v-else-if="currentDoc?.apiType === 'event' && currentDoc.eventData" class="api-doc">
            <!-- 顶部事件信息栏 -->
            <div class="api-header">
              <div class="api-header-left">
                <div class="api-title-row">
                  <span class="api-method-badge" :class="currentDoc.eventData.direction === 'client-to-server' ? 'method-up' : 'method-down'">
                    {{ currentDoc.eventData.direction === 'client-to-server' ? 'EMIT' : 'ON' }}
                  </span>
                  <h1 class="api-title">{{ currentDoc.title }}</h1>
                </div>
                <div class="api-event-path">
                  <span class="event-path-label">事件名称</span>
                  <code class="event-path-value">{{ currentDoc.eventData.eventName }}</code>
                  <span v-if="currentDoc.eventData.pairedEvent" class="event-paired-label">
                    配对响应: <code>{{ currentDoc.eventData.pairedEvent }}</code>
                  </span>
                </div>
              </div>
              <div class="api-header-right">
                <span class="api-direction-badge" :class="currentDoc.eventData.direction">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <template v-if="currentDoc.eventData.direction === 'client-to-server'">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </template>
                    <template v-else>
                      <line x1="19" y1="12" x2="5" y2="12"></line>
                      <polyline points="12 19 5 12 12 5"></polyline>
                    </template>
                  </svg>
                  {{ currentDoc.eventData.direction === 'client-to-server' ? '客户端 → 服务端' : '服务端 → 客户端' }}
                </span>
              </div>
            </div>

            <p class="api-desc">{{ currentDoc.eventData.description }}</p>

            <!-- 双栏主体 -->
            <div class="api-body">
              <!-- 左栏：参数定义 -->
              <div class="api-params-col">
                <!-- 请求参数区块 -->
                <div v-if="currentDoc.eventData.request" class="params-block">
                  <div class="params-block-header">
                    <span class="params-block-title">{{ currentDoc.eventData.direction === 'client-to-server' ? '请求参数' : '消息结构' }}</span>
                    <span class="params-schema-name">{{ currentDoc.eventData.request.name }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="transformFieldsToTreeData(currentDoc.eventData.request.fields)"
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot">*</span>
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span class="type-pill" :class="'type-' + record.type">{{ record.type }}</span>
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes">必填</span>
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{ record.description }}</span>
                          <span v-if="record.enumValues" class="enum-values">
                            枚举值: {{ record.enumValues.join(' | ') }}
                          </span>
                        </template>
                      </template>
                    </Table>
                  </div>
                </div>

                <!-- 响应参数区块 -->
                <div v-if="currentDoc.eventData.response" class="params-block" style="margin-top: 24px;">
                  <div class="params-block-header">
                    <span class="params-block-title">{{ currentDoc.eventData.direction === 'server-to-client' ? '请求参数' : '响应参数' }}</span>
                    <span class="params-schema-name">{{ currentDoc.eventData.response.name }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="transformFieldsToTreeData(currentDoc.eventData.response.fields)"
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot">*</span>
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span class="type-pill" :class="'type-' + record.type">{{ record.type }}</span>
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes">必填</span>
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{ record.description }}</span>
                          <span v-if="record.enumValues" class="enum-values">
                            枚举值: {{ record.enumValues.join(' | ') }}
                          </span>
                        </template>
                      </template>
                    </Table>
                  </div>
                </div>
              </div>

              <!-- 右栏：JSON 示例 -->
              <div class="api-examples-col">
                <div v-if="currentDoc.eventData.request" class="example-block">
                  <div class="example-header">
                    <span class="example-title">
                      {{ currentDoc.eventData.direction === 'client-to-server' ? '请求示例' : '消息示例' }}
                    </span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button class="copy-btn" @click="copyCode(currentDoc.eventData.request.example)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre class="code-box"><code>{{ currentDoc.eventData.request.example }}</code></pre>
                  </div>
                </div>

                <div v-if="currentDoc.eventData.response" class="example-block">
                  <div class="example-header">
                    <span class="example-title">
                      {{ currentDoc.eventData.direction === 'server-to-client' ? '请求示例' : '响应示例' }}
                    </span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button class="copy-btn" @click="copyCode(currentDoc.eventData.response.example)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre class="code-box"><code>{{ currentDoc.eventData.response.example }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- HTML 文档 -->
          <article v-else-if="state.content" class="doc-article">
            <div ref="contentRef" v-html="state.content" @click="handleContentClick" />
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

/* 现代化文档样式 */
.modern-doc {
  max-width: 1200px;
  margin: 0 auto;
}

/* ===== HTML 文档内容样式 ===== */
:deep(.page-doc) {
  max-width: 860px;
  margin: 0 auto;
  padding: 8px 0;
  color: var(--vben-text-color);
  line-height: 1.7;
}

:deep(.page-hero) {
  text-align: center;
  padding: 48px 24px 40px;
  margin-bottom: 40px;
  border-bottom: 1px solid var(--vben-border-color);
}

:deep(.page-hero-icon) {
  font-size: 56px;
  margin-bottom: 16px;
  line-height: 1;
}

:deep(.page-hero h1) {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--vben-text-color);
}

:deep(.page-hero p) {
  font-size: 15px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

:deep(.page-section) {
  margin-bottom: 40px;
}

:deep(.page-section h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--vben-text-color);
  padding-bottom: 10px;
  border-bottom: 2px solid var(--vben-border-color);
}

:deep(.page-section-desc) {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  margin-bottom: 16px;
}

:deep(.page-section code) {
  padding: 2px 6px;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #e83e8c;
}

/* 卡片网格 */
:deep(.page-cards) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 8px;
}

:deep(.page-card) {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
  background: var(--vben-background-color);
  transition: box-shadow 0.2s, border-color 0.2s;
}

:deep(.page-card:hover) {
  border-color: #1890ff;
  box-shadow: 0 2px 12px rgba(24, 144, 255, 0.1);
}

:deep(.page-card-icon) {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

:deep(.page-card-body h3) {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--vben-text-color);
}

:deep(.page-card-body p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  margin: 0;
  line-height: 1.5;
}

/* WebSocket 协议网格 - 现代动画卡片 */
:deep(.ws-protocol-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  padding: 0;
}

@keyframes cardSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glowPulse {
  0%, 100% {
    opacity: 0;
  }
  50% {
    opacity: 0.15;
  }
}

@keyframes cardPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.6;
  }
}

:deep(.ws-event-card) {
  position: relative;
  padding: 24px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  overflow: hidden;
  animation: cardSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: var(--delay);
}

:deep(.ws-event-card::before) {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,
    rgba(24, 144, 255, 0.05) 0%,
    rgba(82, 196, 26, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.4s;
}

:deep(.ws-event-card:hover) {
  transform: translateY(-8px) scale(1.02);
  border-color: rgba(24, 144, 255, 0.4);
  box-shadow:
    0 12px 24px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(24, 144, 255, 0.1);
}

:deep(.ws-event-card:hover::before) {
  opacity: 1;
}

:deep(.ws-card-glow) {
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, #1890ff, #52c41a);
  border-radius: 12px;
  opacity: 0;
  filter: blur(12px);
  transition: opacity 0.4s;
  z-index: -1;
  animation: glowPulse 3s ease-in-out infinite;
}

:deep(.ws-event-card:hover .ws-card-glow) {
  opacity: 0.2;
}

:deep(.ws-card-pulse) {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(24, 144, 255, 0.3);
  border-radius: 12px;
  opacity: 0;
  pointer-events: none;
}

:deep(.ws-event-card:hover .ws-card-pulse) {
  animation: cardPulse 2s ease-out infinite;
}

:deep(.ws-card-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}

:deep(.ws-direction-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

:deep(.ws-card-up .ws-direction-icon) {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.15), rgba(9, 109, 217, 0.1));
  color: #40a9ff;
  border: 1px solid rgba(24, 144, 255, 0.3);
}

:deep(.ws-card-down .ws-direction-icon) {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.15), rgba(56, 158, 13, 0.1));
  color: #73d13d;
  border: 1px solid rgba(82, 196, 26, 0.3);
}

:deep(.ws-event-card:hover .ws-direction-icon) {
  transform: scale(1.15) rotate(5deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.ws-direction-label) {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  transition: all 0.3s;
}

:deep(.ws-card-up .ws-direction-label) {
  color: #40a9ff;
}

:deep(.ws-card-down .ws-direction-label) {
  color: #73d13d;
}

:deep(.ws-event-name) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--vben-text-color);
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
  transition: all 0.3s;
}

:deep(.ws-event-card:hover .ws-event-name) {
  color: #1890ff;
  transform: translateX(4px);
}

:deep(.ws-event-desc) {
  font-size: 13px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
  position: relative;
  z-index: 1;
  transition: color 0.3s;
}

:deep(.ws-event-card:hover .ws-event-desc) {
  color: var(--vben-text-color);
}

@media (max-width: 768px) {
  :deep(.ws-protocol-grid) {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  :deep(.ws-event-card) {
    padding: 20px;
  }
}

/* 步骤列表 */
:deep(.steps-list) {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 48px;
}

:deep(.steps-list::before) {
  content: '';
  position: absolute;
  left: 16px;
  top: 20px;
  bottom: 20px;
  width: 2px;
  background: var(--vben-border-color);
}

:deep(.step-item) {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  position: relative;
}

:deep(.step-num) {
  position: absolute;
  left: -48px;
  width: 32px;
  height: 32px;
  background: #1890ff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  z-index: 1;
}

:deep(.step-body) {
  flex: 1;
  padding: 16px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

:deep(.step-body h4) {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--vben-text-color);
}

:deep(.step-body p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

:deep(.step-body code) {
  padding: 1px 5px;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #e83e8c;
}

/* 代码块 */
:deep(.code-block) {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #3e3e3e;
  margin-bottom: 16px;
}

:deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

:deep(.code-lang) {
  color: #888;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
}

:deep(.copy-btn) {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid #555;
  border-radius: 4px;
  color: #aaa;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

:deep(.copy-btn:hover) {
  background: #3e3e3e;
  color: #fff;
  border-color: #666;
}

:deep(.code-block pre) {
  margin: 0;
  padding: 16px;
  background: #1e1e1e;
  overflow-x: auto;
}

:deep(.code-block code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  background: transparent;
}

/* 运行选项 */
:deep(.run-options) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

:deep(.run-option h4) {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--vben-text-color);
}

/* 提示框 */
:deep(.alert) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

:deep(.alert-success) {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

:deep(.alert-info) {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
}

:deep(.alert-icon) {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1.4;
}

:deep(.alert strong) {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--vben-text-color);
}

:deep(.alert p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

/* 结果卡片 */
:deep(.result-cards) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

:deep(.result-card) {
  padding: 24px;
  border-radius: 8px;
  text-align: center;
}

:deep(.result-success) {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

:deep(.result-fail) {
  background: #fff1f0;
  border: 1px solid #ffa39e;
}

:deep(.result-icon) {
  font-size: 32px;
  margin-bottom: 12px;
}

:deep(.result-card h4) {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vben-text-color);
}

:deep(.result-card p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

:deep(.result-card code) {
  padding: 1px 5px;
  background: rgba(0,0,0,0.06);
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #e83e8c;
}

/* 安全提示 */
:deep(.tips-list) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:deep(.tip-item) {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
  background: var(--vben-background-color);
}

:deep(.tip-icon) {
  font-size: 22px;
  flex-shrink: 0;
  line-height: 1.3;
}

:deep(.tip-item h4) {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--vben-text-color);
}

:deep(.tip-item p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

:deep(.tip-item code) {
  padding: 1px 5px;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #e83e8c;
}

/* 鉴权结果网格 */
:deep(.auth-result-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 16px;
}

:deep(.auth-result-card) {
  position: relative;
  padding: 24px;
  border-radius: 12px;
  border: 2px solid;
  background: var(--vben-background-color);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}

:deep(.auth-result-card::before) {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.05;
  transition: opacity 0.3s;
}

:deep(.auth-result-card:hover) {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

:deep(.auth-result-card:hover::before) {
  opacity: 0.08;
}

:deep(.auth-success) {
  border-color: #52c41a;
}

:deep(.auth-success::before) {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
}

:deep(.auth-fail) {
  border-color: #ff4d4f;
}

:deep(.auth-fail::before) {
  background: linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%);
}

:deep(.auth-result-header) {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}

:deep(.auth-result-icon) {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.3s;
}

:deep(.auth-result-card:hover .auth-result-icon) {
  transform: scale(1.1) rotate(5deg);
}

:deep(.auth-success .auth-result-icon) {
  background: rgba(82, 196, 26, 0.15);
  color: #52c41a;
}

:deep(.auth-fail .auth-result-icon) {
  background: rgba(255, 77, 79, 0.15);
  color: #ff4d4f;
}

:deep(.auth-result-header h4) {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--vben-text-color);
}

:deep(.auth-result-body) {
  position: relative;
  z-index: 1;
}

:deep(.auth-result-body > p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  margin: 0 0 12px;
}

:deep(.auth-result-fields) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.auth-field) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--vben-background-color-deep);
  border-radius: 6px;
  border: 1px solid var(--vben-border-color);
}

:deep(.auth-field-key) {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--vben-text-color-secondary);
  font-weight: 500;
}

:deep(.auth-field-value) {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--vben-text-color);
  font-weight: 600;
}

:deep(.auth-value-true) {
  color: #52c41a;
}

:deep(.auth-value-false) {
  color: #ff4d4f;
}

/* 安全建议卡片 */
:deep(.security-cards) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

:deep(.security-card) {
  display: flex;
  gap: 14px;
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 10px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
}

:deep(.security-card::before) {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.03) 100%);
  opacity: 0;
  transition: opacity 0.3s;
}

:deep(.security-card:hover) {
  transform: translateY(-4px);
  border-color: rgba(24, 144, 255, 0.4);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

:deep(.security-card:hover::before) {
  opacity: 1;
}

:deep(.security-card-icon) {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.3s;
}

:deep(.security-card:hover .security-card-icon) {
  transform: scale(1.1) rotate(-5deg);
}

:deep(.security-card-body) {
  flex: 1;
  position: relative;
  z-index: 1;
}

:deep(.security-card-body h4) {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--vben-text-color);
}

:deep(.security-card-body p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  margin: 0;
  line-height: 1.6;
}

:deep(.security-card-body code) {
  padding: 1px 5px;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #e83e8c;
}

/* 响应式 - Event 文档 */
@media (max-width: 768px) {
  .event-doc {
    padding: 16px;
  }

  .event-header h1 {
    font-size: 24px;
  }

  .fields-table {
    font-size: 12px;
  }

  .fields-table th,
  .fields-table td {
    padding: 8px 12px;
  }
}

/* Hero Section */
.hero-section {
  text-align: center;
  padding: 60px 24px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 16px;
  margin-bottom: 48px;
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24px;
  margin-bottom: 24px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.hero-icon svg {
  color: white;
}

.hero-section h1 {
  font-size: 48px;
  font-weight: 800;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 18px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

/* Feature Grid */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 48px;
}

.feature-card {
  padding: 32px 24px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  border-color: #667eea;
}

.feature-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.feature-card h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--vben-text-color);
}

.feature-card p {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Protocol Section */
.protocol-section,
.steps-section,
.auth-flow-section,
.usage-section,
.result-section,
.security-section,
.requirements-section,
.install-section,
.config-section,
.run-section {
  margin-bottom: 48px;
}

.protocol-section h2,
.steps-section h2,
.auth-flow-section h2,
.usage-section h2,
.result-section h2,
.security-section h2,
.requirements-section h2,
.install-section h2,
.config-section h2,
.run-section h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--vben-text-color);
}

.section-desc {
  font-size: 16px;
  color: var(--vben-text-color-secondary);
  margin-bottom: 24px;
}

.protocol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.protocol-item {
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s;
}

.protocol-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.protocol-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  width: fit-content;
}

.protocol-badge.client {
  background: #e6f7ff;
  color: #1890ff;
}

.protocol-badge.server {
  background: #f6ffed;
  color: #52c41a;
}

.protocol-badge.bidirectional {
  background: #fff7e6;
  color: #fa8c16;
}

.protocol-item strong {
  font-size: 16px;
  color: var(--vben-text-color);
}

.protocol-item span:last-child {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
}

/* Timeline */
.timeline {
  position: relative;
  padding-left: 40px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
}

.timeline-item {
  position: relative;
  margin-bottom: 32px;
  display: flex;
  gap: 20px;
}

.timeline-marker {
  position: absolute;
  left: -40px;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.timeline-content {
  flex: 1;
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

.timeline-content h4 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--vben-text-color);
}

.timeline-content p {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

/* Requirements Grid */
.requirements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.requirement-card {
  padding: 24px;
  background: var(--vben-background-color);
  border: 2px solid var(--vben-border-color);
  border-radius: 12px;
  text-align: center;
  transition: all 0.3s;
}

.requirement-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
}

.requirement-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.requirement-icon svg {
  color: #667eea;
}

.requirement-card h4 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--vben-text-color);
}

.requirement-card p {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

/* Run Options */
.run-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.run-option h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--vben-text-color);
}

/* Success Banner */
.success-banner {
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, rgba(82, 196, 26, 0.05) 100%);
  border-left: 4px solid #52c41a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.success-banner svg {
  color: #52c41a;
  flex-shrink: 0;
}

.success-banner p {
  margin: 0;
  font-size: 15px;
  color: var(--vben-text-color);
}

/* Info Banner */
.info-banner {
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%);
  border-left: 4px solid #1890ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.info-banner svg {
  color: #1890ff;
  flex-shrink: 0;
}

.info-banner p {
  margin: 0;
  font-size: 15px;
  color: var(--vben-text-color);
}

/* Result Cards */
.result-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.result-card {
  padding: 32px 24px;
  border-radius: 12px;
  text-align: center;
}

.result-card.success {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, rgba(82, 196, 26, 0.05) 100%);
  border: 2px solid #52c41a;
}

.result-card.failure {
  background: linear-gradient(135deg, rgba(245, 34, 45, 0.1) 0%, rgba(245, 34, 45, 0.05) 100%);
  border: 2px solid #f5222d;
}

.result-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-card.success .result-icon {
  background: rgba(82, 196, 26, 0.2);
}

.result-card.success .result-icon svg {
  color: #52c41a;
}

.result-card.failure .result-icon {
  background: rgba(245, 34, 45, 0.2);
}

.result-card.failure .result-icon svg {
  color: #f5222d;
}

.result-card h4 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--vben-text-color);
}

.result-card p {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

/* Security Tips */
.security-tips {
  display: grid;
  gap: 16px;
}

.security-tip {
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.tip-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tip-icon.warning {
  background: rgba(250, 140, 22, 0.1);
}

.tip-icon.warning svg {
  color: #fa8c16;
}

.tip-icon.info {
  background: rgba(24, 144, 255, 0.1);
}

.tip-icon.info svg {
  color: #1890ff;
}

.tip-icon.success {
  background: rgba(82, 196, 26, 0.1);
}

.tip-icon.success svg {
  color: #52c41a;
}

.security-tip h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--vben-text-color);
}

.security-tip p {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  margin: 0;
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

/* HTML 文档内容样式 */
.doc-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  line-height: 1.8;
  color: var(--vben-text-color);
}

.doc-content h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--vben-border-color);
  color: var(--vben-text-color);
}

.doc-content h2 {
  font-size: 24px;
  font-weight: 600;
  margin-top: 40px;
  margin-bottom: 16px;
  color: var(--vben-text-color);
}

.doc-content h3 {
  font-size: 20px;
  font-weight: 600;
  margin-top: 32px;
  margin-bottom: 12px;
  color: var(--vben-text-color);
}

.doc-content p {
  margin-bottom: 16px;
  color: var(--vben-text-color);
}

.doc-content code {
  padding: 2px 6px;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: #e83e8c;
}

.doc-content .doc-section {
  margin-bottom: 40px;
}

.doc-content .feature-list,
.doc-content .protocol-list,
.doc-content .steps-list {
  margin: 16px 0;
  padding-left: 24px;
}

.doc-content .feature-list li,
.doc-content .protocol-list li {
  margin-bottom: 12px;
  line-height: 1.8;
}

.doc-content .steps-list li {
  margin-bottom: 8px;
  line-height: 1.8;
}

.doc-content .code-block {
  margin: 20px 0;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.doc-content .code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

.doc-content .code-lang {
  color: #d4d4d4;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Consolas', 'Monaco', monospace;
}

.doc-content .copy-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #3e3e3e;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.doc-content .copy-btn:hover {
  background: #3e3e3e;
  border-color: #4e4e4e;
}

.doc-content .code-block pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  background: #1e1e1e;
}

.doc-content .code-block code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  background: transparent;
  padding: 0;
}

/* ========== Apifox 风格 API 文档样式 ========== */

.api-doc {
  padding: 0;
  background: #0a0a0a;
  min-height: 100%;
}

.api-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 32px;
  background: linear-gradient(135deg, #141414 0%, #1a1a1a 100%);
  border-bottom: 1px solid #262626;
}

.api-header-left {
  flex: 1;
}

.api-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.api-method-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'Consolas', 'Monaco', monospace;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.api-method-badge.method-up {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
}

.api-method-badge.method-down {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(82, 196, 26, 0.3);
}

.api-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: #fff;
  letter-spacing: -0.3px;
}

.api-event-path {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.event-path-label {
  font-size: 13px;
  color: #8c8c8c;
}

.event-path-value {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: #52c41a;
  background: rgba(82, 196, 26, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(82, 196, 26, 0.2);
}

.event-paired-label {
  font-size: 13px;
  color: #8c8c8c;
  margin-left: 12px;
}

.event-paired-label code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #faad14;
  background: rgba(250, 173, 20, 0.1);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(250, 173, 20, 0.2);
  margin-left: 4px;
}

.api-header-right {
  display: flex;
  align-items: center;
}

.api-direction-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  white-space: nowrap;
}

.api-direction-badge.client-to-server {
  background: rgba(24, 144, 255, 0.12);
  color: #1890ff;
  border: 1px solid rgba(24, 144, 255, 0.3);
}

.api-direction-badge.server-to-client {
  background: rgba(82, 196, 26, 0.12);
  color: #52c41a;
  border: 1px solid rgba(82, 196, 26, 0.3);
}

.api-desc {
  padding: 16px 32px;
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #a0a0a0;
  background: #0f0f0f;
  border-bottom: 1px solid #262626;
}

.api-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: calc(100vh - 280px);
}

.api-params-col {
  padding: 24px 32px;
  background: #0a0a0a;
  border-right: 1px solid #262626;
  overflow-y: auto;
}

.api-examples-col {
  padding: 24px 32px;
  background: #000;
  overflow-y: auto;
}

.params-block {
  margin-bottom: 32px;
}

.params-block:last-child {
  margin-bottom: 0;
}

.params-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #1890ff;
}

.params-block-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.params-schema-name {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #1890ff;
  background: rgba(24, 144, 255, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(24, 144, 255, 0.25);
}

.params-table-wrap {
  background: #141414;
  border: 1px solid #262626;
  border-radius: 6px;
  overflow: visible;
}

.params-table {
  width: 100%;
  border-collapse: collapse;
}

.params-table thead {
  background: #1a1a1a;
}

.params-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #262626;
}

.params-table th.col-name {
  width: 25%;
}

.params-table th.col-type {
  width: 15%;
}

.params-table th.col-required {
  width: 12%;
}

.params-table th.col-desc {
  width: 48%;
}

.param-row {
  border-bottom: 1px solid #1a1a1a;
  transition: background 0.15s;
}

.param-row:hover {
  background: #161616;
}

.param-row:last-child {
  border-bottom: none;
}

/* 嵌套行样式 */
.nested-row {
  background: #0d0d0d;
  border-left: 3px solid #1890ff;
}

.nested-row:hover {
  background: #121212;
}

.nested-param {
  padding-left: 24px;
  position: relative;
}

.nested-param::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 50%;
  width: 6px;
  height: 1px;
  background: #434343;
}

.params-table td {
  padding: 12px 14px;
  font-size: 13px;
  vertical-align: top;
}

.param-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.required-dot {
  color: #ff4d4f;
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
}

.param-name {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #d4d4d4;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
}

.nested-indicator {
  display: inline-flex;
  align-items: center;
  color: #8c8c8c;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.type-pill.type-string {
  background: rgba(24, 144, 255, 0.15);
  color: #40a9ff;
  border: 1px solid rgba(24, 144, 255, 0.3);
}

.type-pill.type-number,
.type-pill.type-int,
.type-pill.type-int64 {
  background: rgba(82, 196, 26, 0.15);
  color: #73d13d;
  border: 1px solid rgba(82, 196, 26, 0.3);
}

.type-pill.type-boolean,
.type-pill.type-bool {
  background: rgba(250, 173, 20, 0.15);
  color: #ffc53d;
  border: 1px solid rgba(250, 173, 20, 0.3);
}

.type-pill.type-object {
  background: rgba(114, 46, 209, 0.15);
  color: #b37feb;
  border: 1px solid rgba(114, 46, 209, 0.3);
}

.type-pill.type-array {
  background: rgba(255, 77, 79, 0.15);
  color: #ff7875;
  border: 1px solid rgba(255, 77, 79, 0.3);
}

.req-yes {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: rgba(255, 77, 79, 0.12);
  color: #ff4d4f;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.req-no {
  color: #595959;
  font-size: 12px;
}

.param-desc {
  color: #d4d4d4;
  line-height: 1.6;
}

.enum-values {
  display: block;
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(250, 173, 20, 0.08);
  border-left: 2px solid #faad14;
  font-size: 12px;
  color: #faad14;
  font-family: 'Consolas', 'Monaco', monospace;
  border-radius: 3px;
}

.nested-schema {
  margin-top: 12px;
  padding: 12px;
  background: #0a0a0a;
  border: 1px solid #262626;
  border-radius: 4px;
}

.nested-schema-title {
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nested-table {
  width: 100%;
  border-collapse: collapse;
}

.nested-table tr {
  border-bottom: 1px solid #1a1a1a;
}

.nested-table tr:last-child {
  border-bottom: none;
}

.nested-table td {
  padding: 8px 10px;
  font-size: 12px;
  vertical-align: top;
}

.nested-desc {
  color: #a0a0a0;
}

.example-block {
  margin-bottom: 24px;
}

.example-block:last-child {
  margin-bottom: 0;
}

.example-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 2px solid #52c41a;
}

.example-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.example-lang {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  color: #52c41a;
  background: rgba(82, 196, 26, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(82, 196, 26, 0.25);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-box {
  position: relative;
  background: #0a0a0a;
  border: 1px solid #262626;
  border-radius: 6px;
  overflow: hidden;
}

.code-box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #141414;
  border-bottom: 1px solid #262626;
}

.code-box-title {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 500;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #262626;
  border-radius: 4px;
  color: #8c8c8c;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.copy-btn:hover {
  background: #1a1a1a;
  border-color: #404040;
  color: #fff;
}

.copy-btn svg {
  width: 12px;
  height: 12px;
}

.code-box pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  background: #0a0a0a;
}

.code-box code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #d4d4d4;
}

@media (max-width: 1200px) {
  .api-body {
    grid-template-columns: 1fr;
  }

  .api-params-col {
    border-right: none;
    border-bottom: 1px solid #262626;
  }
}

@media (max-width: 768px) {
  .api-header {
    flex-direction: column;
    gap: 16px;
    padding: 16px 20px;
  }

  .api-title {
    font-size: 20px;
  }

  .api-desc {
    padding: 12px 20px;
  }

  .api-params-col,
  .api-examples-col {
    padding: 16px 20px;
  }

  .params-table th,
  .params-table td {
    padding: 8px 10px;
    font-size: 12px;
  }
}

/* Ant Design Vue Table 树形表格样式覆盖 */
:deep(.params-tree-table) {
  background: transparent;
}

:deep(.params-tree-table .ant-table) {
  background: transparent;
  color: var(--vben-text-color);
}

:deep(.params-tree-table .ant-table-thead > tr > th) {
  background: #1a1a1a;
  color: #8c8c8c;
  border-bottom: 1px solid #262626;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.params-tree-table .ant-table-tbody > tr > td) {
  background: transparent;
  border-bottom: 1px solid #1a1a1a;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--vben-text-color);
}

:deep(.params-tree-table .ant-table-tbody > tr:hover > td) {
  background: #161616 !important;
}

:deep(.params-tree-table .ant-table-row-expand-icon) {
  color: #8c8c8c;
  border: 1px solid #434343;
  background: transparent;
}

:deep(.params-tree-table .ant-table-row-expand-icon:hover) {
  color: #1890ff;
  border-color: #1890ff;
}

:deep(.params-tree-table .ant-table-row-expand-icon::before),
:deep(.params-tree-table .ant-table-row-expand-icon::after) {
  background: currentColor;
}

:deep(.params-tree-table .ant-table-tbody > tr.ant-table-row-level-1 > td) {
  background: #0d0d0d;
}

:deep(.params-tree-table .ant-table-tbody > tr.ant-table-row-level-1:hover > td) {
  background: #121212 !important;
}

:deep(.params-tree-table .ant-table-tbody > tr.ant-table-row-level-1 > td:first-child) {
  border-left: 3px solid #1890ff;
}

/* ===== DeployAgent 概述页面样式 ===== */
:deep(.deploy-agent-overview) {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

:deep(.overview-header) {
  text-align: center;
  padding: 40px 20px 32px;
  margin-bottom: 32px;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.05) 0%, rgba(82, 196, 26, 0.05) 100%);
  border-radius: 16px;
}

:deep(.overview-header h1) {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 16px;
  background: linear-gradient(135deg, #1890ff 0%, #52c41a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

:deep(.overview-desc) {
  font-size: 16px;
  color: var(--vben-text-color-secondary);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

/* 特性网格 */
:deep(.features-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 48px;
}

:deep(.feature-item) {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

:deep(.feature-item:hover) {
  transform: translateY(-8px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
  border-color: transparent;
}

:deep(.feature-icon) {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 16px;
}

:deep(.feature-content h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vben-text-color);
}

:deep(.feature-content p) {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  line-height: 1.5;
  margin: 0;
}

/* 快速开始 */
:deep(.quick-start) {
  margin-bottom: 48px;
}

:deep(.quick-start h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 24px;
  color: var(--vben-text-color);
}

:deep(.start-steps) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.start-step) {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s ease;
}

:deep(.start-step:hover) {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);
}

:deep(.step-number) {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1890ff 0%, #52c41a 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

:deep(.step-text h4) {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vben-text-color);
}

:deep(.step-text p) {
  font-size: 14px;
  color: var(--vben-text-color-secondary);
  line-height: 1.5;
  margin: 0;
}

/* 通信协议 */
:deep(.protocol-section) {
  margin-bottom: 48px;
}

:deep(.protocol-section h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 20px;
  color: var(--vben-text-color);
}

:deep(.protocol-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

:deep(.protocol-item) {
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 10px;
  text-align: center;
  transition: all 0.3s ease;
}

:deep(.protocol-item:hover) {
  border-color: #1890ff;
  transform: scale(1.05);
}

:deep(.protocol-label) {
  font-size: 12px;
  color: var(--vben-text-color-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.protocol-value) {
  font-size: 16px;
  font-weight: 600;
  color: var(--vben-text-color);
}

/* 接入信息 */
:deep(.access-info) {
  margin-bottom: 48px;
}

:deep(.access-info h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 20px;
  color: var(--vben-text-color);
}

:deep(.access-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

:deep(.access-card) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s ease;
}

:deep(.access-card:hover) {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);
}

:deep(.access-icon) {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(24, 144, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

:deep(.access-content h4) {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vben-text-color);
}

:deep(.access-content code) {
  display: block;
  font-size: 13px;
  color: #1890ff;
  background: rgba(24, 144, 255, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
}

:deep(.access-content p) {
  font-size: 12px;
  color: var(--vben-text-color-secondary);
  margin: 0;
}

/* 部署方式 */
:deep(.deploy-types) {
  margin-bottom: 32px;
}

:deep(.deploy-types h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 20px;
  color: var(--vben-text-color);
}

:deep(.deploy-type-list) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

:deep(.deploy-type) {
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 10px;
  text-align: center;
  transition: all 0.3s ease;
}

:deep(.deploy-type:hover) {
  border-color: #52c41a;
  transform: translateY(-4px);
}

:deep(.deploy-type-icon) {
  font-size: 32px;
  margin-bottom: 12px;
}

:deep(.deploy-type h4) {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vben-text-color);
}

:deep(.deploy-type p) {
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  line-height: 1.5;
  margin: 0;
}
</style>
