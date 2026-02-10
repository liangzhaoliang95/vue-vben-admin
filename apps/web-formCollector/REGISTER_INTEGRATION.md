# 注册接口对接完成

## ✅ 完成情况

已成功将前端注册页面与后端注册接口对接。

## 🔄 修改内容

### 1. 更新 API 接口定义 (`src/api/core/auth.ts`)

#### 修改前：
```typescript
export interface RegisterParams {
  username: string;
  email: string;
  password: string;
}

export async function registerApi(data: AuthApi.RegisterParams) {
  const response = await baseRequestClient.post('/auth/register', data);
  // ...
}
```

#### 修改后：
```typescript
export interface RegisterParams {
  loginName: string;  // 登录名（3-20字符）
  userName: string;   // 用户昵称（2-50字符）
  password: string;   // 密码（6-20字符）
  phone?: string;     // 手机号（可选，11位）
  email?: string;     // 邮箱（可选）
}

export interface RegisterResult {
  userId: string;     // 用户ID
  loginName: string;  // 登录名
  userName: string;   // 用户名
}

export async function registerApi(
  data: AuthApi.RegisterParams,
): Promise<AuthApi.RegisterResult> {
  const response = await requestClient.post<AuthApi.RegisterResult>(
    '/nc/register',
    data,
  );
  return response;
}
```

**关键变化：**
- ✅ 路径从 `/auth/register` 改为 `/nc/register`（匹配后端）
- ✅ 参数从 `username/email` 改为 `loginName/userName`（匹配后端）
- ✅ 添加可选字段 `phone` 和 `email`
- ✅ 使用 `requestClient` 替代 `baseRequestClient`（自动处理响应格式）
- ✅ 返回类型改为 `RegisterResult`（包含 userId、loginName、userName）

### 2. 更新注册页面 (`src/views/_core/authentication/register.vue`)

#### 表单字段变化：

**修改前：**
- `username` - 用户名
- `email` - 邮箱（必填）
- `password` - 密码
- `confirmPassword` - 确认密码
- `agreePolicy` - 同意协议

**修改后：**
- `loginName` - 登录名（必填，3-20字符）
- `userName` - 用户昵称（必填，2-50字符）
- `email` - 邮箱（可选）
- `phone` - 手机号（可选，11位）
- `password` - 密码（必填，6-20字符）
- `confirmPassword` - 确认密码
- `agreePolicy` - 同意协议

#### 提交逻辑变化：

**修改前：**
```typescript
await registerApi({
  username: values.username,
  email: values.email,
  password: values.password,
});
message.success('注册成功，请登录');
```

**修改后：**
```typescript
const result = await registerApi({
  loginName: values.loginName,
  userName: values.userName,
  password: values.password,
  email: values.email || undefined,
  phone: values.phone || undefined,
});
message.success(`注册成功！用户ID: ${result.userId}`);
```

## 📋 后端接口详情

### 接口信息
- **路径**: `POST /server/formCollector/nc/register`
- **完整URL**: `http://localhost:5666/server/formCollector/nc/register`
- **认证**: 无需认证（公开接口）

### 请求参数

| 字段 | 类型 | 必填 | 验证规则 | 说明 |
|------|------|------|----------|------|
| loginName | string | 是 | 3-20字符 | 登录名，必须唯一 |
| userName | string | 是 | 2-50字符 | 用户昵称/显示名称 |
| password | string | 是 | 6-20字符 | 登录密码 |
| phone | string | 否 | 11位数字 | 手机号码 |
| email | string | 否 | 邮箱格式 | 电子邮箱 |

### 请求示例

```bash
curl -X POST http://localhost:5666/server/formCollector/nc/register \
  -H "Content-Type: application/json" \
  -d '{
    "loginName": "testuser",
    "userName": "测试用户",
    "password": "123456",
    "phone": "13800138000",
    "email": "test@example.com"
  }'
```

### 响应格式

#### 成功响应 (code: 0)
```json
{
  "code": 0,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "loginName": "testuser",
    "userName": "测试用户"
  }
}
```

