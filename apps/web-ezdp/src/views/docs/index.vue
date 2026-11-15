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
      const platformDomain =
        systemConfig.value.platformDomain || 'https://simple.plaso.cn';
      const apiPrefix = systemConfig.value.apiPrefix || '/server/ezdp';
      const fullApiUrl = `${platformDomain}${apiPrefix}`;

      // 替换域名占位符
      htmlContent = htmlContent.replace(
        /https:\/\/simple\.plaso\.cn/g,
        platformDomain,
      );
      htmlContent = htmlContent.replace(/\/server\/ezdp/g, apiPrefix);
      htmlContent = htmlContent.replace(
        /https:\/\/simple\.plaso\.cn\/server\/ezdp/g,
        fullApiUrl,
      );
    }

    // 如果是 ServerAgent 文档，使用系统配置替换连接地址
    if (
      (docId === 'serverAgent-overview' ||
        docId === 'serverAgent-authentication') &&
      systemConfig.value
    ) {
      const serverAgentAddr =
        systemConfig.value.serverAgentAddr || 'your-ezdp-server.com:82';
      htmlContent = htmlContent.replace(
        /your-ezdp-server\.com:82/g,
        serverAgentAddr,
      );
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
    if (!item.isCategory && (item.fileName || item.apiType === 'event'))
      return item;
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
  const card = (e.target as HTMLElement).closest(
    '[data-event-id]',
  ) as HTMLElement | null;
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
  <Page
    :title="$t('page.docs.title')"
    :description="$t('page.docs.description')"
  >
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
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
              <span
                :class="[
                  'tree-node',
                  isCategory ? 'tree-category' : 'tree-leaf',
                ]"
              >
                <span v-if="isCategory" class="tree-icon category-icon">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                    />
                  </svg>
                </span>
                <span v-else class="tree-icon leaf-icon">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    ></path>
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
          <div
            v-else-if="!currentDoc && !state.loading"
            class="doc-empty-state"
          >
            <div class="welcome-box">
              <div class="welcome-icon">📚</div>
              <h2>Agent 接入文档中心</h2>
              <p>从左侧选择文档开始阅读</p>
            </div>
          </div>
          <!-- HTTP API 文档 - Apifox 风格 -->
          <div
            v-else-if="
              currentDoc?.apiType === 'httpApi' && currentDoc.httpApiData
            "
            class="api-doc"
          >
            <!-- 顶部 API 信息栏 -->
            <div class="api-header">
              <div class="api-header-left">
                <div class="api-title-row">
                  <span class="api-method-badge method-up">POST</span>
                  <h1 class="api-title">
                    {{ currentDoc.httpApiData.apiName }}
                  </h1>
                </div>
                <div class="api-event-path">
                  <span class="event-path-label">接口路径</span>
                  <code class="event-path-value">{{
                    currentDoc.httpApiData.apiPath
                  }}</code>
                </div>
              </div>
              <div class="api-header-right">
                <span class="api-direction-badge server-to-client">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
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
                    <span class="params-schema-name">{{
                      currentDoc.httpApiData.request.name
                    }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="
                        transformFieldsToTreeData(
                          currentDoc.httpApiData.request.fields,
                        )
                      "
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot"
                              >*</span
                            >
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span
                            class="type-pill"
                            :class="'type-' + record.type"
                            >{{ record.type }}</span
                          >
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes"
                            >必填</span
                          >
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{
                            record.description
                          }}</span>
                          <span v-if="record.enumValues" class="enum-values">
                            枚举值: {{ record.enumValues.join(' | ') }}
                          </span>
                        </template>
                      </template>
                    </Table>
                  </div>
                </div>

                <!-- 响应参数区块 -->
                <div
                  v-if="currentDoc.httpApiData.response"
                  class="params-block"
                  style="margin-top: 24px"
                >
                  <div class="params-block-header">
                    <span class="params-block-title">响应参数</span>
                    <span class="params-schema-name">{{
                      currentDoc.httpApiData.response.name
                    }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="
                        transformFieldsToTreeData(
                          currentDoc.httpApiData.response.fields,
                        )
                      "
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot"
                              >*</span
                            >
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span
                            class="type-pill"
                            :class="'type-' + record.type"
                            >{{ record.type }}</span
                          >
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes"
                            >必填</span
                          >
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{
                            record.description
                          }}</span>
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
                <div
                  v-if="currentDoc.httpApiData.request"
                  class="example-block"
                >
                  <div class="example-header">
                    <span class="example-title">请求示例</span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button
                        class="copy-btn"
                        @click="
                          copyCode(currentDoc.httpApiData.request.example)
                        "
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path
                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                          ></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre
                      class="code-box"
                    ><code>{{ currentDoc.httpApiData.request.example }}</code></pre>
                  </div>
                </div>

                <div
                  v-if="currentDoc.httpApiData.response"
                  class="example-block"
                >
                  <div class="example-header">
                    <span class="example-title">响应示例</span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button
                        class="copy-btn"
                        @click="
                          copyCode(
                            currentDoc.httpApiData.response
                              ? currentDoc.httpApiData.response.example
                              : currentDoc.httpApiData.example,
                          )
                        "
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path
                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                          ></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre
                      class="code-box"
                    ><code>{{ currentDoc.httpApiData.response ? currentDoc.httpApiData.response.example : currentDoc.httpApiData.example }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Event API 文档 - Apifox 风格 -->
          <div
            v-else-if="currentDoc?.apiType === 'event' && currentDoc.eventData"
            class="api-doc"
          >
            <!-- 顶部事件信息栏 -->
            <div class="api-header">
              <div class="api-header-left">
                <div class="api-title-row">
                  <span
                    class="api-method-badge"
                    :class="
                      currentDoc.eventData.direction === 'client-to-server'
                        ? 'method-up'
                        : 'method-down'
                    "
                  >
                    {{
                      currentDoc.eventData.direction === 'client-to-server'
                        ? 'EMIT'
                        : 'ON'
                    }}
                  </span>
                  <h1 class="api-title">{{ currentDoc.title }}</h1>
                </div>
                <div class="api-event-path">
                  <span class="event-path-label">事件名称</span>
                  <code class="event-path-value">{{
                    currentDoc.eventData.eventName
                  }}</code>
                  <span
                    v-if="currentDoc.eventData.pairedEvent"
                    class="event-paired-label"
                  >
                    配对响应:
                    <code>{{ currentDoc.eventData.pairedEvent }}</code>
                  </span>
                </div>
              </div>
              <div class="api-header-right">
                <span
                  class="api-direction-badge"
                  :class="currentDoc.eventData.direction"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <template
                      v-if="
                        currentDoc.eventData.direction === 'client-to-server'
                      "
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </template>
                    <template v-else>
                      <line x1="19" y1="12" x2="5" y2="12"></line>
                      <polyline points="12 19 5 12 12 5"></polyline>
                    </template>
                  </svg>
                  {{
                    currentDoc.eventData.direction === 'client-to-server'
                      ? '客户端 → 服务端'
                      : '服务端 → 客户端'
                  }}
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
                    <span class="params-block-title">{{
                      currentDoc.eventData.direction === 'client-to-server'
                        ? '请求参数'
                        : '消息结构'
                    }}</span>
                    <span class="params-schema-name">{{
                      currentDoc.eventData.request.name
                    }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="
                        transformFieldsToTreeData(
                          currentDoc.eventData.request.fields,
                        )
                      "
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot"
                              >*</span
                            >
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span
                            class="type-pill"
                            :class="'type-' + record.type"
                            >{{ record.type }}</span
                          >
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes"
                            >必填</span
                          >
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{
                            record.description
                          }}</span>
                          <span v-if="record.enumValues" class="enum-values">
                            枚举值: {{ record.enumValues.join(' | ') }}
                          </span>
                        </template>
                      </template>
                    </Table>
                  </div>
                </div>

                <!-- 响应参数区块 -->
                <div
                  v-if="currentDoc.eventData.response"
                  class="params-block"
                  style="margin-top: 24px"
                >
                  <div class="params-block-header">
                    <span class="params-block-title">{{
                      currentDoc.eventData.direction === 'server-to-client'
                        ? '请求参数'
                        : '响应参数'
                    }}</span>
                    <span class="params-schema-name">{{
                      currentDoc.eventData.response.name
                    }}</span>
                  </div>
                  <div class="params-table-wrap">
                    <Table
                      :columns="paramColumns"
                      :data-source="
                        transformFieldsToTreeData(
                          currentDoc.eventData.response.fields,
                        )
                      "
                      :pagination="false"
                      :default-expand-all-rows="false"
                      size="small"
                      class="params-tree-table"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                          <div class="param-name-cell">
                            <span v-if="record.required" class="required-dot"
                              >*</span
                            >
                            <code class="param-name">{{ record.name }}</code>
                          </div>
                        </template>
                        <template v-else-if="column.key === 'type'">
                          <span
                            class="type-pill"
                            :class="'type-' + record.type"
                            >{{ record.type }}</span
                          >
                        </template>
                        <template v-else-if="column.key === 'required'">
                          <span v-if="record.required" class="req-yes"
                            >必填</span
                          >
                          <span v-else class="req-no">可选</span>
                        </template>
                        <template v-else-if="column.key === 'description'">
                          <span class="param-desc">{{
                            record.description
                          }}</span>
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
                      {{
                        currentDoc.eventData.direction === 'client-to-server'
                          ? '请求示例'
                          : '消息示例'
                      }}
                    </span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button
                        class="copy-btn"
                        @click="copyCode(currentDoc.eventData.request.example)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path
                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                          ></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre
                      class="code-box"
                    ><code>{{ currentDoc.eventData.request.example }}</code></pre>
                  </div>
                </div>

                <div v-if="currentDoc.eventData.response" class="example-block">
                  <div class="example-header">
                    <span class="example-title">
                      {{
                        currentDoc.eventData.direction === 'server-to-client'
                          ? '请求示例'
                          : '响应示例'
                      }}
                    </span>
                    <span class="example-lang">JSON</span>
                  </div>
                  <div class="code-box">
                    <div class="code-box-header">
                      <span class="code-box-title">application/json</span>
                      <button
                        class="copy-btn"
                        @click="copyCode(currentDoc.eventData.response.example)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path
                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                          ></path>
                        </svg>
                        复制
                      </button>
                    </div>
                    <pre
                      class="code-box"
                    ><code>{{ currentDoc.eventData.response.example }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- HTML 文档 -->
          <article v-else-if="state.content" class="doc-article">
            <div
              ref="contentRef"
              v-html="state.content"
              @click="handleContentClick"
            />
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
            :class="[
              'toc-item',
              `toc-h${item.level}`,
              { active: activeHeading === item.id },
            ]"
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
@keyframes card-slide-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0;
  }

  50% {
    opacity: 0.15;
  }
}

