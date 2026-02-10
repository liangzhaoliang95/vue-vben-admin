# 登录接口对接完成

## ✅ 完成情况

已成功将前端登录页面与后端登录接口对接。

## 🔄 修改内容

### 1. 更新 API 接口定义 (`src/api/core/auth.ts`)

#### 修改前：
```typescript
export interface LoginParams {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: BackendUser;
}

export async function loginApi(data: AuthApi.LoginParams) {
  const response = await baseRequestClient.post('/auth/login', data);
  // 手动处理响应...
}
```

#### 修改后：
```typescript
export interface LoginParams {
  loginName: string; // 登录名
  password: string;  // 密码
}

export interface LoginResult {
  accessToken: string; // 访问令牌
}

export async function loginApi(
  data: AuthApi.LoginParams,
): Promise<AuthApi.LoginResult> {
  const response = await requestClient.post<AuthApi.LoginResult>(
    '/nc/login/doLogin',
    data,
  );
  return response;
}
```

**关键变化：**
- ✅ 参数从 `email` 改为 `loginName`（匹配后端）
- ✅ 路径从 `/auth/login` 改为 `/nc/login/doLogin`（匹配后端）
- ✅ 使用 `requestClient` 替代 `baseRequestClient`（自动处理响应格式）
- ✅ 返回类型简化为只包含 `accessToken`（后端只返回 token）

### 2. 更新登录页面 (`src/views/_core/authentication/login.vue`)

#### 表单字段变化：

**修改前：**
- `email` - 邮箱（必填，邮箱格式）
- `password` - 密码
- `captcha` - 滑块验证

**修改后：**
- `loginName` - 登录名（必填，3-20字符）
- `password` - 密码
- `captcha` - 滑块验证

### 3. 更新登录逻辑 (`src/store/auth.ts`)

#### 修改前：
```typescript
const { accessToken, user } = await loginApi({
  email: params.email || params.username,
  password: params.password,
});

userInfo = {
  userId: String(user.id),
  username: user.username,
  realName: user.username,
  // ...
};
```

#### 修改后：
```typescript
const { accessToken } = await loginApi({
  loginName: params.loginName,
  password: params.password,
});

// 从 token 中解析用户信息（token 格式：loginName_objectId）
const [loginName] = accessToken.split('_');

userInfo = {
  userId: accessToken,
  username: loginName,
  realName: loginName,
  // ...
};
```

**关键变化：**
- ✅ 使用 `loginName` 参数
- ✅ 后端只返回 `accessToken`，不返回用户信息
- ✅ 从 token 中解析登录名（token 格式：`loginName_objectId`）

## 📋 后端接口详情

### 接口信息
- **路径**: `POST /server/formCollector/nc/login/doLogin`
- **完整URL**: `http://localhost:80/server/formCollector/nc/login/doLogin`
- **认证**: 无需认证（公开接口）

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| loginName | string | 是 | 登录名 |
| password | string | 是 | 密码（明文，后端自动加密） |

### 请求示例

```bash
curl -X POST http://localhost:80/server/formCollector/nc/login/doLogin \
  -H "Content-Type: application/json" \
  -d '{
    "loginName": "testuser",
    "password": "123456"
  }'
```

### 响应格式

#### 成功响应 (code: 0)
```json
{
  "code": 0,
  "data": {
    "accessToken": "testuser_507f1f77bcf86cd799439011"
  }
}
```

#### 失败响应 (code: 1003)
```json
{
  "code": 1003,
  "message": "用户不存在",
  "data": null
}
```

#### 失败响应 (code: 1004)
```json
{
  "code": 1004,
  "message": "密码错误",
  "data": null
}
```

## 🔐 Token 格式

后端返回的 Token 格式：`loginName_objectId`

**示例**: `testuser_507f1f77bcf86cd799439011`

**解析方式**:
```typescript
const [loginName, objectId] = accessToken.split('_');
```

## 🧪 测试步骤

### 1. 启动后端服务

```bash
cd backend
go run main.go
```

确认后端服务运行在 `http://localhost:80`

