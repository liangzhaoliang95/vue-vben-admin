import type { DocItem, EventData } from './types';

// 注册事件数据
const registerEventData: EventData = {
  eventName: 'register',
  direction: 'client-to-server',
  pairedEvent: 'register_response',
  description: 'Agent 向服务端发起注册请求，携带认证 Token 和 Agent 基本信息',
  request: {
    name: 'RegisterRequest',
    description: 'Agent 注册请求数据结构',
    fields: [
      { name: 'token', type: 'string', required: true, description: '认证令牌（必填）' },
      { name: 'name', type: 'string', required: true, description: 'Agent 名称（必填）' },
      { name: 'hostname', type: 'string', required: true, description: '主机名' },
      { name: 'ip', type: 'string', required: true, description: 'IP 地址' },
      { name: 'os', type: 'string', required: true, description: '操作系统' },
      { name: 'arch', type: 'string', required: true, description: '架构（如 amd64）' },
      { name: 'version', type: 'string', required: true, description: 'Agent 版本' },
      { name: 'osVersion', type: 'string', required: true, description: '详细 OS 版本（如 ubuntu 22.04）' },
      { name: 'cpuCores', type: 'number', required: true, description: 'CPU 核心数' },
      { name: 'cpuModel', type: 'string', required: true, description: 'CPU 型号' },
      { name: 'memoryTotal', type: 'number', required: true, description: '总内存（字节）' },
      { name: 'diskTotal', type: 'number', required: true, description: '总磁盘（字节）' },
      { name: 'publicIp', type: 'string', required: true, description: '公网 IP' },
      { name: 'maxConcurrentTasks', type: 'number', required: true, description: '最大并发任务数' },
      { name: 'tags', type: 'object', required: false, description: '标签（可选）' },
    ],
    example: JSON.stringify({
      type: 'register',
      requestId: '507f1f77bcf86cd799439011',
      timestamp: 1640000000000,
      data: {
        token: 'your-auth-token-here',
        name: 'build-agent-01',
        hostname: 'ubuntu-server',
        ip: '192.168.1.100',
        os: 'linux',
        arch: 'amd64',
        version: '1.0.0',
        osVersion: 'ubuntu 22.04',
        cpuCores: 8,
        cpuModel: 'Intel Core i7-9700K',
        memoryTotal: 17179869184,
        diskTotal: 536870912000,
        publicIp: '203.0.113.1',
        maxConcurrentTasks: 3,
        tags: { env: 'production', region: 'us-west' }
      }
    }, null, 2)
  },
  response: {
    name: 'RegisterResponse',
    description: '服务端注册响应数据结构',
    fields: [
      { name: 'success', type: 'boolean', required: true, description: '是否成功' },
      { name: 'agentId', type: 'string', required: false, description: 'Agent ID（成功时返回）' },
      { name: 'message', type: 'string', required: true, description: '响应消息' },
    ],
    example: JSON.stringify({
      type: 'register_response',
      requestId: '507f1f77bcf86cd799439011',
      timestamp: 1640000000100,
      data: {
        success: true,
        agentId: '507f191e810c19729de860ea',
        message: '注册成功'
      }
    }, null, 2)
  }
};


// 心跳事件数据
const heartbeatEventData: EventData = {
  eventName: 'heartbeat',
  direction: 'client-to-server',
  pairedEvent: 'heartbeat_response',
  description: 'Agent 定期向服务端发送心跳，上报当前状态和系统资源使用情况',
  request: {
    name: 'HeartbeatRequest',
    description: 'Agent 心跳请求数据结构',
    fields: [
      { name: 'agentId', type: 'string', required: true, description: 'Agent ID（注册时获得）' },
      { name: 'status', type: 'string', required: true, description: 'Agent 状态', enumValues: ['idle', 'busy'] },
      { name: 'currentTasks', type: 'number', required: true, description: '当前正在执行的任务数' },
      { name: 'cpuCores', type: 'number', required: true, description: 'CPU 核心数' },
      { name: 'cpuModel', type: 'string', required: true, description: 'CPU 型号' },
      { name: 'osVersion', type: 'string', required: true, description: '详细 OS 版本' },
      { name: 'memoryTotal', type: 'number', required: true, description: '总内存（字节）' },
      { name: 'diskTotal', type: 'number', required: true, description: '总磁盘（字节）' },
      { name: 'publicIp', type: 'string', required: true, description: '公网 IP' },
      {
        name: 'systemInfo', type: 'object', required: true, description: '系统实时资源使用情况',
        nested: {
          name: 'SystemInfo',
          description: '系统资源使用情况',
          fields: [
            { name: 'cpuUsage', type: 'number', required: true, description: 'CPU 实际使用量（核数），如 2.5 表示使用了 2.5 个核心' },
            { name: 'memoryUsage', type: 'number', required: true, description: '内存实际使用量（字节）' },
            { name: 'diskUsage', type: 'number', required: true, description: '硬盘实际使用量（字节）' },
          ],
          example: ''
        }
      },
    ],
    example: JSON.stringify({
      type: 'heartbeat',
      requestId: '507f1f77bcf86cd799439012',
      timestamp: 1640000030000,
      data: {
        agentId: '507f191e810c19729de860ea',
        status: 'idle',
        currentTasks: 0,
        cpuCores: 8,
        cpuModel: 'Intel Core i7-9700K',
        osVersion: 'ubuntu 22.04',
        memoryTotal: 17179869184,
        diskTotal: 536870912000,
        publicIp: '203.0.113.1',
        systemInfo: {
          cpuUsage: 1.5,
          memoryUsage: 4294967296,
          diskUsage: 107374182400
        }
      }
    }, null, 2)
  },
  response: {
    name: 'HeartbeatResponse',
    description: '服务端心跳响应数据结构',
    fields: [
      { name: 'success', type: 'boolean', required: true, description: '是否成功' },
    ],
    example: JSON.stringify({
      type: 'heartbeat_response',
      requestId: '507f1f77bcf86cd799439012',
      timestamp: 1640000030100,
      data: { success: true }
    }, null, 2)
  }
};


