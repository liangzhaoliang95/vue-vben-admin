<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Card, Statistic, Row, Col, Button } from 'ant-design-vue';
import { getTaskListApi } from '#/api/formCollector';

const totalTasks = ref(0);
const activeTasks = ref(0);
const loading = ref(false);

// 加载统计数据
const loadStats = async () => {
  loading.value = true;
  try {
    const res = await getTaskListApi({
      pageIndex: 1,
      pageSize: 1,
    });
    totalTasks.value = res.total || 0;
    // 这里可以添加更多统计逻辑
    activeTasks.value = res.total || 0;
  } catch (error) {
    console.error('加载统计数据失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="p-4">
    <h1 class="mb-6 text-3xl font-bold">概览</h1>

    <Row :gutter="16">
      <Col :span="8">
        <Card>
          <Statistic
            title="总任务数"
            :value="totalTasks"
            :loading="loading"
          >
            <template #prefix>
              <span class="text-blue-500">📋</span>
            </template>
          </Statistic>
        </Card>
      </Col>
      <Col :span="8">
        <Card>
          <Statistic
            title="活跃任务"
            :value="activeTasks"
            :loading="loading"
          >
            <template #prefix>
              <span class="text-green-500">✅</span>
            </template>
          </Statistic>
        </Card>
      </Col>
      <Col :span="8">
        <Card>
          <Statistic title="总提交数" :value="0" :loading="loading">
            <template #prefix>
              <span class="text-purple-500">📊</span>
            </template>
          </Statistic>
        </Card>
      </Col>
    </Row>

    <Card class="mt-6" title="快速操作">
      <div class="flex gap-4">
        <Button type="primary" @click="$router.push('/dashboard/guide')">
          快速开始
        </Button>
        <Button @click="$router.push('/formCollector/task-list')">
          管理任务
        </Button>
        <Button @click="loadStats">刷新数据</Button>
      </div>
    </Card>

    <Card class="mt-6" title="欢迎使用表单采集器">
      <p class="text-gray-600">
        表单采集器是一个简单易用的数据收集工具，帮助您快速创建和管理表单任务。
      </p>
      <ul class="mt-4 list-disc pl-6 text-gray-600">
        <li>创建自定义表单任务</li>
        <li>收集和管理表单数据</li>
        <li>实时查看提交记录</li>
        <li>灵活的数据导出功能</li>
      </ul>
    </Card>
  </div>
</template>
