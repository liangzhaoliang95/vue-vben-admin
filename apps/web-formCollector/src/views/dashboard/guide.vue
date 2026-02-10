<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Typography, Table, Timeline, Anchor, Card } from 'ant-design-vue';

const { Text, Link } = Typography;
const router = useRouter();

// 获取当前域名
const baseUrl = computed(() => {
  return `${window.location.protocol}//${window.location.host}`;
});

const apiColumns = [
  { title: '参数', dataIndex: 'param', width: '30%' },
  { title: '说明', dataIndex: 'desc' },
];

const submitBodyRows = [
  { key: '1', param: '(任意字段)', desc: '标准 JSON 对象，字段名和值由 AI 生成的网页自行定义' },
];

const allDataRows = [
  { key: '1', param: ':taskId (路径参数)', desc: '任务ID，创建任务后获得' },
];

const deleteOneRows = [
  { key: '1', param: ':taskId (路径参数)', desc: '任务ID' },
  { key: '2', param: ':dataId (路径参数)', desc: '数据ID，从查询接口返回的 dataId 字段获取' },
];

const anchorItems = [
  {
    key: 'api-submit',
    href: '#api-submit',
    title: '1. 提交表单数据',
  },
  {
    key: 'api-query',
    href: '#api-query',
    title: '2. 查询所有数据',
  },
  {
    key: 'api-delete-one',
    href: '#api-delete-one',
    title: '3. 删除单条数据',
  },
  {
    key: 'api-delete-all',
    href: '#api-delete-all',
    title: '4. 删除所有数据',
  },
  {
    key: 'prompt',
    href: '#prompt',
    title: 'AI 提示词注入',
  },
];

const targetOffset = ref<number>(80);

// 处理锚点点击，阻止默认行为，手动滚动
const handleAnchorClick = (e: Event, link: { href: string }) => {
  e.preventDefault();
  const targetId = link.href.replace('#', '');
  const targetElement = document.getElementById(targetId);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
};
</script>

<template>
  <div class="guide-page">
    <!-- 顶部区域：产品介绍 + 快速开始 -->
    <Card class="guide-top-section">
      <!-- 产品介绍 -->
      <section class="guide-section">
        <h1 class="guide-h1">产品介绍</h1>
        <Alert
          message="什么是表单采集器？"
          type="info"
          show-icon
          class="mb-6"
        >
          <template #description>
            <p>
              表单采集器为 <Text strong>AI 生成的网页</Text> 提供数据持久化能力。
              AI 生成的网页无法直接将数据存入数据库，通过本平台提供的开放接口，
              可以将接口信息注入到 AI 提示词中，让 AI 生成的网页具备数据提交和查询能力。
            </p>
          </template>
        </Alert>
      </section>

      <!-- 快速开始 -->
      <section class="guide-section">
        <h1 class="guide-h1">快速开始</h1>
        <Timeline>
          <Timeline.Item color="blue">
            <h3 class="text-base font-semibold">1. 创建采集任务</h3>
            <p class="mt-1 text-gray-500">
              在
              <Link @click="router.push('/formCollector/task-list')">「任务管理」</Link>
              中创建一个采集任务，获得 <Text code>taskId</Text>
            </p>
          </Timeline.Item>
          <Timeline.Item color="blue">
            <h3 class="text-base font-semibold">2. 注入 AI 提示词</h3>
            <p class="mt-1 text-gray-500">将下方的接口地址和 taskId 写入 AI 提示词</p>
          </Timeline.Item>
          <Timeline.Item color="blue">
            <h3 class="text-base font-semibold">3. AI 网页提交数据</h3>
            <p class="mt-1 text-gray-500">AI 生成的网页通过接口提交数据（标准 JSON）</p>
          </Timeline.Item>
          <Timeline.Item color="green">
            <h3 class="text-base font-semibold">4. 查看收集数据</h3>
            <p class="mt-1 text-gray-500">
              在
              <Link @click="router.push('/formCollector/task-list')">「任务管理」</Link>
              中查看收集到的数据
            </p>
          </Timeline.Item>
        </Timeline>
      </section>
    </Card>

    <!-- 底部区域：左侧大纲 + 右侧接口文档 -->
    <div class="guide-bottom-section">
      <!-- 左侧导航 -->
      <Card class="guide-sidebar">
        <h2 class="guide-sidebar-title">接口文档</h2>
        <Anchor :items="anchorItems" :target-offset="targetOffset" @click="handleAnchorClick" />
      </Card>

      <!-- 右侧内容 -->
      <Card class="guide-content">
        <!-- 开放接口文档 -->
        <section id="api" class="guide-section">
          <h1 class="guide-h1">开放接口文档</h1>
          <Alert
            message="以下接口均为公开接口，无需认证，可直接在 AI 生成的网页中调用。"
            type="warning"
            show-icon
            class="mb-6"
          />

          <!-- 接口1: 提交表单数据 -->
          <div id="api-submit" class="guide-api-block">
            <h2 class="guide-h2">1. 提交表单数据</h2>
            <p class="mb-2">
              <Text code>POST</Text>
              <Text code>{{ baseUrl }}/server/formCollector/nc/formSubmit/submit/{taskId}</Text>
            </p>
            <p class="mb-3 text-gray-500">将 AI 生成网页中的表单数据提交到平台。请求体为任意结构的 JSON 对象，平台会原样存储。</p>
            <h4 class="guide-h4">请求参数</h4>
            <Table :columns="apiColumns" :data-source="submitBodyRows" :pagination="false" size="small" bordered class="mb-4" />
            <h4 class="guide-h4">请求示例</h4>
            <pre class="guide-code-block">POST {{ baseUrl }}/server/formCollector/nc/formSubmit/submit/69899782eec82c233d161159