@keyframes card-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }

  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
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

.doc-layout {
  display: flex;
  gap: 24px;
  height: calc(100vh - 180px);
  min-height: 600px;
}

/* 左侧导航 */
.doc-sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 280px;
  overflow: hidden;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
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
  padding: 8px;
  overflow-y: auto;
}

.tree-node {
  display: flex;
  gap: 8px;
  align-items: center;
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
  color: var(--vben-primary-color);
  background: var(--vben-primary-color-light);
}

:deep(.ant-tree-node-selected) .tree-icon {
  opacity: 1;
}

/* 中间内容区 */
.doc-main {
  flex: 1;
  min-width: 0;
  padding: 32px;
  overflow-y: auto;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
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
  margin-bottom: 16px;
  font-size: 64px;
}

.welcome-box h2 {
  margin-bottom: 8px;
  font-size: 24px;
  font-weight: 600;
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
  padding: 8px 0;
  margin: 0 auto;
  line-height: 1.7;
  color: var(--vben-text-color);
}

:deep(.page-hero) {
  padding: 48px 24px 40px;
  margin-bottom: 40px;
  text-align: center;
  border-bottom: 1px solid var(--vben-border-color);
}

:deep(.page-hero-icon) {
  margin-bottom: 16px;
  font-size: 56px;
  line-height: 1;
}

