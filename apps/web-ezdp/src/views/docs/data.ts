import type { DocItem } from './types';
import { marked } from 'marked';

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
        fileName: 'build-agent/overview.md',
      },
      {
        id: 'buildAgent-authentication',
        title: '鉴权机制',
        fileName: 'build-agent/authentication.md',
      },
      {
        id: 'buildAgent-protocol',
        title: '协议规范',
        fileName: 'build-agent/protocol.md',
      },
      {
        id: 'buildAgent-quickstart',
        title: '快速开始',
        fileName: 'build-agent/quickstart.md',
      },
    ],
  },
];

const docContents: Record<string, string> = {
  'build-agent/overview.md': `# Build Agent 接入指南

## 什么是 Build Agent？

Build Agent 是 EZDP 平台的构建代理机制，允许您将自己的构建服务器接入到 EZDP 平台，接收构建任务并执行。

**核心特点：**

- **协议标准化**：基于 WebSocket 的双向通信协议
- **实现自由**：您可以使用任何编程语言实现 Agent
- **构建灵活**：构建逻辑完全由您自己决定
- **实时通信**：支持实时日志推送和任务状态更新

## 工作原理

\`\`\`
┌─────────────┐                    ┌─────────────┐
│             │   WebSocket 连接    │             │
│  EZDP Server│◄──────────────────►│ Build Agent │
│             │                    │             │
└─────────────┘                    └─────────────┘
       │                                  │
       │ 1. 注册 (register)               │
       │◄─────────────────────────────────┤
       │                                  │
       │ 2. 注册响应 (register_response)  │
       ├─────────────────────────────────►│
       │                                  │
       │ 3. 心跳 (heartbeat)              │
       │◄─────────────────────────────────┤
       │                                  │
       │ 4. 任务分发 (task_dispatch)      │
       ├─────────────────────────────────►│
       │                                  │
       │ 5. 日志推送 (log_push)           │
       │◄─────────────────────────────────┤
       │                                  │
       │ 6. 任务完成 (task_complete)      │
       │◄─────────────────────────────────┤
\`\`\`

## 接入流程

### 1. 获取 Token

在 EZDP 平台创建 Build Agent 配置，获取认证 Token。

### 2. 建立 WebSocket 连接

连接到 EZDP Server 的 WebSocket 端点：

\`\`\`
ws://your-ezdp-server/ws/buildAgent
\`\`\`

### 3. 发送注册消息

连接成功后，立即发送注册消息，携带 Token 和 Agent 信息。

### 4. 等待任务分发

注册成功后，保持连接并定期发送心跳，等待 Server 下发构建任务。

### 5. 执行构建任务

收到任务后，根据任务参数执行您自己的构建逻辑。

### 6. 上报结果

构建过程中实时推送日志，完成后上报任务结果。

## 您需要实现什么？

作为接入方，您需要实现以下功能：

1. **WebSocket 客户端**：连接到 EZDP Server
2. **消息处理**：解析和发送符合协议的 JSON 消息
3. **心跳机制**：定期发送心跳保持连接
4. **任务执行**：根据任务参数执行构建（具体逻辑由您决定）
5. **日志上报**：将构建日志实时推送到 Server
6. **状态管理**：管理 Agent 状态和任务状态

## 您不需要关心什么？

- **构建工具**：使用 Docker、Jenkins、自定义脚本都可以
- **编程语言**：Go、Python、Node.js、Java 等任何语言
- **部署方式**：物理机、虚拟机、容器、Kubernetes 都支持
- **构建流程**：完全由您自己定义

## 下一步

- [鉴权机制](./authentication.md)：Token 获取和使用方式
- [协议规范](./protocol.md)：详细的消息格式和字段说明
- [快速开始](./quickstart.md)：5 分钟快速接入示例
`,

  'build-agent/authentication.md': `# 鉴权机制

Build Agent 使用 **Token 认证**接入 EZDP 平台。

## 获取 Token

1. 登录 EZDP 管理后台
2. 进入 **构建管理 → Build Agent**
3. 点击 **创建 Token**，填写描述并选择业务线
4. 复制生成的 Token（**仅显示一次，请妥善保存**）

Token 格式示例：
\`\`\`
ezdp_agent_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
\`\`\`

## 使用 Token

Token 在 **注册阶段** 通过 \`register\` 消息传递给 Server，后续通信不再需要携带 Token。

\`\`\`json
{
  "type": "register",
  "requestId": "req_abc123",
  "timestamp": 1704067200000,
  "data": {
    "token": "ezdp_agent_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "name": "my-build-agent-01",
    ...
  }
}
\`\`\`

## Token 与业务线

每个 Token 绑定到一个**业务线**，Agent 注册后只能接收该业务线的构建任务。

## 注册失败处理

| 错误信息 | 原因 | 处理方式 |
|---------|------|---------|
| \`Token 不存在\` | Token 错误或已删除 | 检查 Token 是否正确 |
| \`Token 已禁用\` | 管理员禁用了该 Token | 联系管理员或创建新 Token |
| \`业务线不存在或已禁用\` | 绑定的业务线被删除 | 重新创建 Token |

注册失败时，Agent 应**退出程序**，不应继续重试（Token 问题无法通过重试解决）。

## 安全建议

- 配置文件权限设置为 \`600\`，防止 Token 泄露
- 不要将 Token 提交到版本控制系统
- 生产环境使用 \`wss://\`（TLS 加密）而非 \`ws://\`
- 定期轮换 Token（建议每 90 天）
`,

  'build-agent/protocol.md': `# 协议规范

Build Agent 与 EZDP Server 之间通过 **WebSocket** 进行双向通信，所有消息均为 **JSON 格式**。

## 消息基础结构

所有消息都遵循统一的基础结构：

\`\`\`json
{
  "type": "消息类型",
  "requestId": "请求唯一标识",
  "timestamp": 1704067200000,
  "data": { /* 具体数据 */ }
}
\`\`\`

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| \`type\` | string | 是 | 消息类型，见下方消息类型列表 |
| \`requestId\` | string | 是 | 请求唯一标识，建议使用 UUID |
| \`timestamp\` | int64 | 是 | 消息时间戳（毫秒） |
| \`data\` | object | 是 | 消息数据，根据 type 不同而不同 |

## 消息类型

### Agent → Server

| 类型 | 说明 | 触发时机 |
|------|------|---------|
| \`register\` | 注册请求 | WebSocket 连接成功后立即发送 |
| \`heartbeat\` | 心跳请求 | 定期发送（建议 30 秒） |
| \`task_update\` | 任务状态更新 | 任务执行过程中 |
| \`task_complete\` | 任务完成 | 任务执行完成（成功或失败） |
| \`log_push\` | 日志推送 | 任务执行过程中实时推送 |

### Server → Agent

| 类型 | 说明 | 触发时机 |
|------|------|---------|
| \`register_response\` | 注册响应 | 收到注册请求后 |
| \`heartbeat_response\` | 心跳响应 | 收到心跳请求后 |
| \`task_dispatch\` | 任务分发 | 有新任务需要执行 |
| \`task_cancel\` | 任务取消 | 用户取消任务 |

---

## 1. register（注册请求）

**方向：** Agent → Server
**时机：** WebSocket 连接成功后立即发送

\`\`\`json
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
\`\`\`

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| \`token\` | string | **是** | 认证 Token |
| \`name\` | string | **是** | Agent 名称（唯一标识） |
| \`hostname\` | string | 否 | 主机名 |
| \`ip\` | string | 否 | 内网 IP |
| \`os\` | string | 否 | 操作系统：\`linux\`/\`windows\`/\`darwin\` |
| \`arch\` | string | 否 | CPU 架构：\`amd64\`/\`arm64\` |
| \`version\` | string | 否 | Agent 版本号 |
| \`osVersion\` | string | 否 | 操作系统详细版本 |
| \`cpuCores\` | int | 否 | CPU 核心数 |
| \`cpuModel\` | string | 否 | CPU 型号 |
| \`memoryTotal\` | int64 | 否 | 总内存（字节） |
| \`diskTotal\` | int64 | 否 | 总磁盘空间（字节） |
| \`publicIp\` | string | 否 | 公网 IP |
| \`maxConcurrentTasks\` | int | 否 | 最大并发任务数，默认 1 |
| \`tags\` | object | 否 | 自定义标签（键值对） |

---

## 2. register_response（注册响应）

**方向：** Server → Agent

\`\`\`json
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
\`\`\`

| 字段 | 类型 | 说明 |
|------|------|------|
| \`success\` | bool | 是否成功 |
| \`agentId\` | string | Agent ID（成功时返回） |
| \`message\` | string | 响应消息 |

---

## 3. heartbeat（心跳请求）

**方向：** Agent → Server
**时机：** 定期发送（建议 30 秒）

\`\`\`json
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
\`\`\`

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| \`agentId\` | string | **是** | Agent ID（注册时获得） |
| \`status\` | string | **是** | Agent 状态：\`idle\`/\`busy\` |
| \`currentTasks\` | int | **是** | 当前正在执行的任务数 |
| \`cpuCores\` | int | 否 | CPU 核心数 |
| \`cpuModel\` | string | 否 | CPU 型号 |
| \`osVersion\` | string | 否 | 操作系统版本 |
| \`memoryTotal\` | int64 | 否 | 总内存（字节） |
| \`diskTotal\` | int64 | 否 | 总磁盘空间（字节） |
| \`publicIp\` | string | 否 | 公网 IP |
| \`systemInfo\` | object | 否 | 系统资源使用情况 |

#### systemInfo 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| \`cpuUsage\` | float64 | CPU 使用量（核数），如 2.5 表示使用了 2.5 个核心 |
| \`memoryUsage\` | int64 | 内存使用量（字节） |
| \`diskUsage\` | int64 | 磁盘使用量（字节） |

---

## 4. heartbeat_response（心跳响应）

**方向：** Server → Agent

\`\`\`json
{
  "type": "heartbeat_response",
  "requestId": "req_def456",
  "timestamp": 1704067230100,
  "data": {
    "success": true
  }
}
\`\`\`

---

## 5. task_dispatch（任务分发）

**方向：** Server → Agent
**时机：** 有新任务需要执行

\`\`\`json
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
\`\`\`

### buildConfig 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| \`branch\` | string | **是** | Git 分支名 |
| \`tagPrefix\` | string | 否 | Tag 前缀 |
| \`devopsPath\` | string | 否 | DevOps 脚本路径 |
| \`businessLineId\` | uint | **是** | 业务线 ID |
| \`projectDefine\` | object | **是** | 项目定义 |
| \`gitlabConfig\` | object | **是** | GitLab 配置 |
| \`dockerConfig\` | object | 否 | Docker 仓库配置 |
| \`ossConfig\` | object | 否 | OSS 配置 |

**重要提示：** 这些配置参数仅供参考，您可以根据自己的构建流程使用或忽略任何字段。

---

## 6. task_update（任务状态更新）

**方向：** Agent → Server
**时机：** 任务执行过程中（可选）

\`\`\`json
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
\`\`\`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| \`taskId\` | string | **是** | 任务 ID |
| \`status\` | string | **是** | 任务状态：\`running\`/\`success\`/\`failed\` |
| \`progress\` | int | 否 | 进度百分比（0-100） |
| \`message\` | string | 否 | 状态描述 |

---

## 7. task_complete（任务完成）

**方向：** Agent → Server
**时机：** 任务执行完成（成功或失败）

\`\`\`json
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
\`\`\`

### result 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| \`newTag\` | string | 新生成的 Tag（成功时） |
| \`duration\` | int64 | 执行耗时（毫秒） |
| \`successCount\` | int | 成功数量 |
| \`failCount\` | int | 失败数量 |
| \`frontend\` | []string | 前端镜像列表 |
| \`backend\` | []string | 后端镜像列表 |

---

## 8. log_push（日志推送）

**方向：** Agent → Server
**时机：** 任务执行过程中实时推送

\`\`\`json
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
        "timestamp": 1704067292000,
        "level": "error",
        "message": "构建失败: Dockerfile not found"
      }
    ]
  }
}
\`\`\`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| \`taskId\` | string | **是** | 任务 ID |
| \`businessLineId\` | uint | **是** | 业务线 ID（用于前端路由） |
| \`logs\` | []object | **是** | 日志条目数组 |
| \`logs[].timestamp\` | int64 | **是** | 日志时间戳（毫秒） |
| \`logs[].level\` | string | **是** | 日志级别：\`info\`/\`warn\`/\`error\` |
| \`logs[].message\` | string | **是** | 日志内容 |

**建议：** 批量推送日志（如每秒或每 10 条），避免频繁发送单条日志。

---

## 9. task_cancel（任务取消）

**方向：** Server → Agent
**时机：** 用户取消任务

\`\`\`json
{
  "type": "task_cancel",
  "requestId": "req_stu901",
  "timestamp": 1704067295000,
  "data": {
    "taskId": "task_001",
    "reason": "用户手动取消"
  }
}
\`\`\`

**处理方式：** Agent 应立即停止该任务的执行，并发送 \`task_complete\` 消息（status 为 \`failed\`）。

---

## 连接管理

### 重连机制

WebSocket 连接断开后，Agent 应：

1. 等待 5-10 秒后重新连接
2. 重新发送 \`register\` 消息
3. 继续执行未完成的任务

### 超时处理

- **心跳超时**：Server 90 秒未收到心跳，将 Agent 标记为离线
- **任务超时**：建议 Agent 设置任务超时时间（如 30 分钟），超时后自动取消

### 并发控制

Agent 应根据 \`maxConcurrentTasks\` 控制并发任务数，超过限制时拒绝新任务。
`,

  'build-agent/quickstart.md': `# 快速开始

本文档通过一个最简示例，帮助您快速理解如何接入 Build Agent。

## 前置条件

- 已获取 EZDP Agent Token（见[鉴权机制](./authentication.md)）
- 了解 WebSocket 基础知识
- 任意编程语言环境

## 最简接入示例（Go）

以下是一个最简化的 Go 实现，展示接入的核心流程：

\`\`\`go
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "time"

    "github.com/gorilla/websocket"
)

const serverURL = "ws://your-ezdp-server/ws/buildAgent"
const agentToken = "ezdp_agent_your_token_here"

type Message struct {
    Type      string      \`json:"type"\`
    RequestID string      \`json:"requestId"\`
    Timestamp int64       \`json:"timestamp"\`
    Data      interface{} \`json:"data"\`
}

func main() {
    conn, _, err := websocket.DefaultDialer.Dial(serverURL, nil)
    if err != nil {
        log.Fatal("连接失败:", err)
    }
    defer conn.Close()

    // 1. 发送注册消息
    register(conn)

    // 2. 读取注册响应
    agentID := waitRegisterResponse(conn)
    fmt.Println("注册成功，Agent ID:", agentID)

    // 3. 启动心跳
    go heartbeatLoop(conn, agentID)

    // 4. 处理消息
    for {
        _, data, err := conn.ReadMessage()
        if err != nil {
            log.Println("连接断开:", err)
            return
        }
        handleMessage(conn, agentID, data)
    }
}

func register(conn *websocket.Conn) {
    msg := Message{
        Type:      "register",
        RequestID: "req_001",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "token":              agentToken,
            "name":               "my-agent-01",
            "maxConcurrentTasks": 2,
        },
    }
    data, _ := json.Marshal(msg)
    conn.WriteMessage(websocket.TextMessage, data)
}

func waitRegisterResponse(conn *websocket.Conn) string {
    _, data, _ := conn.ReadMessage()
    var msg Message
    json.Unmarshal(data, &msg)
    respData := msg.Data.(map[string]interface{})
    if respData["success"].(bool) {
        return respData["agentId"].(string)
    }
    log.Fatal("注册失败:", respData["message"])
    return ""
}

func heartbeatLoop(conn *websocket.Conn, agentID string) {
    ticker := time.NewTicker(30 * time.Second)
    for range ticker.C {
        msg := Message{
            Type:      "heartbeat",
            RequestID: fmt.Sprintf("hb_%d", time.Now().Unix()),
            Timestamp: time.Now().UnixMilli(),
            Data: map[string]interface{}{
                "agentId":      agentID,
                "status":       "idle",
                "currentTasks": 0,
            },
        }
        data, _ := json.Marshal(msg)
        conn.WriteMessage(websocket.TextMessage, data)
    }
}

func handleMessage(conn *websocket.Conn, agentID string, raw []byte) {
    var msg Message
    json.Unmarshal(raw, &msg)

    switch msg.Type {
    case "task_dispatch":
        go executeTask(conn, agentID, msg)
    case "task_cancel":
        // 处理取消逻辑
    }
}

func executeTask(conn *websocket.Conn, agentID string, msg Message) {
    taskData := msg.Data.(map[string]interface{})
    taskID := taskData["taskId"].(string)

    // 推送日志
    pushLog(conn, taskID, 1, "info", "开始执行构建任务...")

    // ===== 在这里实现您自己的构建逻辑 =====
    // 例如：执行 shell 脚本、调用 Docker API、运行 CI 工具等
    time.Sleep(5 * time.Second) // 模拟构建过程
    // =======================================

    // 上报完成
    complete(conn, taskID, "success")
}

func pushLog(conn *websocket.Conn, taskID string, businessLineID int, level, message string) {
    msg := Message{
        Type:      "log_push",
        RequestID: fmt.Sprintf("log_%d", time.Now().UnixNano()),
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "taskId":         taskID,
            "businessLineId": businessLineID,
            "logs": []map[string]interface{}{
                {
                    "timestamp": time.Now().UnixMilli(),
                    "level":     level,
                    "message":   message,
                },
            },
        },
    }
    data, _ := json.Marshal(msg)
    conn.WriteMessage(websocket.TextMessage, data)
}

func complete(conn *websocket.Conn, taskID, status string) {
    msg := Message{
        Type:      "task_complete",
        RequestID: fmt.Sprintf("done_%d", time.Now().Unix()),
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "taskId": taskID,
            "status": status,
            "result": map[string]interface{}{
                "duration":     5000,
                "successCount": 1,
                "failCount":    0,
            },
        },
    }
    data, _ := json.Marshal(msg)
    conn.WriteMessage(websocket.TextMessage, data)
}
\`\`\`

## 最简接入示例（Python）

\`\`\`python
import asyncio
import json
import time
import websockets

SERVER_URL = "ws://your-ezdp-server/ws/buildAgent"
AGENT_TOKEN = "ezdp_agent_your_token_here"

async def main():
    async with websockets.connect(SERVER_URL) as ws:
        # 1. 注册
        await ws.send(json.dumps({
            "type": "register",
            "requestId": "req_001",
            "timestamp": int(time.time() * 1000),
            "data": {
                "token": AGENT_TOKEN,
                "name": "my-python-agent",
                "maxConcurrentTasks": 2
            }
        }))

        # 2. 等待注册响应
        resp = json.loads(await ws.recv())
        agent_id = resp["data"]["agentId"]
        print(f"注册成功，Agent ID: {agent_id}")

        # 3. 启动心跳
        async def heartbeat():
            while True:
                await asyncio.sleep(30)
                await ws.send(json.dumps({
                    "type": "heartbeat",
                    "requestId": f"hb_{int(time.time())}",
                    "timestamp": int(time.time() * 1000),
                    "data": {
                        "agentId": agent_id,
                        "status": "idle",
                        "currentTasks": 0
                    }
                }))

        asyncio.create_task(heartbeat())

        async for message in ws:
            msg = json.loads(message)
            if msg["type"] == "task_dispatch":
                asyncio.create_task(execute_task(ws, msg))

async def execute_task(ws, msg):
    task_id = msg["data"]["taskId"]
    business_line_id = msg["data"]["buildConfig"]["businessLineId"]

    # 推送日志
    await ws.send(json.dumps({
        "type": "log_push",
        "requestId": f"log_{int(time.time())}",
        "timestamp": int(time.time() * 1000),
        "data": {
            "taskId": task_id,
            "businessLineId": business_line_id,
            "logs": [{"timestamp": int(time.time() * 1000), "level": "info", "message": "开始构建..."}]
        }
    }))

    # ===== 在这里实现您自己的构建逻辑 =====
    await asyncio.sleep(5)  # 模拟构建
    # =======================================

    # 上报完成
    await ws.send(json.dumps({
        "type": "task_complete",
        "requestId": f"done_{int(time.time())}",
        "timestamp": int(time.time() * 1000),
        "data": {
            "taskId": task_id,
            "status": "success",
            "result": {"duration": 5000, "successCount": 1, "failCount": 0}
        }
    }))

asyncio.run(main())
\`\`\`

## 接入检查清单

完成接入后，请确认以下几点：

- [ ] WebSocket 连接成功
- [ ] 注册消息发送正确，Token 有效
- [ ] 心跳每 30 秒发送一次
- [ ] 收到 \`task_dispatch\` 后能正确解析任务参数
- [ ] 构建过程中实时推送日志（包含 \`businessLineId\`）
- [ ] 任务完成后发送 \`task_complete\`
- [ ] 连接断开后能自动重连

## 下一步

- [协议规范](./protocol.md)：查看所有消息的完整字段说明
`,
};

export async function loadDocList(): Promise<DocItem[]> {
  return docList;
}

export async function loadDocContent(fileName: string): Promise<string> {
  const content = docContents[fileName];
  if (!content) {
    throw new Error(`文档 ${fileName} 不存在`);
  }
  return content;
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  marked.setOptions({ breaks: true, gfm: true });
  return marked.parse(markdown) as string;
}

export function findDocItem(docList: DocItem[], docId: string): DocItem | null {
  for (const doc of docList) {
    if (doc.id === docId) return doc;
    if (doc.children) {
      const found = findDocItem(doc.children, docId);
      if (found) return found;
    }
  }
  return null;
}

export function getAllAccessibleDocs(docList: DocItem[]): DocItem[] {
  const result: DocItem[] = [];
  for (const doc of docList) {
    if (!doc.isCategory && doc.fileName) result.push(doc);
    if (doc.children) result.push(...getAllAccessibleDocs(doc.children));
  }
  return result;
}