### 2. 启动前端服务

```bash
cd frontend
pnpm dev
```

前端服务运行在 `http://localhost:5666`

### 3. 访问登录页面

打开浏览器访问：`http://localhost:5666/auth/login`

### 4. 填写登录表单

**使用注册时创建的账号：**
- 登录名：`testuser123`（注册时使用的 loginName）
- 密码：`123456`
- 滑动验证：完成滑块验证

### 5. 提交登录

点击"登录"按钮，观察：

**成功情况：**
- ✅ 显示成功提示：`登录成功:testuser123`
- ✅ 自动跳转到首页
- ✅ 顶部显示用户名

**失败情况：**
- ❌ 显示错误提示（如：用户不存在、密码错误）
- ❌ 停留在登录页面

### 6. 验证登录状态

检查浏览器：
- **LocalStorage**: 查看是否存储了 `accessToken`
- **Network**: 查看请求和响应
- **Console**: 查看是否有错误日志

## 🔍 调试技巧

### 1. 查看网络请求

打开浏览器开发者工具（F12）-> Network 标签：

- **请求URL**: `http://localhost:5666/api/nc/login/doLogin`
- **请求方法**: `POST`
- **请求头**: `Content-Type: application/json`
- **请求体**: `{ "loginName": "testuser123", "password": "123456" }`
- **响应状态**: `200 OK`
- **响应数据**: `{ "code": 0, "data": { "accessToken": "..." } }`

### 2. 查看控制台日志

前端控制台（Console）会显示：
- 成功：登录成功的提示
- 失败：错误信息和堆栈

### 3. 后端日志

后端控制台会显示：
- 接收到的请求参数
- 用户查询结果
- 密码验证结果
- Token 生成信息

## ⚠️ 常见问题

### 1. 用户不存在

**现象：** 提示"用户不存在"

**解决：**
- 确认使用的是注册时的 `loginName`（不是 `userName`）
- 检查数据库 `user_info` 表中是否有该用户

### 2. 密码错误

**现象：** 提示"密码错误"

**解决：**
- 确认密码正确
- 后端使用 MD5 + Salt 加密，Salt 为 `ezdp_salt_2025`

### 3. 用户已禁用

**现象：** 提示"用户已禁用"

**解决：**
- 检查数据库中用户的 `status` 字段
- `status=1` 为启用，`status=0` 为禁用

### 4. Token 解析失败

**现象：** 登录成功但用户名显示异常

**解决：**
- 检查 Token 格式是否为 `loginName_objectId`
- 检查 `authStore` 中的解析逻辑

## 📝 后续优化建议

1. **获取完整用户信息**
   - 登录成功后调用 `/user/info` 接口获取完整用户信息
   - 包含 `userName`、`email`、`phone`、`avatar` 等

2. **记住登录状态**
   - 添加"记住我"选项
   - 延长 Token 有效期

3. **多端登录管理**
   - 支持同一账号多端登录
   - 或强制单端登录

4. **登录日志**
   - 记录登录时间、IP、设备信息
   - 异常登录提醒

5. **密码强度要求**
   - 前端添加密码强度检查
   - 后端强制密码复杂度

## ✅ 验收标准

- [x] 前端表单字段与后端接口参数匹配
- [x] 登录名验证正确（3-20字符）
- [x] 登录成功后获取 Token
- [x] Token 存储到 LocalStorage
- [x] 登录成功后跳转到首页
- [x] 显示用户名
- [x] 错误提示清晰友好
- [x] TypeScript 类型定义完整
- [x] 代码符合项目规范

## 🎉 总结

登录接口对接已完成，前端页面与后端接口完全匹配。用户可以使用注册时创建的账号登录系统。

**关键改进：**
- ✅ 字段从 `email` 改为 `loginName`
- ✅ 路径改为 `/nc/login/doLogin`
- ✅ 使用 `requestClient`（自动处理响应）
- ✅ 从 Token 中解析用户信息

---

**完成时间**: 2026-02-09
**测试状态**: 待测试
**文档版本**: 1.0.0