:deep(.page-hero h1) {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 700;
  color: var(--vben-text-color);
}

:deep(.page-hero p) {
  margin: 0;
  font-size: 15px;
  color: var(--vben-text-color-secondary);
}

:deep(.page-section) {
  margin-bottom: 40px;
}

:deep(.page-section h2) {
  padding-bottom: 10px;
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: var(--vben-text-color);
  border-bottom: 2px solid var(--vben-border-color);
}

:deep(.page-section-desc) {
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--vben-text-color-secondary);
}

:deep(.page-section code) {
  padding: 2px 6px;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  color: #e83e8c;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
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
  gap: 14px;
  align-items: flex-start;
  padding: 18px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}

:deep(.page-card:hover) {
  border-color: #1890ff;
  box-shadow: 0 2px 12px rgb(24 144 255 / 10%);
}

:deep(.page-card-icon) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 20px;
  border-radius: 8px;
}

:deep(.page-card-body h3) {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.page-card-body p) {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vben-text-color-secondary);
}

/* WebSocket 协议网格 - 现代动画卡片 */
:deep(.ws-protocol-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  padding: 0;
}

:deep(.ws-event-card) {
  position: relative;
  padding: 24px;
  overflow: hidden;
  cursor: pointer;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: card-slide-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: var(--delay);
}

:deep(.ws-event-card::before) {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(
    135deg,
    rgb(24 144 255 / 5%) 0%,
    rgb(82 196 26 / 5%) 100%
  );
  opacity: 0;
  transition: opacity 0.4s;
}

:deep(.ws-event-card:hover) {
  border-color: rgb(24 144 255 / 40%);
  box-shadow:
    0 12px 24px rgb(0 0 0 / 12%),
    0 0 0 1px rgb(24 144 255 / 10%);
  transform: translateY(-8px) scale(1.02);
}

:deep(.ws-event-card:hover::before) {
  opacity: 1;
}

:deep(.ws-card-glow) {
  position: absolute;
  inset: -2px;
  z-index: -1;
  background: linear-gradient(135deg, #1890ff, #52c41a);
  border-radius: 12px;
  opacity: 0;
  filter: blur(12px);
  transition: opacity 0.4s;
  animation: glow-pulse 3s ease-in-out infinite;
}

:deep(.ws-event-card:hover .ws-card-glow) {
  opacity: 0.2;
}

:deep(.ws-card-pulse) {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 2px solid rgb(24 144 255 / 30%);
  border-radius: 12px;
  opacity: 0;
}

:deep(.ws-event-card:hover .ws-card-pulse) {
  animation: card-pulse 2s ease-out infinite;
}

:deep(.ws-card-header) {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
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
  color: #40a9ff;
  background: linear-gradient(
    135deg,
    rgb(24 144 255 / 15%),
    rgb(9 109 217 / 10%)
  );
  border: 1px solid rgb(24 144 255 / 30%);
}

:deep(.ws-card-down .ws-direction-icon) {
  color: #73d13d;
  background: linear-gradient(
    135deg,
    rgb(82 196 26 / 15%),
    rgb(56 158 13 / 10%)
  );
  border: 1px solid rgb(82 196 26 / 30%);
}

:deep(.ws-event-card:hover .ws-direction-icon) {
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
  transform: scale(1.15) rotate(5deg);
}

:deep(.ws-direction-label) {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  transition: all 0.3s;
}

:deep(.ws-card-up .ws-direction-label) {
  color: #40a9ff;
}

:deep(.ws-card-down .ws-direction-label) {
  color: #73d13d;
}

:deep(.ws-event-name) {
  position: relative;
  z-index: 1;
  margin-bottom: 8px;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--vben-text-color);
  transition: all 0.3s;
}

