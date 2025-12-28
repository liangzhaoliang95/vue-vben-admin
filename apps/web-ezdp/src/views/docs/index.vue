<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { Page } from '@vben/common-ui';
import { Card, Spin, Empty, Button, message } from 'ant-design-vue';
import { $t } from '#/locales';
import { loadDocList, loadDocContent, markdownToHtml } from './data';
import type { DocItem, DocPageState } from './types';

defineOptions({ name: 'DocCenter' });

const docList = ref<DocItem[]>([]);
const state = ref<DocPageState>({
  selectedDoc: null,
  content: '',
  loading: false,
  error: null,
});

// 当前选中的文档信息
const currentDoc = computed(() => {
  return docList.value.find((doc) => doc.id === state.value.selectedDoc);
});

// 加载文档内容
async function loadDoc(docId: string) {
  state.value.selectedDoc = docId;
  state.value.loading = true;
  state.value.error = null;
  state.value.content = '';

  try {
    const doc = docList.value.find((d) => d.id === docId);
    if (!doc) {
      throw new Error('文档不存在');
    }

    const content = await loadDocContent(doc.fileName);
    state.value.content = markdownToHtml(content);
  } catch (error: any) {
    state.value.error = error.message || '加载文档失败';
    message.error(`加载文档失败: ${error.message}`);
  } finally {
    state.value.loading = false;
  }
}

// 复制文档内容
function copyContent() {
  if (!state.value.content) return;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = state.value.content;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';

  navigator.clipboard.writeText(textContent).then(() => {
    message.success($t('common.copySuccess'));
  }).catch(() => {
    message.error($t('common.copyFailed'));
  });
}

// 初始化：加载文档列表并默认加载第一个文档
onMounted(async () => {
  try {
    const docs = await loadDocList();
    docList.value = docs;
    if (docs.length > 0) {
      await loadDoc(docs[0]!.id);
    }
  } catch (error: any) {
    message.error(`加载文档列表失败: ${error.message}`);
  }
});
</script>

<template>
  <Page :title="$t('page.docs.title')" :description="$t('page.docs.description')">
    <div class="doc-container">
      <!-- 左侧文档列表 -->
      <div class="doc-sidebar">
        <Card :bordered="false" class="doc-list-card">
          <template #title>
            <span class="doc-list-title">📚 {{ $t('page.docs.listTitle') }}</span>
          </template>
          <div class="doc-list">
            <div
              v-for="doc in docList"
              :key="doc.id"
              class="doc-item"
              :class="{ active: state.selectedDoc === doc.id }"
              @click="loadDoc(doc.id)"
            >
              <div class="doc-item-title">{{ doc.title }}</div>
              <div class="doc-item-desc">{{ doc.description }}</div>
            </div>
            <div v-if="docList.length === 0" class="doc-empty">
              暂无文档
            </div>
          </div>
        </Card>
      </div>

      <!-- 右侧文档内容 -->
      <div class="doc-content">
        <Card
          :bordered="false"
          class="doc-content-card"
          :loading="state.loading"
        >
          <template #title>
            <div class="doc-header">
              <span class="doc-title">{{ currentDoc?.title || '请选择文档' }}</span>
              <div class="doc-actions" v-if="state.content">
                <Button size="small" @click="copyContent" type="primary" ghost>
                  📋 {{ $t('common.copy') }}
                </Button>
              </div>
            </div>
          </template>

          <div class="doc-body">
            <Spin v-if="state.loading" tip="文档加载中...">
              <div class="loading-placeholder" />
            </Spin>

            <div
              v-else-if="state.content"
              class="markdown-content"
              v-html="state.content"
            />

            <Empty
              v-else-if="!state.content && !state.loading"
              :description="state.error || '请选择左侧文档查看'"
            />
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.doc-wrapper {
  background: #f5f7fa;
  margin: -16px;
  padding: 16px;
  min-height: calc(100vh - 120px);
}

.doc-container {
  display: flex;
  gap: 16px;
  height: calc(100vh - 220px);
  min-height: 600px;
}

.doc-sidebar {
  width: 280px;
  flex-shrink: 0;
}

.doc-content {
  flex: 1;
  overflow: hidden;
}

.doc-list-card,
.doc-content-card {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

:deep(.ant-card-head) {
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  padding: 12px 16px;
  min-height: 48px;
}

:deep(.ant-card-body) {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.doc-list-title {
  font-size: 16px;
  font-weight: 600;
  color: #1890ff;
}

.doc-list {
  padding: 12px;
}

.doc-item {
  padding: 12px 14px;
  margin-bottom: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #f0f0f0;
  background: #fff;
}

.doc-item:hover {
  background: #f0f7ff;
  border-color: #91caff;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(24, 144, 255, 0.15);
}

.doc-item.active {
  background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.25);
}

.doc-item-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #1f1f1f;
}

