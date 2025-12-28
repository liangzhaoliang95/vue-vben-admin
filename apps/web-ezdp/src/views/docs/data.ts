import type { DocItem } from './types';
import { marked } from 'marked';

/**
 * 文档列表数据
 */
export const docList: DocItem[] = [
  {
    id: 'buildAgent',
    title: 'BuildAgent 接入文档',
    description: '构建代理接入指南和协议文档',
    fileName: 'buildAgent_integration_guide.md',
  },
  {
    id: 'deployAgent',
    title: 'DeployAgent 接入文档',
    description: '部署代理接入指南和协议文档',
    fileName: 'deployAgent_integration_guide.md',
  },
];

/**
 * 文档内容 - 直接从 docs 目录导入
 * 打包时会将这些文件内容直接嵌入到前端代码中
 */
const docContents: Record<string, string> = {
  'buildAgent_integration_guide.md': `# BuildAgent 接入指南

本文档说明如何开发自定义 BuildAgent 接入 EZDP 版本管理平台。

## 核心概念

BuildAgent 通过 **WebSocket** 与平台通信，接收构建任务并上报结果。

## 接入流程

\`\`\`
1. 启动 Agent
   ↓
2. 连接 WebSocket: ws://<server>/ws/agent
   ↓
3. 发送注册消息 (type: register)
   ↓
4. 接收注册响应，获取 agentId
   ↓
5. 启动心跳循环 (每30秒发送 heartbeat)
   ↓
6. 等待接收任务 (type: task_dispatch)
   ↓
7. 执行任务，推送日志 (type: log_push)
   ↓
8. 任务完成后上报结果 (type: task_complete)
   ↓
9. 继续等待下一个任务
\`\`\`

## WebSocket 协议

### 连接端点

\`\`\`
ws://<server>/ws/agent
\`\`\`

### 消息格式

所有消息统一格式：
\`\`\`json
{
  "type": "message_type",
  "requestId": "uuid-string",
  "timestamp": 1234567890,
  "data": { /* 具体数据 */ }
}
\`\`\`

## 消息类型详解

### Agent → Server

#### 1. register (注册)

**发送时机**: Agent 启动后首次连接

**Data**:
\`\`\`json
{
  "token": "your-agent-token",
  "name": "agent-name",
  "hostname": "build-server-01",
  "ip": "192.168.1.100",
  "os": "linux",
  "arch": "amd64",
  "version": "1.0.0",
  "maxConcurrentTasks": 2,
  "tags": {
    "docker": "20.10.21"
  }
}
\`\`\`

#### 2. heartbeat (心跳)

**发送时机**: 每 30 秒一次

**Data**:
\`\`\`json
{
  "agentId": "agent-id-from-register",
  "status": "idle" | "busy",
  "currentTasks": 1,
  "systemInfo": {
    "cpuUsage": 45.5,
    "memoryUsage": 62.3,
    "diskUsage": 78.9
  }
}
\`\`\`

#### 3. log_push (推送日志)

**发送时机**: 任务执行过程中实时推送

**Data**:
\`\`\`json
{
  "taskId": "task-id-from-dispatch",
  "businessLineId": 1,
  "logs": [
    {
      "timestamp": 1704096000000,
      "level": "info" | "warn" | "error",
      "message": "构建开始..."
    }
  ]
}
\`\`\`

#### 4. task_complete (任务完成)

**发送时机**: 任务执行完成后

**Data** (成功):
\`\`\`json
{
  "taskId": "task-id-from-dispatch",
  "status": "success",
  "result": {
    "newTag": "20240101-123456",
    "duration": 125000,
    "successCount": 5,
    "failCount": 0
  }
}
\`\`\`

**Data** (失败):
\`\`\`json
{
  "taskId": "task-id-from-dispatch",
  "status": "failed",
  "result": null
}
\`\`\`

### Server → Agent

#### 1. register_response (注册响应)

**接收时机**: 发送 register 后

**Data**:
\`\`\`json
{
  "success": true,
  "agentId": "agent-id-12345",
  "message": "Registration successful"
}
\`\`\`

#### 2. task_dispatch (任务分发)

**接收时机**: 平台下发任务时

**Data**:
\`\`\`json
{
  "taskId": "task-uuid-12345",
  "taskType": "docker_build",
  "buildConfig": {
    "branch": "main",
    "tagPrefix": "prod",
    "devopsPath": "/opt/ezdp",
    "businessLineId": 1,
    "projectDefine": {
      "group": "devops",
      "url": "git@github.com:xxx/xxx.git",
      "name": "web-app",
      "type": "frontend",
      "dockerfilePath": "",
      "ossName": "static"
    },
    "gitlabConfig": {
      "token": "gitlab-token"
    },
    "dockerConfig": {
      "repo": "docker.plaso.cn",
      "username": "user",
      "password": "pass"
    }
  }
}
\`\`\`

#### 3. task_cancel (任务取消)

**接收时机**: 需要取消正在执行的任务时

**Data**:
\`\`\`json
{
  "taskId": "task-uuid-12345",
  "reason": "用户手动取消"
}
\`\`\`

#### 4. heartbeat_response (心跳响应)

**接收时机**: 发送 heartbeat 后

**Data**:
\`\`\`json
{
  "success": true
}
\`\`\`

## 关键要点

1. **必须实现**:
   - WebSocket 连接管理
   - 注册和心跳
   - 任务处理和日志推送
   - 结果上报

2. **重要字段**:
   - \`businessLineId\`: 日志推送时必须携带，用于前端路由
   - \`taskId\`: 所有任务相关消息必须携带
   - \`agentId\`: 注册后获取，心跳和任务更新时使用

3. **注意事项**:
   - 心跳间隔 ≤ 30 秒
   - 日志实时推送，不要等任务结束再发
   - 任务失败也要发送 \`task_complete\`
   - 实现自动重连机制

## 参考实现

完整代码：\`backend/agent/buildAgent/\`
`,

  'deployAgent_integration_guide.md': `# DeployAgent 接入指南

本文档说明如何开发自定义 DeployAgent 接入 EZDP 版本管理平台。

## 核心概念

DeployAgent 通过 **HTTP API** 与平台通信，获取版本信息，执行部署操作，并上报结果。

## 接入流程

\`\`\`
1. 启动 Agent
   ↓
2. 获取代理信息: POST /nc/deployAgent/getAgentInfo
   ↓
3. 获取分支列表: POST /nc/deployAgent/getBranches
   ↓
4. 获取版本列表: POST /nc/deployAgent/getVersionsByBranch
   ↓
5. 获取版本详情: POST /nc/deployAgent/getVersionDetail
   ↓
6. 执行部署 (K8s/OSS/OBS/Script)
   ↓
7. 提交结果: POST /nc/deployAgent/submitDeployResult
   ↓
8. 完成
\`\`\`

## HTTP 接口文档

### 基础信息

- **Base URL**: \`http://<server>/server/ezdp\`
- **认证方式**: Token 通过请求体传递
- **请求方法**: POST
- **响应格式**:
\`\`\`json
{
  "code": 0,
  "msg": "success",
  "data": { /* 具体数据 */ }
}
\`\`\`

### 1. 获取代理信息

**接口**: \`/nc/deployAgent/getAgentInfo\`

**请求**:
\`\`\`json
{
  "token": "your-token"
}
\`\`\`

**响应**:
\`\`\`json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "agent-id",
    "businessLineId": 1,
    "businessLineName": "研发部",
    "name": "deploy-agent-01",
    "environments": [
      {
        "id": "env-001",
        "name": "生产环境",
        "description": "线上生产环境",
        "backendSecretName": "prod-cluster",
        "backendNamespace": "production",
        "frontendStorageName": "prod-oss",
        "frontendBaseUrl": "https://cdn.example.com",
        "currentVersion": "v1.2.3",
        "currentBuildVersionId": "build-123"
      }
    ]
  }
}
\`\`\`

**用途**: 验证 Token，获取可访问的环境列表

---

### 2. 获取分支列表

**接口**: \`/nc/deployAgent/getBranches\`

**请求**:
\`\`\`json
{
  "token": "your-token",
  "businessLineId": 1
}
\`\`\`

**响应**:
\`\`\`json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": "branch-001",
      "name": "main",
      "description": "主分支",
      "enabled": true
    },
    {
      "id": "branch-002",
      "name": "develop",
      "description": "开发分支",
      "enabled": true
    }
  ]
}
\`\`\`

**用途**: 展示可部署的代码分支

---

### 3. 获取版本列表（分页）

**接口**: \`/nc/deployAgent/getVersionsByBranch\`

**请求**:
\`\`\`json
{
  "token": "your-token",
  "branchId": "branch-001",
  "pageIndex": 1,
  "pageSize": 10
}
\`\`\`

**响应**:
\`\`\`json
{
  "code": 0,
  "msg": "success",
  "data": {
    "total": 50,
    "list": [
      {
        "id": "build-123",
        "version": "v1.2.3",
        "description": "修复登录bug",
        "status": "success",
        "buildTime": 1704096000000
      },
      {
        "id": "build-122",
        "version": "v1.2.2",
        "description": "新增用户管理",
        "status": "success",
        "buildTime": 1704095000000
      }
    ]
  }
}
\`\`\`

**用途**: 展示指定分支的构建版本历史

---

### 4. 获取版本详情

**接口**: \`/nc/deployAgent/getVersionDetail\`

**请求**:
\`\`\`json
{
  "token": "your-token",
  "buildVersionId": "build-123"
}
\`\`\`

**响应**:
\`\`\`json
{
  "code": 0,
  "msg": "success",
  "data": {
    "version": "v1.2.3",
    "description": "修复登录bug",
    "buildTime": 1704096000000,
    "projects": [
      {
        "projectConfigId": "proj-001",
        "projectName": "web-app",
        "projectType": "frontend",
        "version": "v1.2.3",
        "imageName": "docker.plaso.cn/web-app",
        "imageTag": "latest",
        "deployType": "k8s",
        "k8sName": "web-app",
        "k8sType": "deployment",
        "k8sContainerName": "web"
      },
      {
        "projectConfigId": "proj-002",
        "projectName": "admin-panel",
        "projectType": "frontend",
        "version": "v1.2.3",
        "deployType": "oss",
        "ossPath": "/opt/ezdp/build/admin",
        "ossBucket": "static-resources",
        "ossPrefix": "v2",
        "ossTargetName": "admin"
      }
    ]
  }
}
\`\`\`

**用途**: 获取版本包含的项目及其部署配置

---

### 5. 提交部署结果

**接口**: \`/nc/deployAgent/submitDeployResult\`

**请求**:
\`\`\`json
{
  "token": "your-token",
  "deployEnvironmentId": "env-001",
  "buildVersionId": "build-123",
  "isFullDeploy": true,
  "startedAt": 1704096000000,
  "finishedAt": 1704096120000,
  "projectResults": [
    {
      "projectConfigId": "proj-001",
      "projectName": "web-app",
      "status": "success",
      "deployLogs": "部署成功，Pod已就绪"
    },
    {
      "projectConfigId": "proj-002",
      "projectName": "admin-panel",
      "status": "success",
      "deployLogs": "OSS同步完成"
    }
  ]
}
\`\`\`

**响应**:
\`\`\`json
{
  "code": 0,
  "msg": "success",
  "data": {
    "deployTaskId": "deploy-task-456",
    "success": true,
    "message": "部署任务已创建"
  }
}
\`\`\`

**用途**: 上报部署结果，更新环境版本

---

## 部署类型说明

### K8s 部署

**配置字段**:
- \`deployType\`: \`"k8s"\`
- \`imageName\`: 镜像仓库地址
- \`imageTag\`: 镜像标签
- \`k8sName\`: Deployment 名称
- \`k8sType\`: \`deployment\` 或 \`cronjob\`
- \`k8sContainerName\`: 容器名称

**执行**: \`kubectl set image deployment/<name> <container>=<image>:<tag> -n <namespace>\`

---

### OSS 部署（前端静态资源）

**配置字段**:
- \`deployType\`: \`"oss"\`
- \`ossPath\`: 源文件路径（构建产物）
- \`ossBucket\`: OSS Bucket 名称
- \`ossPrefix\`: 目标路径前缀
- \`ossTargetName\`: 目标文件夹名称

**执行**: \`ossutil sync <source> oss://<bucket>/<prefix>/<target> -r -f\`

---

### OBS 部署（华为云）

**配置字段**:
- \`deployType\`: \`"obs"\`
- \`ossPath\`: 源文件路径
- \`obsBucket\`: OBS Bucket 名称
- \`obsPrefix\`: 目标路径前缀
- \`obsTargetName\`: 目标文件夹名称

**执行**: \`obsutil sync <source> obs://<bucket>/<prefix>/<target> -r -f\`

---

### Script 部署（自定义脚本）

**配置字段**:
- \`deployType\`: \`"script"\`
- \`scriptContent\`: Shell 脚本内容

**环境变量**:
- \`PROJECT_NAME\`: 项目名称
- \`VERSION\`: 版本号
- \`ENV_NAME\`: 环境名称
- \`ENV_NAMESPACE\`: K8s 命名空间

---

## 关键要点

1. **必须实现**:
   - HTTP 请求封装
   - 流程控制（获取信息 → 选择 → 部署 → 上报）
   - 多种部署类型支持
   - 结果上报

2. **重要字段**:
   - \`token\`: 所有请求必须携带
   - \`businessLineId\`: 获取分支时使用
   - \`branchId\`: 获取版本时使用
   - \`buildVersionId\`: 获取详情和上报结果时使用
   - \`deployEnvironmentId\`: 上报结果时使用

3. **注意事项**:
   - 所有接口使用 POST 方法
   - 响应码 \`code\` 为 0 表示成功
   - 部署失败也要上报结果（status: "failed"）
   - \`isFullDeploy\` 为 true 时，后端会更新环境版本

## 参考实现

完整代码：\`backend/agent/deployAgent/\`
`,
};

/**
 * 从写死的数据中获取文档列表
 */
export async function loadDocList(): Promise<DocItem[]> {
  return docList;
}

/**
 * 从写死的数据中获取文档内容
 */
export async function loadDocContent(fileName: string): Promise<string> {
  const content = docContents[fileName];
  if (!content) {
    throw new Error(`文档 ${fileName} 不存在`);
  }
  return content;
}

/**
 * Markdown 转 HTML - 使用 marked 库
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // 配置 marked
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // marked.parse() 可能返回 Promise，但我们的 markdown 是同步的
  // 使用 as string 断言，因为我们知道内容是同步的
  return marked.parse(markdown) as string;
}
