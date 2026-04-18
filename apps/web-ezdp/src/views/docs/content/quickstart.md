# 快速开始

本文档通过一个最简示例，帮助您快速理解如何接入 Build Agent。

## 前置条件

- 已获取 EZDP Agent Token（见[鉴权机制](./authentication.md)）
- 了解 WebSocket 基础知识
- 任意编程语言环境

## 最简接入示例（Go）

以下是一个最简化的 Go 实现，展示接入的核心流程：

```go
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
    Type      string      `json:"type"`
    RequestID string      `json:"requestId"`
    Timestamp int64       `json:"timestamp"`
    Data      interface{} `json:"data"`
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
```

## 最简接入示例（Python）

```python
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

        # 3. 处理消息
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
```

## 接入检查清单

完成接入后，请确认以下几点：

- [ ] WebSocket 连接成功
- [ ] 注册消息发送正确，Token 有效
- [ ] 心跳每 30 秒发送一次
- [ ] 收到 `task_dispatch` 后能正确解析任务参数
- [ ] 构建过程中实时推送日志（包含 `businessLineId`）
- [ ] 任务完成后发送 `task_complete`
- [ ] 连接断开后能自动重连

## 下一步

- [协议规范](./protocol.md)：查看所有消息的完整字段说明
- [最佳实践](./best-practices.md)：生产环境部署建议
