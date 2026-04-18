# 协议规范

Build Agent 与 EZDP Server 之间通过 **WebSocket** 进行双向通信，所有消息均为 **JSON 格式**。

## 消息基础结构

所有消息都遵循统一的基础结构：

```json
{
  "type": "消息类型",
  "requestId": "请求唯一标识",
  "timestamp": 1704067200000,
  "data": { /* 具体数据 */ }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 消息类型，见下方消息类型列表 |
| `requestId` | string | 是 | 请求唯一标识，建议使用 UUID |
| `timestamp` | int64 | 是 | 消息时间戳（毫秒） |
| `data` | object | 是 | 消息数据，根据 type 不同而不同 |

## 消息类型

### Agent → Server

| 类型 | 说明 | 触发时机 |
|------|------|---------|
| `register` | 注册请求 | WebSocket 连接成功后立即发送 |
| `heartbeat` | 心跳请求 | 定期发送（建议 30 秒） |
| `task_update` | 任务状态更新 | 任务执行过程中 |
| `task_complete` | 任务完成 | 任务执行完成（成功或失败） |
| `log_push` | 日志推送 | 任务执行过程中实时推送 |

### Server → Agent

| 类型 | 说明 | 触发时机 |
|------|------|---------|
| `register_response` | 注册响应 | 收到注册请求后 |
| `heartbeat_response` | 心跳响应 | 收到心跳请求后 |
| `task_dispatch` | 任务分发 | 有新任务需要执行 |
| `task_cancel` | 任务取消 | 用户取消任务 |

---

## 1. register（注册请求）

**方向：** Agent → Server  
**时机：** WebSocket 连接成功后立即发送

### 数据结构

```json
{
  "type": "register",
  "requestId": "req_abc123",
  "timestamp": 1704067200000,
  "data": {
    "token": "ezdp_agent_xxx",
    "name": "my-build-agent-01",
    "hostname": "build-server-01",
    "ip": "192.168.1.100",
    "os": "linux",
    "arch": "amd64",
    "version": "1.0.0",
    "osVersion": "Ubuntu 22.04",
    "cpuCores": 8,
    "cpuModel": "Intel Xeon E5-2680",
    "memoryTotal": 17179869184,
    "diskTotal": 107374182400,
    "publicIp": "203.0.113.10",
    "maxConcurrentTasks": 3,
    "tags": {
      "env": "production",
      "region": "us-west"
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | **是** | 认证 Token |
| `name` | string | **是** | Agent 名称（唯一标识） |
| `hostname` | string | 否 | 主机名 |
| `ip` | string | 否 | 内网 IP |
| `os` | string | 否 | 操作系统：`linux`/`windows`/`darwin` |
| `arch` | string | 否 | CPU 架构：`amd64`/`arm64` |
| `version` | string | 否 | Agent 版本号 |
| `osVersion` | string | 否 | 操作系统详细版本 |
| `cpuCores` | int | 否 | CPU 核心数 |
| `cpuModel` | string | 否 | CPU 型号 |
| `memoryTotal` | int64 | 否 | 总内存（字节） |
| `diskTotal` | int64 | 否 | 总磁盘空间（字节） |
| `publicIp` | string | 否 | 公网 IP |
| `maxConcurrentTasks` | int | 否 | 最大并发任务数，默认 1 |
| `tags` | object | 否 | 自定义标签（键值对） |

---

## 2. register_response（注册响应）

**方向：** Server → Agent  
**时机：** 收到注册请求后

### 数据结构

```json
{
  "type": "register_response",
  "requestId": "req_abc123",
  "timestamp": 1704067200100,
  "data": {
    "success": true,
    "agentId": "agent_xyz789",
    "message": "注册成功"
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `agentId` | string | Agent ID（成功时返回） |
| `message` | string | 响应消息 |

### 失败示例

```json
{
  "type": "register_response",
  "requestId": "req_abc123",
  "timestamp": 1704067200100,
  "data": {
    "success": false,
    "message": "Token 不存在或已禁用"
  }
}
```

---

## 3. heartbeat（心跳请求）

**方向：** Agent → Server  
**时机：** 定期发送（建议 30 秒）

### 数据结构

```json
{
  "type": "heartbeat",
  "requestId": "req_def456",
  "timestamp": 1704067230000,
  "data": {
    "agentId": "agent_xyz789",
    "status": "idle",
    "currentTasks": 0,
    "cpuCores": 8,
    "cpuModel": "Intel Xeon E5-2680",
    "osVersion": "Ubuntu 22.04",
    "memoryTotal": 17179869184,
    "diskTotal": 107374182400,
    "publicIp": "203.0.113.10",
    "systemInfo": {
      "cpuUsage": 2.5,
      "memoryUsage": 8589934592,
      "diskUsage": 53687091200
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `agentId` | string | **是** | Agent ID（注册时获得） |
| `status` | string | **是** | Agent 状态：`idle`/`busy` |
| `currentTasks` | int | **是** | 当前正在执行的任务数 |
| `cpuCores` | int | 否 | CPU 核心数 |
| `cpuModel` | string | 否 | CPU 型号 |
| `osVersion` | string | 否 | 操作系统版本 |
| `memoryTotal` | int64 | 否 | 总内存（字节） |
| `diskTotal` | int64 | 否 | 总磁盘空间（字节） |
| `publicIp` | string | 否 | 公网 IP |
| `systemInfo` | object | 否 | 系统资源使用情况 |

#### systemInfo 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `cpuUsage` | float64 | CPU 使用量（核数），如 2.5 表示使用了 2.5 个核心 |
| `memoryUsage` | int64 | 内存使用量（字节） |
| `diskUsage` | int64 | 磁盘使用量（字节） |

---

## 4. heartbeat_response（心跳响应）

**方向：** Server → Agent  
**时机：** 收到心跳请求后

### 数据结构

```json
{
  "type": "heartbeat_response",
  "requestId": "req_def456",
  "timestamp": 1704067230100,
  "data": {
    "success": true
  }
}
```

---

## 5. task_dispatch（任务分发）

**方向：** Server → Agent  
**时机：** 有新任务需要执行

### 数据结构

```json
{
  "type": "task_dispatch",
  "requestId": "req_ghi789",
  "timestamp": 1704067260000,
  "data": {
    "taskId": "task_001",
    "taskType": "build",
    "buildConfig": {
      "branch": "main",
      "tagPrefix": "v1.0",
      "devopsPath": "/path/to/devops",
      "businessLineId": 1,
      "projectDefine": {
        "group": "my-group",
        "url": "https://gitlab.com/my-group/my-project.git",
        "name": "my-project",
        "type": "docker",
        "dockerfilePath": "./Dockerfile",
        "ossName": "my-project-artifacts"
      },
      "gitlabConfig": {
        "baseUrl": "https://gitlab.com",
        "token": "glpat-xxx"
      },
      "dockerConfig": {
        "repo": "docker.io/myorg",
        "username": "myuser",
        "password": "mypass"
      },
      "ossConfig": {
        "endpoint": "oss-cn-hangzhou.aliyuncs.com",
        "bucket": "my-bucket",
        "accessKey": "LTAI...",
        "accessSecret": "xxx",
        "region": "cn-hangzhou"
      }
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | **是** | 任务唯一标识 |
| `taskType` | string | **是** | 任务类型（当前固定为 `build`） |
| `buildConfig` | object | **是** | 构建配置 |

#### buildConfig 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `branch` | string | **是** | Git 分支名 |
| `tagPrefix` | string | 否 | Tag 前缀 |
| `devopsPath` | string | 否 | DevOps 脚本路径 |
| `businessLineId` | uint | **是** | 业务线 ID |
| `projectDefine` | object | **是** | 项目定义 |
| `gitlabConfig` | object | **是** | GitLab 配置 |
| `dockerConfig` | object | 否 | Docker 仓库配置 |
| `ossConfig` | object | 否 | OSS 配置 |

#### projectDefine 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `group` | string | 项目组 |
| `url` | string | Git 仓库 URL |
| `name` | string | 项目名称 |
| `type` | string | 项目类型：`docker`/`oss` |
| `dockerfilePath` | string | Dockerfile 路径 |
| `ossName` | string | OSS 对象名称 |

#### gitlabConfig 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `baseUrl` | string | GitLab 地址 |
| `token` | string | GitLab Access Token |

#### dockerConfig 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `repo` | string | Docker 仓库地址 |
| `username` | string | 用户名 |
| `password` | string | 密码 |

#### ossConfig 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `endpoint` | string | OSS Endpoint |
| `bucket` | string | Bucket 名称 |
| `accessKey` | string | Access Key |
| `accessSecret` | string | Access Secret |
| `region` | string | 区域 |

**重要提示：** 这些配置参数仅供参考，您可以根据自己的构建流程使用或忽略任何字段。

---

## 6. task_update（任务状态更新）

**方向：** Agent → Server  
**时机：** 任务执行过程中（可选）

### 数据结构

```json
{
  "type": "task_update",
  "requestId": "req_jkl012",
  "timestamp": 1704067280000,
  "data": {
    "taskId": "task_001",
    "status": "running",
    "progress": 50,
    "message": "正在构建 Docker 镜像..."
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | **是** | 任务 ID |
| `status` | string | **是** | 任务状态：`running`/`success`/`failed` |
| `progress` | int | 否 | 进度百分比（0-100） |
| `message` | string | 否 | 状态描述 |

---

## 7. task_complete（任务完成）

**方向：** Agent → Server  
**时机：** 任务执行完成（成功或失败）

### 数据结构（成功）

```json
{
  "type": "task_complete",
  "requestId": "req_mno345",
  "timestamp": 1704067300000,
  "data": {
    "taskId": "task_001",
    "status": "success",
    "result": {
      "newTag": "v1.0.1",
      "duration": 120000,
      "successCount": 2,
      "failCount": 0,
      "frontend": ["docker.io/myorg/frontend:v1.0.1"],
      "backend": ["docker.io/myorg/backend:v1.0.1"]
    }
  }
}
```

### 数据结构（失败）

```json
{
  "type": "task_complete",
  "requestId": "req_mno345",
  "timestamp": 1704067300000,
  "data": {
    "taskId": "task_001",
    "status": "failed",
    "result": {
      "duration": 30000,
      "successCount": 0,
      "failCount": 1
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | **是** | 任务 ID |
| `status` | string | **是** | 任务状态：`success`/`failed` |
| `result` | object | 否 | 任务结果 |

#### result 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `newTag` | string | 新生成的 Tag（成功时） |
| `duration` | int64 | 执行耗时（毫秒） |
| `successCount` | int | 成功数量 |
| `failCount` | int | 失败数量 |
| `frontend` | []string | 前端镜像列表 |
| `backend` | []string | 后端镜像列表 |

---

## 8. log_push（日志推送）

**方向：** Agent → Server  
**时机：** 任务执行过程中实时推送

### 数据结构

```json
{
  "type": "log_push",
  "requestId": "req_pqr678",
  "timestamp": 1704067290000,
  "data": {
    "taskId": "task_001",
    "businessLineId": 1,
    "logs": [
      {
        "timestamp": 1704067290000,
        "level": "info",
        "message": "开始克隆代码..."
      },
      {
        "timestamp": 1704067291000,
        "level": "info",
        "message": "代码克隆完成"
      },
      {
        "timestamp": 1704067292000,
        "level": "error",
        "message": "构建失败: Dockerfile not found"
      }
    ]
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | **是** | 任务 ID |
| `businessLineId` | uint | **是** | 业务线 ID（用于前端路由） |
| `logs` | []object | **是** | 日志条目数组 |

#### logs 数组元素

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `timestamp` | int64 | **是** | 日志时间戳（毫秒） |
| `level` | string | **是** | 日志级别：`info`/`warn`/`error` |
| `message` | string | **是** | 日志内容 |

**建议：** 批量推送日志（如每秒或每 10 条），避免频繁发送单条日志。

---

## 9. task_cancel（任务取消）

**方向：** Server → Agent  
**时机：** 用户取消任务

### 数据结构

```json
{
  "type": "task_cancel",
  "requestId": "req_stu901",
  "timestamp": 1704067295000,
  "data": {
    "taskId": "task_001",
    "reason": "用户手动取消"
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskId` | string | 任务 ID |
| `reason` | string | 取消原因 |

**处理方式：** Agent 应立即停止该任务的执行，并发送 `task_complete` 消息（status 为 `failed`）。

---

## 连接管理

### 重连机制

WebSocket 连接断开后，Agent 应：

1. 等待 5-10 秒后重新连接
2. 重新发送 `register` 消息
3. 继续执行未完成的任务

### 超时处理

- **心跳超时**：Server 90 秒未收到心跳，将 Agent 标记为离线
- **任务超时**：建议 Agent 设置任务超时时间（如 30 分钟），超时后自动取消

### 并发控制

Agent 应根据 `maxConcurrentTasks` 控制并发任务数，超过限制时拒绝新任务。
