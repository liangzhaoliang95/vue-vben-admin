import type { DocItem, EventData, MessageSchema, FieldDefinition } from './types';

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

const quickstartContent = `<div class="page-doc">
  <div class="page-hero">
    <div class="page-hero-icon">🚀</div>
    <h1>快速开始</h1>
    <p>5 分钟快速部署 Build Agent</p>
  </div>

  <div class="page-section">
    <h2>前置条件</h2>
    <div class="page-cards">
      <div class="page-card">
        <div class="page-card-icon" style="background:#e8f4fd;color:#1890ff">🔧</div>
        <div class="page-card-body">
          <h3>Go 1.24.0+</h3>
          <p>需要 Go 编译环境</p>
        </div>
      </div>
      <div class="page-card">
        <div class="page-card-icon" style="background:#f6ffed;color:#52c41a">🔑</div>
        <div class="page-card-body">
          <h3>认证 Token</h3>
          <p>从管理界面获取</p>
        </div>
      </div>
      <div class="page-card">
        <div class="page-card-icon" style="background:#fff7e6;color:#fa8c16">🌐</div>
        <div class="page-card-body">
          <h3>网络连接</h3>
          <p>可访问 EZDP 服务端</p>
        </div>
      </div>
    </div>
  </div>

  <div class="page-section">
    <h2>安装</h2>
    <div class="code-block">
      <div class="code-header">
        <span class="code-lang">bash</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block').querySelector('code').textContent).then(()=>{this.textContent='✓ 已复制';setTimeout(()=>this.textContent='复制',2000)})">复制</button>
      </div>
      <pre><code># 克隆代码
git clone https://github.com/your-org/ezdp.git
cd ezdp/backend/agent/buildAgent/cmd/agent

# 编译
go build -o ezdp-agent .</code></pre>
    </div>
  </div>

  <div class="page-section">
    <h2>配置</h2>
    <p class="page-section-desc">创建配置文件 <code>config.yaml</code></p>
    <div class="code-block">
      <div class="code-header">
        <span class="code-lang">yaml</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block').querySelector('code').textContent).then(()=>{this.textContent='✓ 已复制';setTimeout(()=>this.textContent='复制',2000)})">复制</button>
      </div>
      <pre><code>server:
  url: "ws://your-server:8080/ws/agent"
  token: "your-auth-token"

agent:
  name: "agent-01"
  tags:
    - "linux"
    - "docker"

heartbeat:
  interval: 30s</code></pre>
    </div>
  </div>

  <div class="page-section">
    <h2>运行</h2>
    <div class="run-options">
      <div class="run-option">
        <h4>交互式运行</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">bash</span>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('./ezdp-agent -i').then(()=>{this.textContent='✓ 已复制';setTimeout(()=>this.textContent='复制',2000)})">复制</button>
          </div>
          <pre><code>./ezdp-agent -i</code></pre>
        </div>
      </div>
      <div class="run-option">
        <h4>指定配置文件运行</h4>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">bash</span>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('./ezdp-agent -c config.yaml').then(()=>{this.textContent='✓ 已复制';setTimeout(()=>this.textContent='复制',2000)})">复制</button>
          </div>
          <pre><code>./ezdp-agent -c config.yaml</code></pre>
        </div>
      </div>
    </div>
  </div>

  <div class="page-section">
    <div class="alert alert-success">
      <span class="alert-icon">✅</span>
      <div>
        <strong>验证</strong>
        <p>Agent 启动后会自动注册到服务端，可以在 EZDP 管理界面查看 Agent 状态</p>
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
    <h2>Token 获取</h2>
    <div class="alert alert-info">
      <span class="alert-icon">ℹ️</span>
      <div>
        <p>在 EZDP 管理界面创建 Build Agent 时，系统会自动生成唯一的认证 Token</p>
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
  "requestId": "uuid",
  "timestamp": 1234567890000,
  "data": {
    "token": "your-auth-token",
    "name": "agent-01"
  }
}</code></pre>
    </div>
  </div>

  <div class="page-section">
    <h2>验证结果</h2>
    <div class="result-cards">
      <div class="result-card result-success">
        <div class="result-icon">✅</div>
        <h4>验证通过</h4>
        <p>返回 <code>success: true</code> 和 <code>agentId</code></p>
      </div>
      <div class="result-card result-fail">
        <div class="result-icon">❌</div>
        <h4>验证失败</h4>
        <p>返回 <code>success: false</code> 和错误信息</p>
      </div>
    </div>
  </div>

  <div class="page-section">
    <h2>安全建议</h2>
    <div class="tips-list">
      <div class="tip-item">
        <span class="tip-icon">⚠️</span>
        <div>
          <h4>妥善保管 Token</h4>
          <p>不要将 Token 提交到代码仓库或公开分享</p>
        </div>
      </div>
      <div class="tip-item">
        <span class="tip-icon">🔄</span>
        <div>
          <h4>定期轮换 Token</h4>
          <p>建议定期更新 Token 以提高安全性</p>
        </div>
      </div>
      <div class="tip-item">
        <span class="tip-icon">🔒</span>
        <div>
          <h4>使用 WSS 加密传输</h4>
          <p>生产环境务必使用 <code>wss://</code> 协议</p>
        </div>
      </div>
    </div>
  </div>
</div>`;

// ============= 文档树结构 =============
export const docList: DocItem[] = [
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
        id: 'buildAgent-quickstart',
        title: '快速开始',
        apiType: 'markdown',
        fileName: 'build-agent/quickstart.md',
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
    'build-agent/quickstart.md': quickstartContent,
    'build-agent/authentication.md': authenticationContent,
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
