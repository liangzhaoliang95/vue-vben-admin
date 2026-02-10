# 登录接口返回完整用户信息 - 更新说明

## 🔄 更新内容

根据后端代码结构，登录接口现在返回完整的用户信息，而不仅仅是 Token。

### 后端修改

#### 1. DTO 定义 (`backend/application/service/loginService/dto.go`)

**修改前：**
```go
type LoginResponse struct {
	AccessToken string `json:"accessToken"` // 访问令牌
	// TokenInfo TokenInfo `json:"tokenInfo"` // Token信息
	// UserInfo  UserInfo  `json:"userInfo"`  // 用户信息
}
```

**修改后：**
```go
type LoginResponse struct {
	AccessToken string    `json:"accessToken"` // 访问令牌
	TokenInfo   TokenInfo `json:"tokenInfo"`   // Token信息
	UserInfo    UserInfo  `json:"userInfo"`    // 用户信息
}
```

#### 2. 登录逻辑 (`backend/application/service/loginService/index.go`)

**修改前：**
```go
return &LoginResponse{
	AccessToken: accessToken,
}, nil
```

**修改后：**
```go
return &LoginResponse{
	AccessToken: accessToken,
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
  accessToken: string;
}
```

**修改后：**
```typescript
export interface TokenInfo {
  accessToken: string;
  expireTime: number; // 过期时间（毫秒时间戳）
}

export interface UserInfo {
  userId: string;
  userName: string;
  phone: string;
  email: string;
  avatar: string;
}

export interface LoginResult {
  accessToken: string; // 兼容字段
  tokenInfo: TokenInfo;
  userInfo: UserInfo;
}
```

#### 2. 登录逻辑 (`src/store/auth.ts`)

**修改前：**
```typescript
const { accessToken } = await loginApi({
  loginName: params.loginName,
  password: params.password,
});

// 从 token 中解析用户信息
const [loginName] = accessToken.split('_');

userInfo = {
  userId: accessToken,
  username: loginName,
  realName: loginName,
  avatar: '',
  // ...
};
```

**修改后：**
```typescript
const { accessToken, tokenInfo, userInfo: backendUserInfo } = await loginApi({
  loginName: params.loginName,
  password: params.password,
});

// 使用后端返回的完整用户信息
userInfo = {
  userId: backendUserInfo.userId,
  username: backendUserInfo.userName,
  realName: backendUserInfo.userName,
  avatar: backendUserInfo.avatar || '',
  // ...
};
```

## 📋 新的响应格式

### 成功响应

```json
{
  "code": 0,
  "data": {
    "accessToken": "testuser_507f1f77bcf86cd799439011",
    "tokenInfo": {
      "accessToken": "testuser_507f1f77bcf86cd799439011",
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

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 访问令牌（兼容字段） |
| tokenInfo.accessToken | string | 访问令牌 |
| tokenInfo.expireTime | number | Token 过期时间（毫秒时间戳） |
| userInfo.userId | string | 用户ID（ObjectId） |
| userInfo.userName | string | 用户昵称 |
| userInfo.phone | string | 手机号 |
| userInfo.email | string | 邮箱 |
| userInfo.avatar | string | 头像URL |

## 🎯 优势

### 1. 减少请求次数
- **之前**: 登录 → 获取用户信息（2次请求）
- **现在**: 登录（1次请求，包含用户信息）

### 2. 完整的用户信息
- 用户昵称（userName）
- 手机号（phone）
- 邮箱（email）
- 头像（avatar）

### 3. Token 过期时间
- 前端可以知道 Token 何时过期
- 可以提前刷新 Token
- 可以显示登录有效期

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
    "accessToken": "testuser123_507f1f77bcf86cd799439011",
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

## 📝 后续优化建议

### 1. 显示更多用户信息
在前端界面显示：
- 用户昵称
- 手机号
- 邮箱
- 头像

### 2. Token 过期提醒
根据 `expireTime` 字段：
- 显示登录有效期
- Token 即将过期时提醒用户
- 自动刷新 Token

### 3. 用户资料页面
创建用户资料页面，显示和编辑：
- 用户昵称
- 手机号
- 邮箱
- 头像

### 4. 头像上传
实现头像上传功能：
- 上传图片到 OSS
- 更新用户头像 URL
- 在界面显示头像

## ✅ 验证清单

- [x] 后端返回完整用户信息
- [x] 前端正确解析用户信息
- [x] 显示用户昵称
- [x] Token 过期时间正确
- [x] 类型定义完整
- [x] 向后兼容（保留 accessToken 字段）

## 🎉 总结

登录接口现在返回完整的用户信息，包括：
- ✅ Token 信息（accessToken、expireTime）
- ✅ 用户信息（userId、userName、phone、email、avatar）
- ✅ 减少了额外的 API 请求
- ✅ 提供了更好的用户体验

---

**更新时间**: 2026-02-09
**文档版本**: 2.0.0