:deep(.ws-event-card:hover .ws-event-name) {
  color: #1890ff;
  transform: translateX(4px);
}

:deep(.ws-event-desc) {
  position: relative;
  z-index: 1;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
  transition: color 0.3s;
}

:deep(.ws-event-card:hover .ws-event-desc) {
  color: var(--vben-text-color);
}

/* 步骤列表 */
:deep(.steps-list) {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 48px;
}

:deep(.steps-list::before) {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 16px;
  width: 2px;
  content: '';
  background: var(--vben-border-color);
}

:deep(.step-item) {
  position: relative;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 24px;
}

:deep(.step-num) {
  position: absolute;
  left: -48px;
  z-index: 1;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 14px;
  font-weight: 700;
  color: white;
  background: #1890ff;
  border-radius: 50%;
}

:deep(.step-body) {
  flex: 1;
  padding: 16px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

:deep(.step-body h4) {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.step-body p) {
  margin: 0;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
}

:deep(.step-body code) {
  padding: 1px 5px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #e83e8c;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
}

/* 代码块 */
:deep(.code-block) {
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid #3e3e3e;
  border-radius: 8px;
}

:deep(.code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

:deep(.code-lang) {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #888;
}

:deep(.copy-btn) {
  padding: 3px 10px;
  font-size: 12px;
  color: #aaa;
  cursor: pointer;
  background: transparent;
  border: 1px solid #555;
  border-radius: 4px;
  transition: all 0.2s;
}

:deep(.copy-btn:hover) {
  color: #fff;
  background: #3e3e3e;
  border-color: #666;
}

:deep(.code-block pre) {
  padding: 16px;
  margin: 0;
  overflow-x: auto;
  background: #1e1e1e;
}

:deep(.code-block code) {
  font-family: Consolas, Monaco, 'Courier New', monospace;
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
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
}

/* 提示框 */
:deep(.alert) {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
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
  flex-shrink: 0;
  font-size: 20px;
  line-height: 1.4;
}

:deep(.alert strong) {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.alert p) {
  margin: 0;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
}

/* 结果卡片 */
:deep(.result-cards) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

:deep(.result-card) {
  padding: 24px;
  text-align: center;
  border-radius: 8px;
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
  margin-bottom: 12px;
  font-size: 32px;
}

:deep(.result-card h4) {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.result-card p) {
  margin: 0;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
}

:deep(.result-card code) {
  padding: 1px 5px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #e83e8c;
  background: rgb(0 0 0 / 6%);
  border-radius: 3px;
}

/* 安全提示 */
:deep(.tips-list) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:deep(.tip-item) {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 16px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

:deep(.tip-icon) {
  flex-shrink: 0;
  font-size: 22px;
  line-height: 1.3;
}

:deep(.tip-item h4) {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.tip-item p) {
  margin: 0;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
}

:deep(.tip-item code) {
  padding: 1px 5px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #e83e8c;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
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
  overflow: hidden;
  background: var(--vben-background-color);
  border: 2px solid;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

:deep(.auth-result-card::before) {
  position: absolute;
  inset: 0;
  content: '';
  opacity: 0.05;
  transition: opacity 0.3s;
}

:deep(.auth-result-card:hover) {
  box-shadow: 0 12px 24px rgb(0 0 0 / 15%);
  transform: translateY(-4px);
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
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

:deep(.auth-result-icon) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transition: transform 0.3s;
}

:deep(.auth-result-card:hover .auth-result-icon) {
  transform: scale(1.1) rotate(5deg);
}

:deep(.auth-success .auth-result-icon) {
  color: #52c41a;
  background: rgb(82 196 26 / 15%);
}

:deep(.auth-fail .auth-result-icon) {
  color: #ff4d4f;
  background: rgb(255 77 79 / 15%);
}

:deep(.auth-result-header h4) {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.auth-result-body) {
  position: relative;
  z-index: 1;
}

:deep(.auth-result-body > p) {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
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
  border: 1px solid var(--vben-border-color);
  border-radius: 6px;
}

:deep(.auth-field-key) {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--vben-text-color-secondary);
}

:deep(.auth-field-value) {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--vben-text-color);
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
  position: relative;
  display: flex;
  gap: 14px;
  padding: 20px;
  overflow: hidden;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 10px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

:deep(.security-card::before) {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(
    135deg,
    transparent 0%,
    rgb(255 255 255 / 3%) 100%
  );
  opacity: 0;
  transition: opacity 0.3s;
}

:deep(.security-card:hover) {
  border-color: rgb(24 144 255 / 40%);
  box-shadow: 0 8px 16px rgb(0 0 0 / 10%);
  transform: translateY(-4px);
}

:deep(.security-card:hover::before) {
  opacity: 1;
}

:deep(.security-card-icon) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  transition: transform 0.3s;
}

:deep(.security-card:hover .security-card-icon) {
  transform: scale(1.1) rotate(-5deg);
}

:deep(.security-card-body) {
  position: relative;
  z-index: 1;
  flex: 1;
}

:deep(.security-card-body h4) {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.security-card-body p) {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
}

:deep(.security-card-body code) {
  padding: 1px 5px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #e83e8c;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
}

/* Hero Section */
.hero-section {
  padding: 60px 24px;
  margin-bottom: 48px;
  text-align: center;
  background: linear-gradient(
    135deg,
    rgb(102 126 234 / 10%) 0%,
    rgb(118 75 162 / 10%) 100%
  );
  border-radius: 16px;
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24px;
  box-shadow: 0 8px 24px rgb(102 126 234 / 30%);
}

.hero-icon svg {
  color: white;
}

.hero-section h1 {
  margin-bottom: 16px;
  font-size: 48px;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  margin: 0;
  font-size: 18px;
  color: var(--vben-text-color-secondary);
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
  cursor: pointer;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: #667eea;
  box-shadow: 0 12px 24px rgb(0 0 0 / 10%);
  transform: translateY(-4px);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 20px;
  border-radius: 12px;
}

.feature-card h3 {
  margin-bottom: 12px;
  font-size: 20px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.feature-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
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
  gap: 12px;
  align-items: center;
  margin-bottom: 24px;
  font-size: 28px;
  font-weight: 700;
  color: var(--vben-text-color);
}

.section-desc {
  margin-bottom: 24px;
  font-size: 16px;
  color: var(--vben-text-color-secondary);
}

.protocol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.protocol-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
  transition: all 0.2s;
}

.protocol-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgb(102 126 234 / 10%);
}