// 任务分发事件数据
const taskDispatchEventData: EventData = {
  eventName: 'task_dispatch',
  direction: 'server-to-client',
  description: '服务端向 Agent 下发构建任务',
  request: {
    name: 'TaskDispatchRequest',
    description: '任务分发请求数据结构',
    fields: [
      { name: 'taskId', type: 'string', required: true, description: '任务 ID' },
      { name: 'taskType', type: 'string', required: true, description: '任务类型' },
      {
        name: 'buildConfig', type: 'object', required: true, description: '构建配置',
        nested: {
          name: 'BuildConfig',
          description: '构建配置详情',
          fields: [
            { name: 'branch', type: 'string', required: true, description: 'Git 分支' },
            { name: 'tagPrefix', type: 'string', required: true, description: '标签前缀' },
            { name: 'devopsPath', type: 'string', required: true, description: 'DevOps 路径' },
            { name: 'businessLineId', type: 'number', required: true, description: '业务线 ID' },
            {
              name: 'projectDefine', type: 'object', required: true, description: '项目定义',
              nested: {
                name: 'ProjectDefine',
                description: '项目定义详情',
                fields: [
                  { name: 'group', type: 'string', required: true, description: '项目组' },
                  { name: 'url', type: 'string', required: true, description: '项目 Git URL' },
                  { name: 'name', type: 'string', required: true, description: '项目名称' },
                  { name: 'type', type: 'string', required: true, description: '项目类型' },
                  { name: 'dockerfilePath', type: 'string', required: true, description: 'Dockerfile 路径' },
                  { name: 'ossName', type: 'string', required: true, description: 'OSS 名称' },
                ],
                example: ''
              }
            },
            {
              name: 'gitlabConfig', type: 'object', required: true, description: 'GitLab 配置',
              nested: {
                name: 'GitlabConfig',
                description: 'GitLab 配置详情',
                fields: [
                  { name: 'baseUrl', type: 'string', required: true, description: 'GitLab 基础 URL' },
                  { name: 'token', type: 'string', required: true, description: 'GitLab 访问令牌' },
                ],
                example: ''
              }
            },
            {
              name: 'dockerConfig', type: 'object', required: true, description: 'Docker 配置',
              nested: {
                name: 'DockerConfig',
                description: 'Docker 仓库配置详情',
                fields: [
                  { name: 'repo', type: 'string', required: true, description: 'Docker 仓库地址' },
                  { name: 'username', type: 'string', required: true, description: '用户名' },
                  { name: 'password', type: 'string', required: true, description: '密码' },
                ],
                example: ''
              }
            },
            {
              name: 'ossConfig', type: 'object', required: true, description: 'OSS 配置',
              nested: {
                name: 'OssConfig',
                description: 'OSS 存储配置详情',
                fields: [
                  { name: 'endpoint', type: 'string', required: true, description: 'OSS 端点' },
                  { name: 'bucket', type: 'string', required: true, description: '存储桶名称' },
                  { name: 'accessKey', type: 'string', required: true, description: '访问密钥' },
                  { name: 'accessSecret', type: 'string', required: true, description: '访问密钥密码' },
                  { name: 'region', type: 'string', required: true, description: '区域' },
                ],
                example: ''
              }
            },
          ],
          example: ''
        }
      },
    ],
    example: JSON.stringify({
      type: 'task_dispatch',
      requestId: '507f1f77bcf86cd799439013',
      timestamp: 1640000060000,
      data: {
        taskId: '507f191e810c19729de860eb',
        taskType: 'build',
        buildConfig: {
          branch: 'main',
          tagPrefix: 'v1.0',
          devopsPath: '/devops',
          businessLineId: 1,
          projectDefine: {
            group: 'frontend',
            url: 'https://gitlab.com/example/project.git',
            name: 'web-app',
            type: 'nodejs',
            dockerfilePath: './Dockerfile',
            ossName: 'web-app-assets'
          },
          gitlabConfig: {
            baseUrl: 'https://gitlab.com',
            token: 'glpat-xxxxxxxxxxxx'
          },
          dockerConfig: {
            repo: 'docker.io/myorg',
            username: 'myuser',
            password: 'mypassword'
          },
          ossConfig: {
            endpoint: 'oss-cn-hangzhou.aliyuncs.com',
            bucket: 'my-bucket',
            accessKey: 'LTAI5txxxxxxxxxx',
            accessSecret: 'xxxxxxxxxxxxxxxx',
            region: 'cn-hangzhou'
          }
        }
      }
    }, null, 2)
  }
};


// 任务更新事件数据
const taskUpdateEventData: EventData = {
  eventName: 'task_update',
  direction: 'client-to-server',
  description: 'Agent 向服务端上报任务执行进度和状态',
  request: {
    name: 'TaskUpdateRequest',
    description: '任务状态更新请求数据结构',
    fields: [
      { name: 'taskId', type: 'string', required: true, description: '任务 ID' },
      { name: 'status', type: 'string', required: true, description: '任务状态', enumValues: ['pending', 'building', 'success', 'failed', 'skipped'] },
      { name: 'progress', type: 'number', required: true, description: '进度百分比（0-100）' },
      { name: 'message', type: 'string', required: true, description: '状态消息' },
    ],
    example: JSON.stringify({
      type: 'task_update',
      requestId: '507f1f77bcf86cd799439014',
      timestamp: 1640000090000,
      data: {
        taskId: '507f191e810c19729de860eb',
        status: 'building',
        progress: 50,
        message: '正在构建 Docker 镜像...'
      }
    }, null, 2)
  }
};

// 任务完成事件数据
const taskCompleteEventData: EventData = {
  eventName: 'task_complete',
  direction: 'client-to-server',
  description: 'Agent 向服务端上报任务执行完成结果',
  request: {
    name: 'TaskCompleteRequest',
    description: '任务完成请求数据结构',
    fields: [
      { name: 'taskId', type: 'string', required: true, description: '任务 ID' },
      { name: 'status', type: 'string', required: true, description: '最终任务状态', enumValues: ['success', 'failed', 'skipped'] },
      {
        name: 'result', type: 'object', required: false, description: '任务执行结果',
        nested: {
          name: 'TaskResult',
          description: '任务执行结果详情',
          fields: [
            { name: 'newTag', type: 'string', required: true, description: '新生成的标签' },
            { name: 'duration', type: 'number', required: true, description: '执行时长（毫秒）' },
            { name: 'successCount', type: 'number', required: true, description: '成功数' },
            { name: 'failCount', type: 'number', required: true, description: '失败数' },
            { name: 'frontend', type: 'array', required: false, description: '前端构建产物列表' },
            { name: 'backend', type: 'array', required: false, description: '后端构建产物列表' },
          ],
          example: ''
        }
      },
    ],
    example: JSON.stringify({
      type: 'task_complete',
      requestId: '507f1f77bcf86cd799439015',
      timestamp: 1640000120000,
      data: {
        taskId: '507f191e810c19729de860eb',
        status: 'success',
        result: {
          newTag: 'v1.0.1',
          duration: 60000,
          successCount: 2,
          failCount: 0,
          frontend: ['docker.io/myorg/web-app:v1.0.1'],
          backend: ['docker.io/myorg/api-server:v1.0.1']
        }
      }
    }, null, 2)
  }
};