.doc-item-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.doc-empty {
  text-align: center;
  padding: 40px 12px;
  color: #999;
  font-size: 14px;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
}

.doc-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.doc-body {
  height: 100%;
  overflow: auto;
  padding: 24px 28px;
  background: #fff;
}

.loading-placeholder {
  height: 200px;
}

/* Markdown 样式 - 专业版 */
.markdown-content {
  line-height: 1.7;
  color: #2c3e50;
  font-size: 14px;
}

.markdown-content :deep(h1) {
  font-size: 26px;
  font-weight: 700;
  margin: 28px 0 18px;
  color: #1f1f1f;
  border-bottom: 2px solid #1890ff;
  padding-bottom: 8px;
}

.markdown-content :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 14px;
  color: #1f1f1f;
  border-left: 4px solid #1890ff;
  padding-left: 12px;
  background: linear-gradient(90deg, rgba(24,144,255,0.08) 0%, transparent 100%);
  padding: 8px 12px;
  border-radius: 4px;
}

.markdown-content :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 18px 0 10px;
  color: #3c3c3c;
}

.markdown-content :deep(p) {
  margin: 12px 0;
  text-align: justify;
  color: #4a5568;
}

.markdown-content :deep(ul), .markdown-content :deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 6px 0;
  line-height: 1.6;
  color: #4a5568;
}

.markdown-content :deep(li strong) {
  color: #1890ff;
}

/* 行内代码 */
.markdown-content :deep(code) {
  background: #f0f7ff;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #c41d7f;
  border: 1px solid #bae7ff;
  font-weight: 500;
}

/* 普通代码块 */
.markdown-content :deep(pre.code-block) {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid #e8e8e8;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
}

.markdown-content :deep(pre.code-block code) {
  background: none;
  padding: 0;
  color: #2c3e50;
  font-size: 13px;
  line-height: 1.6;
}

/* 流程图 - 特殊样式 */
.markdown-content :deep(pre.flowchart) {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: #fff;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 18px 0;
  border: 1px solid #096dd9;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-weight: 500;
}

.markdown-content :deep(pre.flowchart code) {
  background: none;
  padding: 0;
  color: #fff;
  font-size: 14px;
  line-height: 1.8;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* 流程图中的箭头和步骤数字 */
.markdown-content :deep(.arrow) {
  color: #ffd666;
  font-weight: 700;
  font-size: 16px;
  padding: 0 4px;
}

.markdown-content :deep(.step-num) {
  color: #ffd666;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 4px;
}

/* JSON 数据块 */
.markdown-content :deep(pre code .json-key) {
  color: #e06c75;
}

.markdown-content :deep(pre code .json-string) {
  color: #98c379;
}

.markdown-content :deep(pre code .json-number) {
  color: #d19a66;
}

.markdown-content :deep(strong) {
  font-weight: 600;
  color: #1890ff;
}

.markdown-content :deep(a) {
  color: #1890ff;
  text-decoration: none;
  border-bottom: 1px dashed #1890ff;
}

.markdown-content :deep(a:hover) {
  color: #40a9ff;
  border-bottom-style: solid;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  font-size: 13px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #e8e8e8;
  padding: 12px 14px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: #fff;
  font-weight: 600;
  border: none;
}

.markdown-content :deep(td) {
  background: #fff;
}

.markdown-content :deep(tr:nth-child(even) td) {
  background: #fafafa;
}

.markdown-content :deep(tr:hover td) {
  background: #e6f7ff;
}

/* 分隔线 */
.markdown-content :deep(hr) {
  border: none;
  border-top: 2px dashed #d9d9d9;
  margin: 20px 0;
}

/* 引用块 */
.markdown-content :deep(blockquote) {
  border-left: 4px solid #1890ff;
  background: #f0f7ff;
  padding: 12px 16px;
  margin: 12px 0;
  border-radius: 0 6px 6px 0;
  color: #4a5568;
}

/* 响应式 */
@media (max-width: 1200px) {
  .doc-container {
    height: calc(100vh - 160px);
  }

  .doc-sidebar {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .doc-container {
    flex-direction: column;
    height: auto;
    min-height: 800px;
  }

  .doc-sidebar {
    width: 100%;
    height: 200px;
  }

  .doc-content {
    min-height: 400px;
  }

  .doc-body {
    padding: 16px 12px;
  }

  .markdown-content :deep(h1) {
    font-size: 22px;
  }

  .markdown-content :deep(h2) {
    font-size: 18px;
  }
}
</style>