.protocol-badge {
  display: inline-block;
  width: fit-content;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
}

.protocol-badge.client {
  color: #1890ff;
  background: #e6f7ff;
}

.protocol-badge.server {
  color: #52c41a;
  background: #f6ffed;
}

.protocol-badge.bidirectional {
  color: #fa8c16;
  background: #fff7e6;
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
  position: absolute;
  top: 0;
  bottom: 0;
  left: 15px;
  width: 2px;
  content: '';
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
}

.timeline-item {
  position: relative;
  display: flex;
  gap: 20px;
  margin-bottom: 32px;
}

.timeline-marker {
  position: absolute;
  left: -40px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 14px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  box-shadow: 0 4px 12px rgb(102 126 234 / 30%);
}

.timeline-content {
  flex: 1;
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

.timeline-content h4 {
  margin-bottom: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.timeline-content p {
  margin: 0;
  font-size: 14px;
  color: var(--vben-text-color-secondary);
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
  text-align: center;
  background: var(--vben-background-color);
  border: 2px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s;
}

.requirement-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
}

.requirement-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background: linear-gradient(
    135deg,
    rgb(102 126 234 / 10%) 0%,
    rgb(118 75 162 / 10%) 100%
  );
  border-radius: 16px;
}

.requirement-icon svg {
  color: #667eea;
}

.requirement-card h4 {
  margin-bottom: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.requirement-card p {
  margin: 0;
  font-size: 14px;
  color: var(--vben-text-color-secondary);
}

/* Run Options */
.run-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.run-option h4 {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--vben-text-color);
}

/* Success Banner */
.success-banner {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(
    135deg,
    rgb(82 196 26 / 10%) 0%,
    rgb(82 196 26 / 5%) 100%
  );
  border-left: 4px solid #52c41a;
  border-radius: 8px;
}

.success-banner svg {
  flex-shrink: 0;
  color: #52c41a;
}

.success-banner p {
  margin: 0;
  font-size: 15px;
  color: var(--vben-text-color);
}

/* Info Banner */
.info-banner {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px 24px;
  margin-bottom: 32px;
  background: linear-gradient(
    135deg,
    rgb(24 144 255 / 10%) 0%,
    rgb(24 144 255 / 5%) 100%
  );
  border-left: 4px solid #1890ff;
  border-radius: 8px;
}

.info-banner svg {
  flex-shrink: 0;
  color: #1890ff;
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
  text-align: center;
  border-radius: 12px;
}

.result-card.success {
  background: linear-gradient(
    135deg,
    rgb(82 196 26 / 10%) 0%,
    rgb(82 196 26 / 5%) 100%
  );
  border: 2px solid #52c41a;
}

.result-card.failure {
  background: linear-gradient(
    135deg,
    rgb(245 34 45 / 10%) 0%,
    rgb(245 34 45 / 5%) 100%
  );
  border: 2px solid #f5222d;
}