// 日志推送事件数据
const logPushEventData: EventData = {
  eventName: 'log_push',
  direction: 'client-to-server',
  description: 'Agent 向服务端实时推送构建日志',
  request: {
    name: 'LogPushRequest',
    description: '日志推送请求数据结构',
    fields: [
      { name: 'taskId', type: 'string', required: true, description: '任务 ID' },
      { name: 'businessLineId', type: 'number', required: true, description: '业务线 ID（用于路由日志到前端）' },
      {
        name: 'logs', type: 'array', required: true, description: '日志条目数组',
        nested: {
          name: 'LogEntry',
          description: '日志条目',
          fields: [
            { name: 'timestamp', type: 'number', required: true, description: '时间戳（毫秒）' },
            { name: 'level', type: 'string', required: true, description: '日志级别', enumValues: ['info', 'warn', 'error'] },
            { name: 'message', type: 'string', required: true, description: '日志消息内容' },
          ],
          example: ''
        }
      },
    ],
    example: JSON.stringify({
      type: 'log_push',
      requestId: '507f1f77bcf86cd799439016',
      timestamp: 1640000100000,
      data: {
        taskId: '507f191e810c19729de860eb',
        businessLineId: 1,
        logs: [
          { timestamp: 1640000100000, level: 'info', message: '开始克隆代码...' },
          { timestamp: 1640000105000, level: 'info', message: '代码克隆完成' },
          { timestamp: 1640000110000, level: 'info', message: '开始构建 Docker 镜像...' }
        ]
      }
    }, null, 2)
  }
};

// 任务取消事件数据
const taskCancelEventData: EventData = {
  eventName: 'task_cancel',
  direction: 'server-to-client',
  description: '服务端通知 Agent 取消正在执行的任务',
  request: {
    name: 'TaskCancelRequest',
    description: '任务取消请求数据结构',
    fields: [
      { name: 'taskId', type: 'string', required: true, description: '任务 ID' },
      { name: 'reason', type: 'string', required: true, description: '取消原因' },
    ],
    example: JSON.stringify({
      type: 'task_cancel',
      requestId: '507f1f77bcf86cd799439017',
      timestamp: 1640000095000,
      data: {
        taskId: '507f191e810c19729de860eb',
        reason: '用户手动取消'
      }
    }, null, 2)
  }
};


// ============= HTML 文档内容 =============

const overviewContent = `<div class="page-doc">
  <div class="page-hero">
    <div class="page-hero-icon">🤖</div>
    <h1>Build Agent 接入指南</h1>
    <p>构建代理组件，通过 WebSocket 实现任务的实时分发、状态更新和日志推送</p>
  </div>

  <div class="page-cards">
    <div class="page-card">
      <div class="page-card-icon" style="background:#e8f4fd;color:#1890ff">⚡</div>
      <div class="page-card-body">
        <h3>任务执行</h3>
        <p>接收服务端分发的构建任务，执行构建流程</p>
      </div>
    </div>
    <div class="page-card">
      <div class="page-card-icon" style="background:#fff0f6;color:#eb2f96">💬</div>
      <div class="page-card-body">
        <h3>实时通信</h3>
        <p>通过 WebSocket 保持与服务端的长连接</p>
      </div>
    </div>
    <div class="page-card">
      <div class="page-card-icon" style="background:#f6ffed;color:#52c41a">📊</div>
      <div class="page-card-body">
        <h3>状态上报</h3>
        <p>实时上报任务执行状态和进度</p>
      </div>
    </div>
    <div class="page-card">
      <div class="page-card-icon" style="background:#fff7e6;color:#fa8c16">📝</div>
      <div class="page-card-body">
        <h3>日志推送</h3>
        <p>将构建日志实时推送到服务端</p>
      </div>
    </div>
    <div class="page-card">
      <div class="page-card-icon" style="background:#f9f0ff;color:#722ed1">📈</div>
      <div class="page-card-body">
        <h3>资源监控</h3>
        <p>定期上报系统资源使用情况</p>
      </div>
    </div>
  </div>

  <div class="page-section">
    <h2>通信协议</h2>
    <p class="page-section-desc">Build Agent 使用 WebSocket 协议与服务端通信，所有消息均为 JSON 格式</p>
    <div class="ws-protocol-grid">
      <div class="ws-event-card ws-card-up" style="--delay:0ms" data-event-id="event-register">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <span class="ws-direction-label">Client → Server</span>
        </div>
        <div class="ws-event-name">register</div>
        <div class="ws-event-desc">Agent 启动时向服务端注册</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-down" style="--delay:60ms" data-event-id="event-register">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </div>
          <span class="ws-direction-label">Server → Client</span>
        </div>
        <div class="ws-event-name">register_response</div>
        <div class="ws-event-desc">服务端返回注册结果</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-up" style="--delay:120ms" data-event-id="event-heartbeat">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <span class="ws-direction-label">Client → Server</span>
        </div>
        <div class="ws-event-name">heartbeat</div>
        <div class="ws-event-desc">定期发送心跳保持连接</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-down" style="--delay:180ms" data-event-id="event-heartbeat">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </div>
          <span class="ws-direction-label">Server → Client</span>
        </div>
        <div class="ws-event-name">heartbeat_response</div>
        <div class="ws-event-desc">服务端心跳响应</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-down" style="--delay:240ms" data-event-id="event-task-dispatch">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </div>
          <span class="ws-direction-label">Server → Client</span>
        </div>
        <div class="ws-event-name">task_dispatch</div>
        <div class="ws-event-desc">服务端下发构建任务</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-up" style="--delay:300ms" data-event-id="event-task-update">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <span class="ws-direction-label">Client → Server</span>
        </div>
        <div class="ws-event-name">task_update</div>
        <div class="ws-event-desc">Agent 上报任务执行状态</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-up" style="--delay:360ms" data-event-id="event-task-complete">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <span class="ws-direction-label">Client → Server</span>
        </div>
        <div class="ws-event-name">task_complete</div>
        <div class="ws-event-desc">Agent 上报任务执行结果</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-up" style="--delay:420ms" data-event-id="event-log-push">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <span class="ws-direction-label">Client → Server</span>
        </div>
        <div class="ws-event-name">log_push</div>
        <div class="ws-event-desc">Agent 推送构建日志</div>
        <div class="ws-card-pulse"></div>
      </div>
      <div class="ws-event-card ws-card-down" style="--delay:480ms" data-event-id="event-task-cancel">
        <div class="ws-card-glow"></div>
        <div class="ws-card-header">
          <div class="ws-direction-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </div>
          <span class="ws-direction-label">Server → Client</span>
        </div>
        <div class="ws-event-name">task_cancel</div>
        <div class="ws-event-desc">服务端取消正在执行的任务</div>
        <div class="ws-card-pulse"></div>
      </div>
    </div>
  </div>

  <div class="page-section">
    <h2>接入流程</h2>
    <div class="steps-list">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-body">
          <h4>获取认证 Token</h4>
          <p>在 EZDP 管理界面创建 Build Agent，系统自动生成唯一认证 Token</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-body">
          <h4>建立 WebSocket 连接</h4>
          <p>连接到服务端 WebSocket 端点 <code>ws://your-server/ws/agent</code></p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div class="step-body">
          <h4>发送注册请求</h4>
          <p>携带 Token 和 Agent 基本信息发送 <code>register</code> 事件</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">4</div>
        <div class="step-body">
          <h4>维持心跳</h4>
          <p>每 30 秒发送一次 <code>heartbeat</code> 事件，上报系统资源状态</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">5</div>
        <div class="step-body">
          <h4>接收并执行任务</h4>
          <p>监听 <code>task_dispatch</code> 事件，执行构建并实时上报进度</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">6</div>
        <div class="step-body">
          <h4>上报完成结果</h4>
          <p>任务完成后发送 <code>task_complete</code> 事件上报最终结果</p>
        </div>
      </div>
    </div>
  </div>
</div>`;

