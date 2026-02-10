# 接口请求封装完成总结

## 完成的工作

### 1. 优化 request.ts 配置文件

参考 ezdp 项目，对 `frontend/apps/web-formCollector/src/api/request.ts` 进行了以下优化：

#### 新增功能：
- ✅ **国际化支持**: 引入 `$t` 函数用于错误提示的国际化
- ✅ **code: 2 特殊处理**: 添加专门的响应拦截器处理 token 失效（code === 2）的情况
  - 自动显示登录过期提示
  - 自动跳转到登录页
  - 阻止后续错误处理

#### 响应拦截器执行顺序：
1. **defaultResponseInterceptor**: 处理标准响应格式（code/data/successCode）
2. **code: 2 拦截器**: 处理 token 失效的特殊情况
3. **authenticateResponseInterceptor**: 自动刷新过期的 token
4. **errorMessageResponseInterceptor**: 统一错误提示

### 2. 创建示例 API 文件

创建了 `frontend/apps/web-formCollector/src/api/form/form.ts`，展示了完整的 API 封装模式：

- ✅ 使用 namespace 组织类型定义
- ✅ 完整的 CRUD 操作示例
- ✅ TypeScript 工具类型的使用（Omit、Partial）
- ✅ 完善的 JSDoc 注释
- ✅ RESTful API 设计

### 3. 创建 API 使用指南

创建了 `frontend/apps/web-formCollector/API_GUIDE.md`，包含：

- ✅ 核心特性说明
- ✅ 请求/响应拦截器详解
- ✅ 完整的使用示例
- ✅ 最佳实践
- ✅ 常见问题解答（文件上传、下载、取消请求、并发请求等）
- ✅ 响应格式约定

### 4. 更新项目文档

更新了 `frontend/apps/web-formCollector/CLAUDE.md`：

- ✅ 添加 API 封装特性说明
- ✅ 添加使用示例
- ✅ 添加 API_GUIDE.md 的引用

## 核心改进点

### 1. 更完善的错误处理

```typescript
// 处理 code: 2 (token失效) 的情况
client.addResponseInterceptor({
  rejected: async (error: any) => {
    const responseData = error?.response?.data ?? error?.data ?? {};
    if (responseData?.code === 2) {
      const authStore = useAuthStore();
      message.warning($t('authentication.loginAgainSubTitle'));
      await authStore.logout(false);
      throw error;
    }
    throw error;
  },
});
```

### 2. 国际化支持

```typescript
import { $t } from '#/locales';

// 使用国际化提示
message.warning($t('authentication.loginAgainSubTitle'));
```

### 3. 规范的 API 定义模式

```typescript
export namespace FormApi {
  export interface Form {
    id: string;
    title: string;
    status: 'draft' | 'published' | 'closed';
  }

  export type CreateFormParams = Omit<Form, 'id' | 'createdAt' | 'updatedAt'>;
  export type UpdateFormParams = Partial<CreateFormParams>;
}

export async function getFormListApi(params: FormApi.FormListParams) {
  return requestClient.post<FormApi.FormListResult>('/form/list', params);
}
```

## 与 ezdp 项目的对比

| 特性 | ezdp 项目 | 当前项目 | 状态 |
|------|----------|---------|------|
| 请求拦截器 | ✅ Token + 国际化 | ✅ Token + 国际化 | ✅ 已实现 |
| 响应格式处理 | ✅ defaultResponseInterceptor | ✅ defaultResponseInterceptor | ✅ 已实现 |
| code: 2 处理 | ✅ 专门拦截器 | ✅ 专门拦截器 | ✅ 已实现 |
| Token 刷新 | ✅ authenticateResponseInterceptor | ✅ authenticateResponseInterceptor | ✅ 已实现 |
| 错误提示 | ✅ errorMessageResponseInterceptor | ✅ errorMessageResponseInterceptor | ✅ 已实现 |
| namespace 组织 | ✅ 使用 namespace | ✅ 使用 namespace | ✅ 已实现 |
| 完善的类型定义 | ✅ 完整类型 | ✅ 完整类型 | ✅ 已实现 |

## 使用建议

### 1. 创建新的 API 模块

```bash
# 创建新的 API 目录
mkdir -p frontend/apps/web-formCollector/src/api/your-module

# 创建 API 文件
touch frontend/apps/web-formCollector/src/api/your-module/your-api.ts
touch frontend/apps/web-formCollector/src/api/your-module/index.ts
```

### 2. 参考示例文件

- 参考 `api/form/form.ts` 了解 API 定义模式
- 参考 `api/core/auth.ts` 了解特殊响应处理
- 参考 `API_GUIDE.md` 了解最佳实践

### 3. 遵循命名规范

- API 函数：`xxxApi` 后缀（如 `getFormListApi`）
- 类型定义：使用 namespace 组织（如 `FormApi.Form`）
- 参数类型：`XxxParams` 后缀（如 `FormListParams`）
- 返回类型：`XxxResult` 后缀（如 `FormListResult`）

## 后续优化建议

1. **添加请求重试机制**: 对于网络错误，可以自动重试
2. **添加请求缓存**: 对于不常变化的数据，可以添加缓存
3. **添加请求队列**: 控制并发请求数量
4. **添加请求日志**: 记录所有请求用于调试
5. **添加 Mock 数据**: 开发阶段使用 Mock 数据

## 相关文件

- `frontend/apps/web-formCollector/src/api/request.ts` - HTTP 客户端配置
- `frontend/apps/web-formCollector/src/api/form/form.ts` - 表单 API 示例
- `frontend/apps/web-formCollector/API_GUIDE.md` - API 使用指南
- `frontend/apps/web-formCollector/CLAUDE.md` - 项目文档

## 参考资源

- [ezdp 项目 request.ts](~/xiaozaoWorkspace/ezdp/frontend/apps/web-ezdp/src/api/request.ts)
- [Vben Request 文档](https://doc.vben.pro/)
- [Axios 文档](https://axios-http.com/)