.result-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
}

.result-card.success .result-icon {
  background: rgb(82 196 26 / 20%);
}

.result-card.success .result-icon svg {
  color: #52c41a;
}

.result-card.failure .result-icon {
  background: rgb(245 34 45 / 20%);
}

.result-card.failure .result-icon svg {
  color: #f5222d;
}

.result-card h4 {
  margin-bottom: 12px;
  font-size: 20px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.result-card p {
  margin: 0;
  font-size: 14px;
  color: var(--vben-text-color-secondary);
}

/* Security Tips */
.security-tips {
  display: grid;
  gap: 16px;
}

.security-tip {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

.tip-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.tip-icon.warning {
  background: rgb(250 140 22 / 10%);
}

.tip-icon.warning svg {
  color: #fa8c16;
}

.tip-icon.info {
  background: rgb(24 144 255 / 10%);
}

.tip-icon.info svg {
  color: #1890ff;
}

.tip-icon.success {
  background: rgb(82 196 26 / 10%);
}

.tip-icon.success svg {
  color: #52c41a;
}

.security-tip h4 {
  margin-bottom: 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.security-tip p {
  margin: 0;
  font-size: 14px;
  color: var(--vben-text-color-secondary);
}

/* 右侧目录 */
.doc-toc {
  position: sticky;
  top: 0;
  flex-shrink: 0;
  width: 220px;
  max-height: calc(100vh - 180px);
  padding: 16px;
  overflow-y: auto;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 8px;
}

.toc-title {
  padding-bottom: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
  border-bottom: 1px solid var(--vben-border-color);
}

.toc-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.toc-item {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--vben-text-color-secondary);
  cursor: pointer;
  border-left: 2px solid transparent;
  border-radius: 4px;
  transition: all 0.2s;
}

.toc-item:hover {
  color: var(--vben-text-color);
  background: var(--vben-background-color-deep);
}

.toc-item.active {
  font-weight: 500;
  color: var(--vben-primary-color);
  background: var(--vben-primary-color-light);
  border-left-color: var(--vben-primary-color);
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

/* HTML 文档内容样式 */
.doc-content {
  max-width: 900px;
  padding: 24px;
  margin: 0 auto;
  line-height: 1.8;
  color: var(--vben-text-color);
}

.doc-content h1 {
  padding-bottom: 12px;
  margin-bottom: 24px;
  font-size: 32px;
  font-weight: 700;
  color: var(--vben-text-color);
  border-bottom: 2px solid var(--vben-border-color);
}

.doc-content h2 {
  margin-top: 40px;
  margin-bottom: 16px;
  font-size: 24px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.doc-content h3 {
  margin-top: 32px;
  margin-bottom: 12px;
  font-size: 20px;
  font-weight: 600;
  color: var(--vben-text-color);
}

.doc-content p {
  margin-bottom: 16px;
  color: var(--vben-text-color);
}

.doc-content code {
  padding: 2px 6px;
  font-family: Consolas, Monaco, monospace;
  font-size: 14px;
  color: #e83e8c;
  background: var(--vben-background-color-deep);
  border-radius: 3px;
}

.doc-content .doc-section {
  margin-bottom: 40px;
}

.doc-content .feature-list,
.doc-content .protocol-list,
.doc-content .steps-list {
  padding-left: 24px;
  margin: 16px 0;
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
  overflow: hidden;
  background: #1e1e1e;
  border-radius: 8px;
}

.doc-content .code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

.doc-content .code-lang {
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  font-weight: 500;
  color: #d4d4d4;
}

.doc-content .copy-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 10px;
  font-size: 12px;
  color: #d4d4d4;
  cursor: pointer;
  background: transparent;
  border: 1px solid #3e3e3e;
  border-radius: 4px;
  transition: all 0.2s;
}

.doc-content .copy-btn:hover {
  background: #3e3e3e;
  border-color: #4e4e4e;
}

.doc-content .code-block pre {
  padding: 16px;
  margin: 0;
  overflow-x: auto;
  background: #1e1e1e;
}

.doc-content .code-block code {
  padding: 0;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  background: transparent;
}

/* ========== Apifox 风格 API 文档样式 ========== */

.api-doc {
  min-height: 100%;
  padding: 0;
  background: #0a0a0a;
}

.api-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 32px;
  background: linear-gradient(135deg, #141414 0%, #1a1a1a 100%);
  border-bottom: 1px solid #262626;
}

.api-header-left {
  flex: 1;
}

.api-title-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.api-method-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 28px;
  padding: 0 12px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-radius: 4px;
}

.api-method-badge.method-up {
  color: #fff;
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  box-shadow: 0 2px 8px rgb(24 144 255 / 30%);
}

.api-method-badge.method-down {
  color: #fff;
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  box-shadow: 0 2px 8px rgb(82 196 26 / 30%);
}

.api-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.3px;
}

.api-event-path {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.event-path-label {
  font-size: 13px;
  color: #8c8c8c;
}

.event-path-value {
  padding: 4px 10px;
  font-family: Consolas, Monaco, monospace;
  font-size: 14px;
  color: #52c41a;
  background: rgb(82 196 26 / 10%);
  border: 1px solid rgb(82 196 26 / 20%);
  border-radius: 4px;
}

.event-paired-label {
  margin-left: 12px;
  font-size: 13px;
  color: #8c8c8c;
}

.event-paired-label code {
  padding: 3px 8px;
  margin-left: 4px;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  color: #faad14;
  background: rgb(250 173 20 / 10%);
  border: 1px solid rgb(250 173 20 / 20%);
  border-radius: 4px;
}

.api-header-right {
  display: flex;
  align-items: center;
}

.api-direction-badge {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 6px;
}

.api-direction-badge.client-to-server {
  color: #1890ff;
  background: rgb(24 144 255 / 12%);
  border: 1px solid rgb(24 144 255 / 30%);
}

.api-direction-badge.server-to-client {
  color: #52c41a;
  background: rgb(82 196 26 / 12%);
  border: 1px solid rgb(82 196 26 / 30%);
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
  overflow-y: auto;
  background: #0a0a0a;
  border-right: 1px solid #262626;
}

.api-examples-col {
  padding: 24px 32px;
  overflow-y: auto;
  background: #000;
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
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 2px solid #1890ff;
}

.params-block-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.params-schema-name {
  padding: 4px 10px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #1890ff;
  background: rgb(24 144 255 / 10%);
  border: 1px solid rgb(24 144 255 / 25%);
  border-radius: 4px;
}

.params-table-wrap {
  overflow: visible;
  background: #141414;
  border: 1px solid #262626;
  border-radius: 6px;
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
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  text-align: left;
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
  position: relative;
  padding-left: 24px;
}

.nested-param::before {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 6px;
  height: 1px;
  content: '';
  background: #434343;
}

.params-table td {
  padding: 12px 14px;
  font-size: 13px;
  vertical-align: top;
}

.param-name-cell {
  display: flex;
  gap: 6px;
  align-items: center;
}

.required-dot {
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  color: #ff4d4f;
}

.param-name {
  padding: 2px 6px;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  color: #d4d4d4;
  background: rgb(255 255 255 / 5%);
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
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-radius: 3px;
}

.type-pill.type-string {
  color: #40a9ff;
  background: rgb(24 144 255 / 15%);
  border: 1px solid rgb(24 144 255 / 30%);
}

.type-pill.type-number,
.type-pill.type-int,
.type-pill.type-int64 {
  color: #73d13d;
  background: rgb(82 196 26 / 15%);
  border: 1px solid rgb(82 196 26 / 30%);
}

.type-pill.type-boolean,
.type-pill.type-bool {
  color: #ffc53d;
  background: rgb(250 173 20 / 15%);
  border: 1px solid rgb(250 173 20 / 30%);
}

.type-pill.type-object {
  color: #b37feb;
  background: rgb(114 46 209 / 15%);
  border: 1px solid rgb(114 46 209 / 30%);
}

.type-pill.type-array {
  color: #ff7875;
  background: rgb(255 77 79 / 15%);
  border: 1px solid rgb(255 77 79 / 30%);
}

.req-yes {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #ff4d4f;
  background: rgb(255 77 79 / 12%);
  border-radius: 3px;
}

.req-no {
  font-size: 12px;
  color: #595959;
}

.param-desc {
  line-height: 1.6;
  color: #d4d4d4;
}

.enum-values {
  display: block;
  padding: 6px 10px;
  margin-top: 6px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #faad14;
  background: rgb(250 173 20 / 8%);
  border-left: 2px solid #faad14;
  border-radius: 3px;
}

.nested-schema {
  padding: 12px;
  margin-top: 12px;
  background: #0a0a0a;
  border: 1px solid #262626;
  border-radius: 4px;
}

.nested-schema-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
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
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 2px solid #52c41a;
}

.example-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.example-lang {
  padding: 4px 10px;
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  color: #52c41a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgb(82 196 26 / 10%);
  border: 1px solid rgb(82 196 26 / 25%);
  border-radius: 4px;
}

.code-box {
  position: relative;
  overflow: hidden;
  background: #0a0a0a;
  border: 1px solid #262626;
  border-radius: 6px;
}

.code-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #141414;
  border-bottom: 1px solid #262626;
}