const authenticationContent = `<div class="page-doc">
  <div class="page-hero">
    <div class="page-hero-icon">🔐</div>
    <h1>鉴权机制</h1>
    <p>基于 Token 的安全认证，确保只有授权的 Agent 才能接入</p>
  </div>

  <div class="page-section">
    <h2>Token 获取流程</h2>
    <p class="page-section-desc">在 EZDP 管理界面创建 Build Agent 时，系统会自动生成唯一的认证 Token</p>
    <div class="steps-list">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-body">
          <h4>创建 Build Agent</h4>
          <p>在 EZDP 管理界面进入 Build Agent 管理页面</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-body">
          <h4>填写 Agent 信息</h4>
          <p>输入 Agent 名称、描述等基本信息</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div class="step-body">
          <h4>获取认证 Token</h4>
          <p>系统自动生成唯一的认证 Token，请妥善保管</p>
        </div>
      </div>
    </div>
  </div>

  <div class="page-section">
    <h2>Token 使用</h2>
    <p class="page-section-desc">Agent 在注册时需要在 <code>data.token</code> 字段中携带 Token</p>
    <div class="code-block">
      <div class="code-header">
        <span class="code-lang">json</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block').querySelector('code').textContent).then(()=>{this.textContent='✓ 已复制';setTimeout(()=>this.textContent='复制',2000)})">复制</button>
      </div>
      <pre><code>{
  "type": "register",
  "requestId": "507f1f77bcf86cd799439011",
  "timestamp": 1640000000000,
  "data": {
    "token": "your-auth-token-here",
    "name": "build-agent-01",
    "hostname": "ubuntu-server",
    "ip": "192.168.1.100",
    "os": "linux",
    "arch": "amd64",
    "version": "1.0.0"
  }
}</code></pre>
    </div>
  </div>

  <div class="page-section">
    <h2>验证结果</h2>
    <div class="auth-result-grid">
      <div class="auth-result-card auth-success">
        <div class="auth-result-header">
          <div class="auth-result-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h4>验证通过</h4>
        </div>
        <div class="auth-result-body">
          <p>服务端返回注册成功响应</p>
          <div class="auth-result-fields">
            <div class="auth-field">
              <span class="auth-field-key">success</span>
              <span class="auth-field-value auth-value-true">true</span>
            </div>
            <div class="auth-field">
              <span class="auth-field-key">agentId</span>
              <span class="auth-field-value">"507f191e810c19729de860ea"</span>
            </div>
            <div class="auth-field">
              <span class="auth-field-key">message</span>
              <span class="auth-field-value">"注册成功"</span>
            </div>
          </div>
        </div>
      </div>
      <div class="auth-result-card auth-fail">
        <div class="auth-result-header">
          <div class="auth-result-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <h4>验证失败</h4>
        </div>
        <div class="auth-result-body">
          <p>Token 无效或已过期</p>
          <div class="auth-result-fields">
            <div class="auth-field">
              <span class="auth-field-key">success</span>
              <span class="auth-field-value auth-value-false">false</span>
            </div>
            <div class="auth-field">
              <span class="auth-field-key">message</span>
              <span class="auth-field-value">"Token 验证失败"</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="page-section">
    <h2>安全建议</h2>
    <div class="security-cards">
      <div class="security-card">
        <div class="security-card-icon" style="background:rgba(250,173,20,0.1);color:#faad14">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="security-card-body">
          <h4>妥善保管 Token</h4>
          <p>不要将 Token 提交到代码仓库或公开分享，避免泄露风险</p>
        </div>
      </div>
      <div class="security-card">
        <div class="security-card-icon" style="background:rgba(24,144,255,0.1);color:#1890ff">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </div>
        <div class="security-card-body">
          <h4>定期轮换 Token</h4>
          <p>建议定期更新 Token 以提高安全性，降低长期使用风险</p>
        </div>
      </div>
      <div class="security-card">
        <div class="security-card-icon" style="background:rgba(82,196,26,0.1);color:#52c41a">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div class="security-card-body">
          <h4>使用 WSS 加密传输</h4>
          <p>生产环境务必使用 <code>wss://</code> 协议，确保通信安全</p>
        </div>
      </div>
      <div class="security-card">
        <div class="security-card-icon" style="background:rgba(114,46,209,0.1);color:#722ed1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="security-card-body">
          <h4>限制 Token 权限</h4>
          <p>每个 Agent 使用独立 Token，避免共享，便于权限管理和追踪</p>
        </div>
      </div>
    </div>
  </div>
</div>`;

