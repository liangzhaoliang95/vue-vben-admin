# 登录接口响应结构优化 - 去除重复字段

## 🔄 修改说明

根据你的建议，去掉了最外层重复的 `accessToken` 字段，只保留结构化的 `tokenInfo` 和 `userInfo`。

## 📋 修改内容

### 后端修改

#### 1. DTO 定义 (`backend/application/service/loginService/dto.go`)

**修改前：**
```go
type LoginResponse struct {
	AccessToken string    `json:"accessToken"` // 访问令牌（重复）
	TokenInfo   TokenInfo `json:"tokenInfo"`   // Token信息
	UserInfo    UserInfo  `json:"userInfo"`    // 用户信息
}
```

**修改后：**
```go
type LoginResponse struct {
	TokenInfo TokenInfo `json:"tokenInfo"` // Token信息
	UserInfo  UserInfo  `json:"userInfo"`  // 用户信息
}
```

#### 2. 登录逻辑 (`backend/application/service/loginService/index.go`)

**修改前：**
```go
return &LoginResponse{
	AccessToken: accessToken, // 重复字段
	TokenInfo: TokenInfo{
		AccessToken: accessToken,
		ExpireTime:  time.Now().Add(expireDuration).UnixMilli(),
	},
	UserInfo: UserInfo{
		// ...
	},
}, nil
```

**修改后：**
```go
return &LoginResponse{
	TokenInfo: TokenInfo{
		AccessToken: accessToken,
		ExpireTime:  time.Now().Add(expireDuration).UnixMilli(),
	},
	UserInfo: UserInfo{
		UserId:   user.ID,
		UserName: user.UserName,
		Phone:    user.Phone,
		Email:    user.Email,
		Avatar:   user.Avatar,
	},
}, nil
```

### 前端修改

#### 1. API 接口定义 (`src/api/core/auth.ts`)

**修改前：**
```typescript
export interface LoginResult {
  accessToken: string; // 重复字段
  tokenInfo: TokenInfo;
  userInfo: UserInfo;
}
```

**修改后：**
```typescript
export interface LoginResult {
  tokenInfo: TokenInfo; // Token信息
  userInfo: UserInfo;   // 用户信息
}
```

#### 2. 登录逻辑 (`src/store/auth.ts`)

**修改前：**
```typescript
const { accessToken, tokenInfo, userInfo: backendUserInfo } = await loginApi({
  loginName: params.loginName,
  password: params.password,
});

if (accessToken) {
  accessStore.setAccessToken(accessToken);
  // ...
}
```

**修改后：**
```typescript
const { tokenInfo, userInfo: backendUserInfo } = await loginApi({
  loginName: params.loginName,
  password: params.password,
});

if (tokenInfo.accessToken) {
  accessStore.setAccessToken(tokenInfo.accessToken);
  // ...
}
```

## 📊 新的响应格式

### 成功响应

```json
{
  "code": 0,
  "data": {
    "tokenInfo": {
      "accessToken": "testuser123_507f1f77bcf86cd799439011",
      "expireTime": 1738915200000
    },
    "userInfo": {
      "userId": "507f1f77bcf86cd799439011",
      "userName": "测试用户",
      "phone": "13800138000",
      "email": "test@example.com",
      "avatar": ""
    }
  }
}
```

### 字段说明

| 字段路径 | 类型 | 说明 |
|---------|------|------|
| tokenInfo.accessToken | string | 访问令牌 |
| tokenInfo.expireTime | number | Token 过期时间（毫秒时间戳） |
| userInfo.userId | string | 用户ID（ObjectId） |
| userInfo.userName | string | 用户昵称 |
| userInfo.phone | string | 手机号 |
| userInfo.email | string | 邮箱 |
| userInfo.avatar | string | 头像URL |

## ✅ 优势

### 1. 结构更清晰
- 去除了重复的 `accessToken` 字段
- Token 相关信息统一在 `tokenInfo` 中
- 用户相关信息统一在 `userInfo` 中

### 2. 更符合 RESTful 规范
- 响应结构更加规范
- 字段分组更加合理
- 便于后续扩展

### 3. 减少混淆
- 不会有"应该用哪个 accessToken"的疑问
- 字段含义更加明确

## 🔄 对比

### 修改前（有重复）
```json
{
  "accessToken": "xxx",  // ❌ 重复
  "tokenInfo": {
    "accessToken": "xxx",  // ❌ 重复
    "expireTime": 123456
  },
  "userInfo": { ... }
}
```

### 修改后（无重复）
```json
{
  "tokenInfo": {
    "accessToken": "xxx",  // ✅ 唯一
    "expireTime": 123456
  },
  "userInfo": { ... }
}
```

## 🧪 测试

### 使用 curl 测试

```bash
curl -X POST http://localhost:80/server/formCollector/nc/login/doLogin \
  -H "Content-Type: application/json" \
  -d '{
    "loginName": "testuser123",
    "password": "123456"
  }' | jq '.'
```

### 预期响应

```json
{
  "code": 0,
  "data": {
    "tokenInfo": {
      "accessToken": "testuser123_507f1f77bcf86cd799439011",
      "expireTime": 1738915200000
    },
    "userInfo": {
      "userId": "507f1f77bcf86cd799439011",
      "userName": "测试用户",
      "phone": "13800138000",
      "email": "test@example.com",
      "avatar": ""
    }
  }
}
```

## 📝 测试步骤

1. **重新编译后端**
   ```bash
   cd backend
   go build
   ```

2. **启动后端服务**
   ```bash
   ./formCollector
   ```

3. **重启前端服务**
   ```bash
   cd frontend
   pnpm dev
   ```

4. **测试登录**
   - 访问：`http://localhost:5666/auth/login`
   - 登录名：`testuser123`
   - 密码：`123456`

5. **验证响应**
   - 打开开发者工具（F12）-> Network 标签
   - 查看登录请求的响应
   - 确认没有重复的 `accessToken` 字段
   - 确认 `tokenInfo` 和 `userInfo` 结构正确

## ✅ 验证清单

- [x] 后端去除重复的 `accessToken` 字段
- [x] 前端更新接口定义
- [x] 前端更新登录逻辑
- [x] 响应结构更清晰
- [x] 字段分组合理
- [x] 类型定义完整

## 🎉 总结

已成功去除重复的 `accessToken` 字段，现在登录接口的响应结构更加清晰和规范：

- ✅ `tokenInfo` - 包含 Token 相关信息
  - `accessToken` - 访问令牌
  - `expireTime` - 过期时间

- ✅ `userInfo` - 包含用户相关信息
  - `userId` - 用户ID
  - `userName` - 用户昵称
  - `phone` - 手机号
  - `email` - 邮箱
  - `avatar` - 头像

---

**更新时间**: 2026-02-09
**文档版本**: 3.0.0