.code-box-title {
  font-size: 12px;
  font-weight: 500;
  color: #8c8c8c;
}

.copy-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: #8c8c8c;
  cursor: pointer;
  background: transparent;
  border: 1px solid #262626;
  border-radius: 4px;
  transition: all 0.2s;
}

.copy-btn:hover {
  color: #fff;
  background: #1a1a1a;
  border-color: #404040;
}

.copy-btn svg {
  width: 12px;
  height: 12px;
}

.code-box pre {
  padding: 16px;
  margin: 0;
  overflow-x: auto;
  background: #0a0a0a;
}

.code-box code {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #d4d4d4;
}

/* Ant Design Vue Table 树形表格样式覆盖 */
:deep(.params-tree-table) {
  background: transparent;
}

:deep(.params-tree-table .ant-table) {
  color: var(--vben-text-color);
  background: transparent;
}

:deep(.params-tree-table .ant-table-thead > tr > th) {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #1a1a1a;
  border-bottom: 1px solid #262626;
}

:deep(.params-tree-table .ant-table-tbody > tr > td) {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--vben-text-color);
  background: transparent;
  border-bottom: 1px solid #1a1a1a;
}

:deep(.params-tree-table .ant-table-tbody > tr:hover > td) {
  background: #161616 !important;
}