// ============= DeployAgent 鉴权文档内容 =============

const deployAgentAuthenticationContent = `<div class="page-doc">
  <div class="page-hero">
    <div class="page-hero-icon">🔐</div>
    <h1>鉴权机制</h1>
    <p>DeployAgent 使用 Token 认证机制确保只有授权的 Agent 才能接入平台</p>
  </div>

  <div class="page-section">
    <h2>Token 认证</h2>
    <p class="page-section-desc">所有 API 请求都需要在请求体中携带 <code>token</code> 字段进行鉴权</p>
    <div class="code-block">
      <div class="code-header">
        <span class="code-lang">json - 请求格式</span>
      </div>
      <pre><code>{
  "token": "your_agent_token_here",
  ...其他接口特定参数
}</code></pre>
    </div>
  </div>

  <div class="page-section">
    <h2>获取 Token</h2>
    <p class="page-section-desc">在 EZDP 平台创建 DeployAgent 时获取认证 Token</p>
    <div class="steps-list">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-body">
          <h4>登录 EZDP 平台</h4>
          <p>使用管理员账号登录</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-body">
          <h4>进入发布工具管理</h4>
          <p>在左侧导航栏找到发布工具管理入口</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div class="step-body">
          <h4>点击发布代理</h4>
          <p>进入 DeployAgent 管理页面</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">4</div>
        <div class="step-body">
          <h4>新增发布代理</h4>
          <p>填写代理名称，关联目标环境</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">5</div>
        <div class="step-body">
          <h4>获取 Token</h4>
          <p>创建成功后，系统生成唯一的 Agent Token</p>
        </div>
      </div>
    </div>
  </div>

  <div class="page-section">
    <h2>安全建议</h2>
    <div class="security-cards">
      <div class="security-card">
        <div class="security-card-icon" style="background:rgba(250,173,20,0.1);color:#faad14">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        </div>
        <div class="security-card-body">
          <h4>妥善保管 Token</h4>
          <p>Token 仅在创建时显示一次，请立即复制并妥善保管</p>
        </div>
      </div>
      <div class="security-card">
        <div class="security-card-icon" style="background:rgba(24,144,255,0.1);color:#1890ff">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div class="security-card-body">
          <h4>使用 HTTPS</h4>
          <p>生产环境务必使用 HTTPS 协议，确保通信安全</p>
        </div>
      </div>
    </div>
  </div>
</div>`;

// ============= DeployAgent 概述文档内容 =============

const deployAgentOverviewContent = `<div class="page-doc">
  <div class="deploy-agent-overview">
    <!-- 头部标题区域 -->
    <div class="overview-header">
      <h1>DeployAgent API 接口</h1>
      <p class="overview-desc">通过标准 HTTP API 实现版本发布，支持 K8s、OSS、OBS、Shell 等多种部署方式</p>
    </div>

    <!-- 核心特性 -->
    <div class="features-grid">
      <div class="feature-item">
        <div class="feature-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">🔒</div>
        <div class="feature-content">
          <h3>安全隔离</h3>
          <p>K8s、OSS、OBS 等敏感凭证存储在本地配置文件，不上传服务器</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">⚡</div>
        <div class="feature-content">
          <h3>本地执行</h3>
          <p>在生产环境服务器上直接执行部署操作，网络延迟低</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">📦</div>
        <div class="feature-content">
          <h3>灵活发布</h3>
          <p>支持全量/增量/单项目发布，灵活控制发布范围和策略</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">🔌</div>
        <div class="feature-content">
          <h3>易于接入</h3>
          <p>标准 RESTful API 设计，支持任何编程语言实现自定义 Agent</p>
        </div>
      </div>
    </div>

    <!-- 快速开始 -->
    <div class="quick-start">
      <h2>快速开始</h2>
      <div class="start-steps">
        <div class="start-step">
          <div class="step-number">1</div>
          <div class="step-text">
            <h4>获取 Token</h4>
            <p>在 EZDP 平台创建 DeployAgent，系统会生成唯一的认证 Token</p>
          </div>
        </div>
        <div class="start-step">
          <div class="step-number">2</div>
          <div class="step-text">
            <h4>配置 Agent</h4>
            <p>设置平台域名、Token 以及各环境的部署配置（K8s、OSS、OBS）</p>
          </div>
        </div>
        <div class="start-step">
          <div class="step-number">3</div>
          <div class="step-text">
            <h4>调用 API</h4>
            <p>使用 HTTP API 获取版本信息并执行部署，完成后上报结果</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 通信协议 -->
    <div class="protocol-section">
      <h2>通信协议</h2>
      <div class="protocol-grid">
        <div class="protocol-item">
          <div class="protocol-label">协议</div>
          <div class="protocol-value">HTTP / HTTPS</div>
        </div>
        <div class="protocol-item">
          <div class="protocol-label">方法</div>
          <div class="protocol-value">POST</div>
        </div>
        <div class="protocol-item">
          <div class="protocol-label">格式</div>
          <div class="protocol-value">application/json</div>
        </div>
        <div class="protocol-item">
          <div class="protocol-label">编码</div>
          <div class="protocol-value">UTF-8</div>
        </div>
        <div class="protocol-item">
          <div class="protocol-label">鉴权</div>
          <div class="protocol-value">Token (请求体)</div>
        </div>
      </div>
    </div>

    <!-- 接入信息 -->
    <div class="access-info">
      <h2>接入信息</h2>
      <div class="access-grid">
        <div class="access-card">
          <div class="access-icon">🌐</div>
          <div class="access-content">
            <h4>平台域名</h4>
            <code>https://simple.plaso.cn</code>
            <p>生产环境推荐域名</p>
          </div>
        </div>
        <div class="access-card">
          <div class="access-icon">📡</div>
          <div class="access-content">
            <h4>API 基础路径</h4>
            <code>/server/ezdp</code>
            <p>所有 API 请求前缀</p>
          </div>
        </div>
        <div class="access-card">
          <div class="access-icon">🔑</div>
          <div class="access-content">
            <h4>接口路径示例</h4>
            <code>/nc/deployAgent/getAgentInfo</code>
            <p>无需登录认证的接口</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 支持的部署方式 -->
    <div class="deploy-types">
      <h2>支持的部署方式</h2>
      <div class="deploy-type-list">
        <div class="deploy-type">
          <div class="deploy-type-icon">☸️</div>
          <h4>Kubernetes</h4>
          <p>支持 Deployment 和 CronJob 资源的更新部署</p>
        </div>
        <div class="deploy-type">
          <div class="deploy-type-icon">📦</div>
          <h4>阿里云 OSS</h4>
          <p>静态资源上传到 OSS，支持 CDN 加速</p>
        </div>
        <div class="deploy-type">
          <div class="deploy-type-icon">🗳️</div>
          <h4>移动云 OBS</h4>
          <p>静态资源上传到 OBS，支持移动云 CDN</p>
        </div>
        <div class="deploy-type">
          <div class="deploy-type-icon">📜</div>
          <h4>Shell 脚本</h4>
          <p>执行自定义 Shell 脚本，灵活适配各种场景</p>
        </div>
      </div>
    </div>
  </div>
</div>`;

