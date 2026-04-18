# 鉴权机制

Build Agent 使用 **Token 认证**接入 EZDP 平台。

## 获取 Token

1. 登录 EZDP 管理后台
2. 进入 **构建管理 → Build Agent**
3. 点击 **创建 Token**，填写描述并选择业务线
4. 复制生成的 Token（**仅显示一次，请妥善保存**）

Token 格式示例：
```
ezdp_agent_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## 使用 Token

Token 在 **注册阶段** 通过 `register` 消息传递给 Server，后续通信不再需要携带 Token。

```json
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
```

## Token 与业务线

每个 Token 绑定到一个**业务线**，Agent 注册后只能接收该业务线的构建任务。

## 注册失败处理

| 错误信息 | 原因 | 处理方式 |
|---------|------|---------|
| `Token 不存在` | Token 错误或已删除 | 检查 Token 是否正确 |
| `Token 已禁用` | 管理员禁用了该 Token | 联系管理员或创建新 Token |
| `业务线不存在或已禁用` | 绑定的业务线被删除 | 重新创建 Token |

注册失败时，Agent 应**退出程序**，不应继续重试（Token 问题无法通过重试解决）。

## 安全建议

- 配置文件权限设置为 `600`，防止 Token 泄露
- 不要将 Token 提交到版本控制系统
- 生产环境使用 `wss://`（TLS 加密）而非 `ws://`
- 定期轮换 Token（建议每 90 天）
