# 🔧 前后端接口配置说明

## 问题描述

前端请求接口路径为 `http://localhost:5666/api/nc/register`，但后端实际路径是 `http://localhost:80/server/formCollector/nc/register`，导致请求失败。

## 配置分析

### 后端配置

**文件**: `backend/internal/config/config.go`

```go
if support.IsLocal() {
    Config.Prefix = "/server/formCollector"  // 路由前缀
    Config.PortInner = 81
}
```

**后端实际路径**:
- 基础路径: `/server/formCollector`
- 注册接口: `/server/formCollector/nc/register`
- 完整URL: `http://localhost:80/server/formCollector/nc/register`

### 前端配置（修改前）

**文件**: `frontend/apps/web-formCollector/.env.development`

```bash
VITE_PORT=5666              # 前端端口
VITE_GLOB_API_URL=/api      # API 前缀
```

**文件**: `frontend/apps/web-formCollector/vite.config.mts`

```typescript
proxy: {
  '/api': {
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),  // 移除 /api 前缀
    target: 'http://localhost:3000',                // 错误的目标地址
    ws: true,
  },
}
```

**请求流程（修改前）**:
1. 前端发起: `/api/nc/register`
2. Vite 代理重写: `/nc/register`
3. 代理转发: `http://localhost:3000/nc/register`
4. ❌ **错误**: 后端实际在 `http://localhost:80/server/formCollector/nc/register`

## ✅ 解决方案

### 修改 Vite 代理配置

**文件**: `frontend/apps/web-formCollector/vite.config.mts`

```typescript
proxy: {
  '/api': {
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '/server/formCollector'),
    target: 'http://localhost:80',  // 后端实际端口
    ws: true,
  },
}
```

**请求流程（修改后）**:
1. 前端发起: `/api/nc/register`
2. Vite 代理重写: `/server/formCollector/nc/register`
3. 代理转发: `http://localhost:80/server/formCollector/nc/register`
4. ✅ **正确**: 匹配后端路径

## 配置对比

| 项目 | 修改前 | 修改后 |
|------|--------|--------|
| **代理重写规则** | `/api` → `` | `/api` → `/server/formCollector` |
| **目标地址** | `http://localhost:3000` | `http://localhost:80` |
| **最终请求** | `http://localhost:3000/nc/register` | `http://localhost:80/server/formCollector/nc/register` |
| **结果** | ❌ 404 Not Found | ✅ 正确 |

## 完整的请求路径

### 注册接口
- **前端调用**: `registerApi({ loginName, userName, password })`
- **API 定义**: `requestClient.post('/nc/register', data)`
- **实际请求**: `POST /api/nc/register`
- **Vite 代理**: `POST http://localhost:80/server/formCollector/nc/register`
- **后端接收**: `POST /server/formCollector/nc/register`

### 登录接口
- **前端调用**: `loginApi({ email, password })`
- **API 定义**: `baseRequestClient.post('/auth/login', data)`
- **实际请求**: `POST /api/auth/login`
- **Vite 代理**: `POST http://localhost:80/server/formCollector/auth/login`
- **后端接收**: `POST /server/formCollector/auth/login`

## 验证配置

### 1. 检查后端服务

```bash
# 检查后端是否运行在 80 端口
curl http://localhost:80/server/formCollector/healthz

# 测试注册接口
curl -X POST http://localhost:80/server/formCollector/nc/register \
  -H "Content-Type: application/json" \
  -d '{
    "loginName": "testuser",
    "userName": "测试用户",
    "password": "123456"
  }'
```

### 2. 重启前端服务

```bash
cd frontend
pnpm dev
```

### 3. 测试前端请求

打开浏览器开发者工具（F12）-> Network 标签，访问注册页面并提交表单，检查：

- **请求URL**: `http://localhost:5666/api/nc/register`
- **代理后URL**: `http://localhost:80/server/formCollector/nc/register`
- **响应状态**: `200 OK`

## 其他接口配置

### 如果后端路径不同

如果你的后端使用不同的路径前缀，修改 `vite.config.mts`:

```typescript
// 示例：后端路径为 /api/v1
rewrite: (path) => path.replace(/^\/api/, '/api/v1'),

// 示例：后端路径为 /backend
rewrite: (path) => path.replace(/^\/api/, '/backend'),

// 示例：后端没有前缀
rewrite: (path) => path.replace(/^\/api/, ''),
```

### 如果后端端口不同

修改 `target`:

```typescript
// 后端运行在 3000 端口
target: 'http://localhost:3000',

// 后端运行在 8080 端口
target: 'http://localhost:8080',

// 后端运行在远程服务器
target: 'http://192.168.1.100:80',
```

## 环境变量配置

### 开发环境 (.env.development)

```bash
VITE_PORT=5666                    # 前端端口
VITE_GLOB_API_URL=/api            # API 前缀（不需要修改）
```

### 生产环境 (.env.production)

```bash
VITE_GLOB_API_URL=/server/formCollector  # 生产环境直接使用完整路径
```

## 常见问题

### Q1: 为什么使用 /api 作为前缀？

**答**: `/api` 是前端的统一 API 前缀，通过 Vite 代理转发到后端的实际路径。这样做的好处：
- 前端代码不需要关心后端的实际路径
- 可以灵活切换后端地址
- 避免跨域问题

### Q2: 为什么不直接请求后端地址？

**答**: 开发环境中，前端和后端运行在不同端口，直接请求会遇到跨域问题。使用 Vite 代理可以：
- 避免跨域问题
- 统一管理 API 地址
- 方便切换环境

### Q3: 生产环境如何配置？

**答**: 生产环境通常前后端部署在同一域名下，可以：
1. 使用 Nginx 反向代理
2. 直接使用后端路径 `/server/formCollector`
3. 修改 `.env.production` 中的 `VITE_GLOB_API_URL`

### Q4: 如何调试代理配置？

**答**:
1. 查看浏览器 Network 标签的请求 URL
2. 查看 Vite 控制台的代理日志
3. 使用 curl 直接测试后端接口

## 总结

✅ **已修改**: `vite.config.mts` 中的代理配置
- 重写规则: `/api` → `/server/formCollector`
- 目标地址: `http://localhost:80`

✅ **请求流程**:
```
前端: /api/nc/register
  ↓ (Vite 代理)
后端: http://localhost:80/server/formCollector/nc/register
```

✅ **验证方法**:
1. 重启前端服务
2. 访问注册页面
3. 提交表单
4. 检查 Network 标签

---

**更新时间**: 2026-02-09
**文档版本**: 1.0.0