// ============= DeployAgent HTTP API 数据定义 =============

const getAgentInfoApiData = {
  apiName: '获取代理信息',
  apiPath: 'POST /nc/deployAgent/getAgentInfo',
  description: '验证 Token 并获取代理基本信息和可访问的环境列表',
  request: {
    name: 'GetAgentInfoRequest',
    description: '获取代理信息请求参数',
    fields: [
      { name: 'token', type: 'string', required: true, description: '代理 Token' }
    ],
    example: JSON.stringify({
      token: 'your-agent-token-here'
    }, null, 2)
  },
  response: {
    name: 'GetAgentInfoResponse',
    description: '获取代理信息响应数据',
    fields: [
      { name: 'id', type: 'string', required: true, description: '代理 ID' },
      { name: 'businessLineId', type: 'number', required: true, description: '业务线 ID' },
      { name: 'businessLineName', type: 'string', required: true, description: '业务线名称' },
      { name: 'name', type: 'string', required: true, description: '代理名称' },
      { name: 'environments', type: 'array', required: true, description: '可访问的环境列表',
        nested: {
          name: 'EnvironmentInfo',
          description: '环境信息',
          fields: [
            { name: 'id', type: 'string', required: true, description: '环境 ID' },
            { name: 'name', type: 'string', required: true, description: '环境名称' },
            { name: 'description', type: 'string', required: true, description: '环境描述' },
            { name: 'backendSecretName', type: 'string', required: true, description: 'K8s 集群名称（用于本地配置匹配）' },
            { name: 'backendNamespace', type: 'string', required: true, description: 'K8s Namespace' },
            { name: 'frontendStorageName', type: 'string', required: true, description: '对象存储名称（用于本地配置匹配）' },
            { name: 'frontendBaseUrl', type: 'string', required: true, description: '前端发布路径' },
            { name: 'currentVersion', type: 'string', required: true, description: '当前环境运行的版本号' },
            { name: 'currentBuildVersionId', type: 'string', required: true, description: '当前环境运行的构建版本 ID' }
          ],
          example: ''
        }
      }
    ],
    example: ''
  },
  example: JSON.stringify({
    id: '6954c2d1b0da271a3f4a7b07',
    businessLineId: 2,
    businessLineName: '融课',
    name: '阿里云发布代理',
    environments: [
      {
        id: '6954c288b0da271a3f4a7b06',
        name: 'rongke-www',
        description: '阿里云生产环境',
        backendSecretName: '',
        backendNamespace: '',
        frontendStorageName: '',
        frontendBaseUrl: '',
        currentVersion: '2.41.30',
        currentBuildVersionId: '69d4fb0bb0da27894703e0ff'
      }
    ]
  }, null, 2)
};

const getBranchesApiData = {
  apiName: '获取分支列表',
  apiPath: 'POST /nc/deployAgent/getBranches',
  description: '获取指定业务线的所有可发布分支',
  request: {
    name: 'GetBranchesRequest',
    description: '获取分支列表请求参数',
    fields: [
      { name: 'token', type: 'string', required: true, description: '代理 Token' },
      { name: 'businessLineId', type: 'number', required: true, description: '业务线 ID' }
    ],
    example: JSON.stringify({
      token: 'your-agent-token-here',
      businessLineId: 2
    }, null, 2)
  },
  response: {
    name: 'GetBranchesResponse',
    description: '获取分支列表响应数据',
    fields: [
      { name: 'id', type: 'string', required: true, description: '分支 ID' },
      { name: 'name', type: 'string', required: true, description: '分支名称' },
      { name: 'description', type: 'string', required: true, description: '分支描述' },
      { name: 'enabled', type: 'boolean', required: true, description: '是否启用' }
    ],
    example: JSON.stringify([
      { id: '69d609bdb0da27894703e12b', name: '2.43', description: '20260420', enabled: true }
    ], null, 2)
  },
  example: JSON.stringify([
    { id: '69d609bdb0da27894703e12b', name: '2.43', description: '20260420', enabled: true }
  ], null, 2)
};