Content-Type: application/json

{
  "name": "张三",
  "age": 25,
  "email": "zhangsan@example.com"
}</pre>
            <h4 class="guide-h4">响应示例</h4>
            <pre class="guide-code-block">{
  "code": 0,
  "data": {
    "dataId": "698aa73feec82c04339ab211"
  }
}</pre>
          </div>

          <!-- 接口2: 查询所有数据 -->
          <div id="api-query" class="guide-api-block">
            <h2 class="guide-h2">2. 查询任务的所有提交数据</h2>
            <p class="mb-2">
              <Text code>GET</Text>
              <Text code>{{ baseUrl }}/server/formCollector/nc/formSubmit/submit/{taskId}/all</Text>
            </p>
            <p class="mb-3 text-gray-500">获取指定任务下的所有提交数据，返回完整列表。</p>
            <h4 class="guide-h4">请求参数</h4>
            <Table :columns="apiColumns" :data-source="allDataRows" :pagination="false" size="small" bordered class="mb-4" />
            <h4 class="guide-h4">请求示例</h4>
            <pre class="guide-code-block">GET {{ baseUrl }}/server/formCollector/nc/formSubmit/submit/69899782eec82c233d161159/all</pre>
            <h4 class="guide-h4">响应示例</h4>
            <pre class="guide-code-block">{
  "code": 0,
  "data": {
    "total": 1,
    "list": [
      {
        "dataId": "698aa73feec82c04339ab211",
        "taskId": "69899782eec82c233d161159",
        "formData": {
          "name": "张三",
          "age": 25,
          "email": "zhangsan@example.com"
        },
        "submitIp": "120.230.xx.xx",
        "submitRegion": "广东省/广州市",
        "submitAt": 1707544463000
      }
    ]
  }
}</pre>
          </div>

          <!-- 接口3: 删除单条数据 -->
          <div id="api-delete-one" class="guide-api-block">
            <h2 class="guide-h2">3. 删除单条提交数据</h2>
            <p class="mb-2">
              <Text code>GET</Text>
              <Text code>{{ baseUrl }}/server/formCollector/nc/formSubmit/delete/{taskId}/{dataId}</Text>
            </p>
            <p class="mb-3 text-gray-500">删除指定任务下的某一条提交数据。</p>
            <h4 class="guide-h4">请求参数</h4>
            <Table :columns="apiColumns" :data-source="deleteOneRows" :pagination="false" size="small" bordered class="mb-4" />
            <h4 class="guide-h4">请求示例</h4>
            <pre class="guide-code-block">GET {{ baseUrl }}/server/formCollector/nc/formSubmit/delete/69899782eec82c233d161159/698aa73feec82c04339ab211</pre>
            <h4 class="guide-h4">响应示例</h4>
            <pre class="guide-code-block">{
  "code": 0,
  "data": null
}</pre>
          </div>

          <!-- 接口4: 删除所有数据 -->
          <div id="api-delete-all" class="guide-api-block">
            <h2 class="guide-h2">4. 删除任务的所有提交数据</h2>
            <p class="mb-2">
              <Text code>GET</Text>
              <Text code>{{ baseUrl }}/server/formCollector/nc/formSubmit/delete/{taskId}/all</Text>
            </p>
            <p class="mb-3 text-gray-500">删除指定任务下的全部提交数据，操作不可恢复。</p>
            <h4 class="guide-h4">请求参数</h4>
            <Table :columns="apiColumns" :data-source="allDataRows" :pagination="false" size="small" bordered class="mb-4" />
            <h4 class="guide-h4">请求示例</h4>
            <pre class="guide-code-block">GET {{ baseUrl }}/server/formCollector/nc/formSubmit/delete/69899782eec82c233d161159/all</pre>
            <h4 class="guide-h4">响应示例</h4>
            <pre class="guide-code-block">{
  "code": 0,
  "data": null
}</pre>
          </div>
        </section>

        <!-- AI 提示词注入 -->
        <section id="prompt" class="guide-section">
          <h1 class="guide-h1">AI 提示词注入指南</h1>
          <p class="mb-3 text-gray-500">
            在使用 AI 生成网页时，将以下内容添加到提示词中，AI 即可生成带有数据提交功能的网页。
            将 <Text code>{taskId}</Text> 替换为你在平台创建的实际任务ID。
          </p>
          <h4 class="guide-h4">提示词模板</h4>
          <pre class="guide-code-block">该网页需要将用户填写的表单数据提交到远程服务器进行持久化存储。