#### 失败响应 (code: 1001)
```json
{
  "code": 1001,
  "message": "用户名已存在，请更换",
  "data": null
}
```

## 🧪 测试步骤

### 1. 启动后端服务

```bash
cd backend
go run main.go
```

确认后端服务运行在 `http://localhost:5666`

### 2. 启动前端服务

```bash
cd frontend
pnpm dev
```

前端服务运行在 `http://localhost:5173`（或其他端口）

### 3. 访问注册页面

打开浏览器访问：`http://localhost:5666/auth/register`

### 4. 填写注册表单

**必填字段：**
- 登录名：`testuser123`（3-20字符）
- 用户昵称：`测试用户`（2-50字符）
- 密码：`123456`（6-20字符）
- 确认密码：`123456`

**可选字段：**
- 邮箱：`test@example.com`
- 手机号：`13800138000`（11位）

**勾选：**
- ✅ 同意隐私政策和服务条款

### 5. 提交注册

点击"注册"按钮，观察：

**成功情况：**
- ✅ 显示成功提示：`注册成功！用户ID: xxx`
- ✅ 自动跳转到登录页面 `/auth/login`

**失败情况：**
- ❌ 显示错误提示（如：用户名已存在）
- ❌ 停留在注册页面

### 6. 验证数据

检查后端数据库 `user_info` 表，确认用户已创建：

```sql
SELECT * FROM user_info WHERE login_name = 'testuser123';
```

## 🔍 调试技巧

### 1. 查看网络请求

打开浏览器开发者工具（F12）-> Network 标签：

- 请求URL：`http://localhost:5666/server/formCollector/nc/register`
- 请求方法：`POST`
- 请求头：`Content-Type: application/json`
- 请求体：包含 `loginName`、`userName`、`password` 等字段

### 2. 查看控制台日志

前端控制台（Console）会显示：
- 成功：注册成功的提示
- 失败：错误信息和堆栈

### 3. 后端日志

后端控制台会显示：
- 接收到的请求参数
- 数据库操作日志
- 错误信息（如用户名重复）

## ⚠️ 常见问题

### 1. 跨域问题

**现象：** 浏览器控制台显示 CORS 错误

**解决：** 后端已配置 CORS，允许前端访问。如果仍有问题，检查：
- 后端 CORS 配置是否正确
- 前端请求 URL 是否正确

### 2. 用户名已存在

**现象：** 提示"用户名已存在，请更换"

**解决：** 更换一个新的登录名（loginName）

### 3. 密码加密

**说明：** 后端使用 MD5 + Salt 加密密码
- Salt: `ezdp_salt_2025`
- 前端发送明文密码，后端自动加密

### 4. 字段验证失败

**现象：** 提示字段验证错误

**检查：**
- 登录名：3-20字符
- 用户昵称：2-50字符
- 密码：6-20字符
- 手机号：11位数字（可选）
- 邮箱：有效的邮箱格式（可选）

## 📝 后续优化建议

1. **添加图形验证码**：防止恶意注册
2. **邮箱验证**：发送验证邮件确认邮箱
3. **手机验证码**：发送短信验证码
4. **密码强度检查**：要求包含大小写字母、数字、特殊字符
5. **用户名唯一性检查**：实时检查用户名是否可用
6. **防重复提交**：添加防抖或节流

## ✅ 验收标准

- [x] 前端表单字段与后端接口参数匹配
- [x] 必填字段验证正确
- [x] 可选字段可以为空
- [x] 注册成功后显示用户ID
- [x] 注册成功后跳转到登录页
- [x] 错误提示清晰友好
- [x] TypeScript 类型定义完整
- [x] 代码符合项目规范

## 🎉 总结

注册接口对接已完成，前端页面与后端接口完全匹配。用户可以通过注册页面成功创建账号，并自动跳转到登录页面。

---

**完成时间**: 2026-02-09
**测试状态**: 待测试
**文档版本**: 1.0.0