:deep(.params-tree-table .ant-table-row-expand-icon) {
  color: #8c8c8c;
  background: transparent;
  border: 1px solid #434343;
}

:deep(.params-tree-table .ant-table-row-expand-icon:hover) {
  color: #1890ff;
  border-color: #1890ff;
}

:deep(.params-tree-table .ant-table-row-expand-icon::before),
:deep(.params-tree-table .ant-table-row-expand-icon::after) {
  background: currentcolor;
}

:deep(.params-tree-table .ant-table-tbody > tr.ant-table-row-level-1 > td) {
  background: #0d0d0d;
}

:deep(
  .params-tree-table .ant-table-tbody > tr.ant-table-row-level-1:hover > td
) {
  background: #121212 !important;
}

:deep(
  .params-tree-table
    .ant-table-tbody
    > tr.ant-table-row-level-1
    > td:first-child
) {
  border-left: 3px solid #1890ff;
}

/* ===== DeployAgent 概述页面样式 ===== */
:deep(.deploy-agent-overview) {
  max-width: 1000px;
  padding: 24px;
  margin: 0 auto;
}

:deep(.overview-header) {
  padding: 40px 20px 32px;
  margin-bottom: 32px;
  text-align: center;
  background: linear-gradient(
    135deg,
    rgb(24 144 255 / 5%) 0%,
    rgb(82 196 26 / 5%) 100%
  );
  border-radius: 16px;
}

:deep(.overview-header h1) {
  margin: 0 0 16px;
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, #1890ff 0%, #52c41a 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

:deep(.overview-desc) {
  max-width: 600px;
  margin: 0 auto;
  font-size: 16px;
  line-height: 1.6;
  color: var(--vben-text-color-secondary);
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
  padding: 24px 20px;
  text-align: center;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

:deep(.feature-item:hover) {
  border-color: transparent;
  box-shadow: 0 12px 28px rgb(0 0 0 / 12%);
  transform: translateY(-8px);
}

:deep(.feature-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  font-size: 28px;
  border-radius: 16px;
}

:deep(.feature-content h3) {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.feature-content p) {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vben-text-color-secondary);
}

/* 快速开始 */
:deep(.quick-start) {
  margin-bottom: 48px;
}

:deep(.quick-start h2) {
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.start-steps) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.start-step) {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 24px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s ease;
}

:deep(.start-step:hover) {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgb(24 144 255 / 10%);
}

:deep(.step-number) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  font-size: 20px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #1890ff 0%, #52c41a 100%);
  border-radius: 12px;
}

:deep(.step-text h4) {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.step-text p) {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vben-text-color-secondary);
}

/* 通信协议 */
:deep(.protocol-section) {
  margin-bottom: 48px;
}

:deep(.protocol-section h2) {
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.protocol-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

:deep(.protocol-item) {
  padding: 20px;
  text-align: center;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 10px;
  transition: all 0.3s ease;
}

:deep(.protocol-item:hover) {
  border-color: #1890ff;
  transform: scale(1.05);
}

:deep(.protocol-label) {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--vben-text-color-secondary);
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
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.access-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

:deep(.access-card) {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 12px;
  transition: all 0.3s ease;
}

:deep(.access-card:hover) {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgb(24 144 255 / 10%);
}

:deep(.access-icon) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  font-size: 24px;
  background: rgb(24 144 255 / 10%);
  border-radius: 10px;
}

:deep(.access-content h4) {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.access-content code) {
  display: block;
  padding: 4px 8px;
  margin-bottom: 4px;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  color: #1890ff;
  background: rgb(24 144 255 / 5%);
  border-radius: 4px;
}

:deep(.access-content p) {
  margin: 0;
  font-size: 12px;
  color: var(--vben-text-color-secondary);
}

/* 部署方式 */
:deep(.deploy-types) {
  margin-bottom: 32px;
}

:deep(.deploy-types h2) {
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.deploy-type-list) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

:deep(.deploy-type) {
  padding: 20px;
  text-align: center;
  background: var(--vben-background-color);
  border: 1px solid var(--vben-border-color);
  border-radius: 10px;
  transition: all 0.3s ease;
}

:deep(.deploy-type:hover) {
  border-color: #52c41a;
  transform: translateY(-4px);
}

:deep(.deploy-type-icon) {
  margin-bottom: 12px;
  font-size: 32px;
}

:deep(.deploy-type h4) {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vben-text-color);
}

:deep(.deploy-type p) {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vben-text-color-secondary);
}
</style>