const getVersionsByBranchApiData = {
  apiName: '获取版本列表',
  apiPath: 'POST /nc/deployAgent/getVersionsByBranch',
  description: '分页获取指定分支下的构建版本',
  request: {
    name: 'GetVersionsByBranchRequest',
    description: '获取版本列表请求参数',
    fields: [
      { name: 'token', type: 'string', required: true, description: '代理 Token' },
      { name: 'branchId', type: 'string', required: true, description: '分支 ID' },
      { name: 'pageIndex', type: 'number', required: true, description: '页码，从 1 开始' },
      { name: 'pageSize', type: 'number', required: true, description: '每页数量（最大 100）' }
    ],
    example: JSON.stringify({
      token: 'your-agent-token-here',
      branchId: '69d609bdb0da27894703e12b',
      pageIndex: 1,
      pageSize: 20
    }, null, 2)
  },
  response: {
    name: 'GetVersionsByBranchResponse',
    description: '获取版本列表响应数据',
    fields: [
      { name: 'total', type: 'number', required: true, description: '总记录数' },
      { name: 'list', type: 'array', required: true, description: '版本列表',
        nested: {
          name: 'VersionInfo',
          description: '版本信息',
          fields: [
            { name: 'id', type: 'string', required: true, description: '版本 ID' },
            { name: 'version', type: 'string', required: true, description: '版本号' },
            { name: 'description', type: 'string', required: true, description: '版本描述' },
            { name: 'status', type: 'string', required: true, description: '版本状态' },
            { name: 'buildTime', type: 'number', required: true, description: '构建时间（毫秒时间戳）' }
          ],
          example: ''
        }
      }
    ],
    example: JSON.stringify({
    total: 13,
    list: [
      {
        id: '69e61817b0da272fd15c917a',
        version: '2.43.12',
        description: '',
        status: 'failed',
        buildTime: 1776687127793
      },
      {
        id: '69e5f647b0da272fd15c910d',
        version: '2.43.11',
        description: '',
        status: 'success',
        buildTime: 1776678471678
      },
      {
        id: '69e5e936b0da272fd15c90d8',
        version: '2.43.10',
        description: '',
        status: 'success',
        buildTime: 1776675126842
      }
    ]
  }, null, 2)
}}

const getVersionDetailApiData = {
  apiName: '获取版本详情',
  apiPath: 'POST /nc/deployAgent/getVersionDetail',
  description: '获取指定版本包含的所有项目部署配置',
  request: {
    name: 'GetVersionDetailRequest',
    description: '获取版本详情请求参数',
    fields: [
      { name: 'token', type: 'string', required: true, description: '代理 Token' },
      { name: 'buildVersionId', type: 'string', required: true, description: '构建版本 ID' }
    ],
    example: JSON.stringify({
      token: 'your-agent-token-here',
      buildVersionId: '69e61817b0da272fd15c917a'
    }, null, 2)
  },
  response: {
    name: 'GetVersionDetailResponse',
    description: '获取版本详情响应数据',
    fields: [
      { name: 'version', type: 'string', required: true, description: '版本号' },
      { name: 'description', type: 'string', required: true, description: '版本描述' },
      { name: 'buildTime', type: 'number', required: true, description: '构建时间（毫秒时间戳）' },
      { name: 'projects', type: 'array', required: true, description: '项目列表',
        nested: {
          name: 'ProjectVersionInfo',
          description: '项目版本信息',
          fields: [
            { name: 'projectConfigId', type: 'string', required: true, description: '项目配置 ID' },
            { name: 'projectName', type: 'string', required: true, description: '项目名称' },
            { name: 'projectType', type: 'string', required: true, description: '项目类型：frontend/backend' },
            { name: 'version', type: 'string', required: true, description: '项目版本号' },
            { name: 'imageName', type: 'string', required: true, description: 'Docker 镜像名称' },
            { name: 'imageTag', type: 'string', required: true, description: 'Docker 镜像 Tag' },
            { name: 'deployType', type: 'string', required: true, description: '部署类型：k8s/ossutil/obscmd/script' },
            { name: 'k8sName', type: 'string', required: false, description: 'K8s 资源名称' },
            { name: 'k8sType', type: 'string', required: false, description: 'K8s 资源类型：deployment/cronjob' },
            { name: 'k8sContainerName', type: 'string', required: false, description: '容器名称' },
            { name: 'ossPath', type: 'string', required: false, description: 'OSS 源路径' },
            { name: 'ossBucket', type: 'string', required: false, description: 'OSS Bucket（源）' },
            { name: 'ossPrefix', type: 'string', required: false, description: 'OSS 目标路径前缀' },
            { name: 'ossTargetName', type: 'string', required: false, description: 'OSS 目标文件夹名称' },
            { name: 'obsBucket', type: 'string', required: false, description: 'OBS Bucket（目标）' },
            { name: 'obsPrefix', type: 'string', required: false, description: 'OBS 目标路径前缀' },
            { name: 'obsTargetName', type: 'string', required: false, description: 'OBS 目标文件夹名称' },
            { name: 'scriptContent', type: 'string', required: false, description: '脚本内容' }
          ],
          example: ''
        }
      }
    ],
    example: ''
  },
  example: JSON.stringify({
    version: '2.43.12',
    description: '',
    buildTime: 1776687127793,
    projects: [
      {
        projectConfigId: '1',
        projectName: 'manage_service',
        projectType: 'backend',
        version: '2.43.5',
        imageName: 'docker-yizhong.plaso.cn/manage_service',
        imageTag: '2.43.5',
        deployType: 'k8s',
        k8sName: 'manage-service',
        k8sType: 'deployment',
        k8sContainerName: 'main',
        ossPath: '',
        ossBucket: '',
        ossPrefix: '',
        ossTargetName: '',
        obsBucket: '',
        obsPrefix: '',
        obsTargetName: '',
        scriptContent: ''
      },
      {
        projectConfigId: '693d7c31c3666ea79b418289',
        projectName: 'manageweb',
        projectType: 'frontend',
        version: '2.43.8',
        imageName: 'docker-yizhong.plaso.cn/manageweb',
        imageTag: '2.43.8',
        deployType: 'ossutil',
        k8sName: '',
        k8sType: '',
        k8sContainerName: '',
        ossPath: 'static/build/2.43.8/manage',
        ossBucket: 'plaso-school',
        ossPrefix: '',
        ossTargetName: 'manage',
        obsBucket: '',
        obsPrefix: '',
        obsTargetName: '',
        scriptContent: ''
      }
    ]
  }, null, 2)
};

