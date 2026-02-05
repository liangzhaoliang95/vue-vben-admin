# FormCollector Frontend

## 项目概述
这是一个基于 Vue 3 + TypeScript 的表单收集系统前端，使用 Vben Admin 框架。

## 技术栈
- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI 组件库**: Ant Design Vue
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP 客户端**: @vben/request (自定义 RequestClient)
- **表单**: @vben/common-ui (VbenForm)
- **国际化**: @vben/locales

## 项目结构
```
src/
├── api/                    # API 接口定义
│   ├── core/              # 核心 API (auth, user, menu)
│   └── request.ts         # HTTP 客户端配置
├── adapter/               # 组件适配器
├── router/                # 路由配置
├── store/                 # Pinia Store
├── views/                 # 页面组件
│   └── _core/            # 核心页面 (认证等)
└── locales/              # 国际化
```

## 开发命令
```bash
# 安装依赖 (在 monorepo 根目录)
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

## API 配置
- 开发环境 API 代理: `/api` -> `http://localhost:3000`
- 后端服务端口: 3000

## 认证流程
1. 登录: POST `/auth/login` -> 返回 `{ success, token, user }`
2. 存储 Token 到 accessStore
3. 获取用户信息: GET `/user/info`
4. 获取权限码: GET `/auth/codes`

## 注意事项
- 后端使用 email 作为登录凭证，不是 username
- 后端返回格式: `{ success: boolean, message?: string, token?: string, user?: object }`
- 前端期望格式需要适配后端响应
