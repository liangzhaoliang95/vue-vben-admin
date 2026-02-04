<template>
  <div class="terminal-page">
    <div class="page-header">
      <h2>{{ $t('terminal.title') }}</h2>
      <a-select
        v-model:value="selectedServerId"
        :placeholder="$t('terminal.selectServer')"
        style="width: 300px"
        show-search
        :filter-option="filterOption"
      >
        <a-select-option
          v-for="server in servers"
          :key="server.id"
          :value="server.id"
        >
          {{ server.name }} ({{ server.id }})
        </a-select-option>
      </a-select>
    </div>

    <div v-if="selectedServerId" class="terminal-wrapper">
      <WebTerminal
        :key="selectedServerId"
        :server-id="selectedServerId"
        :title="getServerName(selectedServerId)"
        @close="handleTerminalClose"
      />
    </div>

    <div v-else class="empty-state">
      <a-empty :description="$t('terminal.selectServerHint')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import WebTerminal from '#/components/web-terminal/index.vue';
import { $t } from '#/locales';
import { requestClient } from '#/api/request';

interface Server {
  id: string;
  name: string;
  status: string;
}

const selectedServerId = ref<string>('');
const servers = ref<Server[]>([]);

// 获取在线服务器列表
const fetchServers = async () => {
  console.log('🔍 fetchServers called');
  try {
    console.log('📡 Calling API: /serverAgent/getOnlineServers');
    const response = await requestClient.post<{
      servers: Array<{
        serverId: string;      // 注意：小驼峰格式，与后端JSON字段匹配
        serverName: string;
        lastSeen: string;
      }>;
      count: number;
    }>('/serverAgent/getOnlineServers');

    console.log('✅ API Response:', response);
    console.log('📋 Servers:', response.servers);

    // 转换为前端所需格式
    servers.value = (response.servers || []).map((s) => ({
      id: s.serverId,        // 使用小驼峰 serverId
      name: s.serverName,
      status: 'online',
    }));

    console.log('🎯 Mapped servers:', servers.value);
  } catch (error) {
    console.error('❌ Failed to fetch servers:', error);
    message.error($t('terminal.fetchServersError'));
  }
};

// 过滤选项
const filterOption = (input: string, option: any) => {
  const text = option.children?.[0]?.children || '';
  return text.toLowerCase().includes(input.toLowerCase());
};

// 获取服务器名称
const getServerName = (serverId: string) => {
  const server = servers.value.find((s) => s.id === serverId);
  return server ? server.name : serverId;
};

// 处理终端关闭
const handleTerminalClose = () => {
  selectedServerId.value = '';
};

onMounted(() => {
  console.log('🚀 Terminal page mounted');
  fetchServers();
});
</script>

<style scoped lang="less">
.terminal-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 {
    margin: 0;
  }
}

.terminal-wrapper {
  flex: 1;
  min-height: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