const submitDeployResultApiData = {
  apiName: '提交部署结果',
  apiPath: 'POST /nc/deployAgent/submitDeployResult',
  description: '部署完成后上报执行结果，更新环境版本记录',
  request: {
    name: 'SubmitDeployResultRequest',
    description: '提交部署结果请求参数',
    fields: [
      { name: 'token', type: 'string', required: true, description: '代理 Token' },
      { name: 'deployEnvironmentId', type: 'string', required: true, description: '部署环境 ID' },
      { name: 'buildVersionId', type: 'string', required: true, description: '构建版本 ID' },
      { name: 'isFullDeploy', type: 'boolean', required: true, description: '是否全量部署' },
      { name: 'startedAt', type: 'number', required: true, description: '开始时间（毫秒时间戳）' },
      { name: 'finishedAt', type: 'number', required: true, description: '结束时间（毫秒时间戳）' },
      { name: 'projectResults', type: 'array', required: true, description: '各项目部署结果',
        nested: {
          name: 'ProjectDeployResult',
          description: '单个项目部署结果',
          fields: [
            { name: 'projectConfigId', type: 'string', required: true, description: '项目配置 ID' },
            { name: 'projectName', type: 'string', required: true, description: '项目名称' },
            { name: 'status', type: 'string', required: true, description: '部署状态', enumValues: ['success', 'failed'] },
            { name: 'errorMessage', type: 'string', required: false, description: '错误信息（失败时必填）' },
            { name: 'deployLogs', type: 'string', required: false, description: '部署日志' }
          ],
          example: ''
        }
      }
    ],
    example: JSON.stringify({
      token: 'your-agent-token-here',
      deployEnvironmentId: '6954c288b0da271a3f4a7b06',
      buildVersionId: '69e61817b0da272fd15c917a',
      isFullDeploy: false,
      startedAt: 1745169600000,
      finishedAt: 1745169720000,
      projectResults: [
        {
          projectConfigId: '1',
          projectName: 'manage_service',
          status: 'success',
          errorMessage: '',
          deployLogs: 'Deployment updated successfully'
        },
        {
          projectConfigId: '693d7c31c3666ea79b418289',
          projectName: 'manageweb',
          status: 'failed',
          errorMessage: 'OSS upload failed: connection timeout',
          deployLogs: 'Uploading to OSS...'
        }
      ]
    }, null, 2)
  },
  response: {
    name: 'SubmitDeployResultResponse',
    description: '提交部署结果响应数据',
    fields: [
      { name: 'deployTaskId', type: 'string', required: true, description: '部署任务 ID' },
      { name: 'success', type: 'boolean', required: true, description: '是否成功' },
      { name: 'message', type: 'string', required: true, description: '响应消息' }
    ],
    example: ''
  },
  example: JSON.stringify({
    deployTaskId: 'task-001',
    success: true,
    message: '部署结果已上报'
  }, null, 2)
};

// ============= 文档树结构 =============
export const docList: DocItem[] = [
  {
    id: 'deployAgent',
    title: 'DeployAgent API 接口',
    description: '发布代理 HTTP API 接口文档',
    isCategory: true,
    children: [
      {
        id: 'deployAgent-overview',
        title: '概述',
        apiType: 'markdown',
        fileName: 'deploy-agent/overview.md',
      },
      {
        id: 'deployAgent-authentication',
        title: '鉴权机制',
        apiType: 'markdown',
        fileName: 'deploy-agent/authentication.md',
      },
      {
        id: 'deployAgent-api',
        title: 'HTTP API 接口',
        isCategory: true,
        children: [
          {
            id: 'deployAgent-getAgentInfo',
            title: '获取代理信息',
            description: 'POST /nc/deployAgent/getAgentInfo',
            apiType: 'httpApi',
            httpApiData: getAgentInfoApiData,
          },
          {
            id: 'deployAgent-getBranches',
            title: '获取分支列表',
            description: 'POST /nc/deployAgent/getBranches',
            apiType: 'httpApi',
            httpApiData: getBranchesApiData,
          },
          {
            id: 'deployAgent-getVersionsByBranch',
            title: '获取版本列表',
            description: 'POST /nc/deployAgent/getVersionsByBranch',
            apiType: 'httpApi',
            httpApiData: getVersionsByBranchApiData,
          },
          {
            id: 'deployAgent-getVersionDetail',
            title: '获取版本详情',
            description: 'POST /nc/deployAgent/getVersionDetail',
            apiType: 'httpApi',
            httpApiData: getVersionDetailApiData,
          },
          {
            id: 'deployAgent-submitDeployResult',
            title: '提交部署结果',
            description: 'POST /nc/deployAgent/submitDeployResult',
            apiType: 'httpApi',
            httpApiData: submitDeployResultApiData,
          },
        ],
      },
    ],
  },
  {
    id: 'buildAgent',
    title: 'Build Agent 接入指南',
    description: '构建代理接入协议文档',
    isCategory: true,
    children: [
      {
        id: 'buildAgent-overview',
        title: '概述',
        apiType: 'markdown',
        fileName: 'build-agent/overview.md',
      },
      {
        id: 'buildAgent-authentication',
        title: '鉴权机制',
        apiType: 'markdown',
        fileName: 'build-agent/authentication.md',
      },
      {
        id: 'buildAgent-events',
        title: 'WebSocket 事件',
        isCategory: true,
        children: [
          {
            id: 'event-register',
            title: '注册事件',
            description: 'register / register_response',
            apiType: 'event',
            eventData: registerEventData,
          },
          {
            id: 'event-heartbeat',
            title: '心跳事件',
            description: 'heartbeat / heartbeat_response',
            apiType: 'event',
            eventData: heartbeatEventData,
          },
          {
            id: 'event-task-dispatch',
            title: '任务分发',
            description: 'task_dispatch',
            apiType: 'event',
            eventData: taskDispatchEventData,
          },
          {
            id: 'event-task-update',
            title: '任务更新',
            description: 'task_update',
            apiType: 'event',
            eventData: taskUpdateEventData,
          },
          {
            id: 'event-task-complete',
            title: '任务完成',
            description: 'task_complete',
            apiType: 'event',
            eventData: taskCompleteEventData,
          },
          {
            id: 'event-log-push',
            title: '日志推送',
            description: 'log_push',
            apiType: 'event',
            eventData: logPushEventData,
          },
          {
            id: 'event-task-cancel',
            title: '任务取消',
            description: 'task_cancel',
            apiType: 'event',
            eventData: taskCancelEventData,
          },
        ],
      },
    ],
  },
];

// ============= 辅助函数 =============

export function loadDocList(): DocItem[] {
  return docList;
}

export async function loadDocContent(fileName: string): Promise<string> {
  const contentMap: Record<string, string> = {
    'build-agent/overview.md': overviewContent,
    'build-agent/authentication.md': authenticationContent,
    'deploy-agent/overview.md': deployAgentOverviewContent,
    'deploy-agent/authentication.md': deployAgentAuthenticationContent,
  };

  const content = contentMap[fileName];
  if (!content) {
    throw new Error(`文档 ${fileName} 不存在`);
  }
  return content;
}

export function findDocItem(items: DocItem[], id: string): DocItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findDocItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}