数据提交接口：
- 地址：POST {{ baseUrl }}/server/formCollector/nc/formSubmit/submit/{taskId}
- Content-Type: application/json
- 请求体：将表单数据组织为 JSON 对象直接发送，字段名自定义
- 响应：{ "code": 0, "data": { "dataId": "xxx" } }

数据查询接口：
- 地址：GET {{ baseUrl }}/server/formCollector/nc/formSubmit/submit/{taskId}/all
- 响应：{ "code": 0, "data": { "total": 1, "list": [...] } }

注意事项：
- 提交时需要处理跨域（CORS），接口已支持跨域请求
- 提交成功后 code 为 0，失败时 code 非 0 且有 message 字段
- 请在提交后给用户明确的成功/失败提示</pre>
        </section>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* 页面容器 */
.guide-page {
  padding: 24px;
  background: transparent;
}

/* 顶部区域：产品介绍 + 快速开始 */
.guide-top-section {
  margin-bottom: 24px;
}

/* 底部区域：左右布局 */
.guide-bottom-section {
  display: flex;
  gap: 24px;
  height: calc(100vh - 200px);
  overflow: hidden;
}

/* 左侧导航 */
.guide-sidebar {
  width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
}

.guide-sidebar-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

/* 右侧内容 */
.guide-content {
  flex: 1;
  overflow-y: auto;
}

/* 章节样式 */
.guide-section {
  margin-bottom: 48px;
}

.guide-section:last-child {
  margin-bottom: 0;
}

.guide-h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(5, 5, 5, 0.06);
}

:deep(.dark) .guide-h1 {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.guide-h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 16px;
  margin-top: 32px;
}

.guide-h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  margin-top: 16px;
}

/* API 块样式 */
.guide-api-block {
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(5, 5, 5, 0.06);
}

:deep(.dark) .guide-api-block {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.guide-api-block:last-child {
  border-bottom: none;
}

/* 代码块样式 */
.guide-code-block {
  padding: 16px;
  margin: 0;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
  color: #e8e8e8;
  border-radius: 6px;
  background-color: #1e1e1e;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* Anchor 样式优化 */
:deep(.ant-anchor-wrapper) {
  background: transparent;
  padding: 0;
}

:deep(.ant-anchor-link) {
  padding: 4px 0 4px 16px;
}

:deep(.ant-anchor-link-title) {
  font-size: 14px;
}

:deep(.ant-anchor-ink) {
  left: 0;
}
</style>
