# API 接口封装指南

## 概述

本项目参考 ezdp 项目的接口封装模式，提供了完善的 HTTP 请求封装和错误处理机制。

## 核心特性

### 1. 请求拦截器

- **自动添加 Token**: 从 `accessStore` 获取 token 并添加到请求头
- **国际化支持**: 自动添加 `Accept-Language` 请求头
- **Token 格式化**: 自动添加 `Bearer` 前缀

### 2. 响应拦截器

响应拦截器按以下顺序执行：

1. **defaultResponseInterceptor**: 处理标准响应格式
   - 检查 `code` 字段（成功码为 0）
   - 提取 `data` 字段
   - code 不为 0 时抛出错误

2. **code: 2 特殊处理**: Token 失效处理
   - 检测 `code === 2` 的情况
   - 显示登录过期提示
   - 自动跳转到登录页

3. **authenticateResponseInterceptor**: Token 刷新
   - 自动刷新过期的 token
   - 重试失败的请求
   - 刷新失败时触发重新认证

4. **errorMessageResponseInterceptor**: 通用错误处理
   - 显示用户友好的错误消息
   - 支持自定义错误字段（error/message）
   - 根据 HTTP 状态码提示

## 使用方式

### 1. 定义 API 接口

使用 namespace 组织类型定义和接口：

```typescript
// api/form/form.ts
import { requestClient } from '#/api/request';

export namespace FormApi {
  /** 表单基础信息 */
  export interface Form {
    id: string;
    title: string;
    description?: string;
    status: 'draft' | 'published' | 'closed';
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }

  /** 表单列表查询参数 */
  export interface FormListParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: 'draft' | 'published' | 'closed';
  }

  /** 表单列表响应 */
  export interface FormListResult {
    items: Form[];
    total: number;
  }

  /** 创建表单参数 */
  export type CreateFormParams = Omit<
    Form,
    'id' | 'createdAt' | 'updatedAt' | 'createdBy'
  >;

  /** 更新表单参数 */
  export type UpdateFormParams = Partial<CreateFormParams>;
}

/**
 * 获取表单列表
 */
export async function getFormListApi(params: FormApi.FormListParams) {
  return requestClient.post<FormApi.FormListResult>('/form/list', params);
}

/**
 * 获取表单详情
 * @param id 表单 ID
 */
export async function getFormDetailApi(id: string) {
  return requestClient.get<FormApi.Form>(`/form/${id}`);
}

/**
 * 创建表单
 * @param data 表单数据
 */
export async function createFormApi(data: FormApi.CreateFormParams) {
  return requestClient.post<FormApi.Form>('/form', data);
}

/**
 * 更新表单
 * @param id 表单 ID
 * @param data 表单数据
 */
export async function updateFormApi(
  id: string,
  data: FormApi.UpdateFormParams,
) {
  return requestClient.put<FormApi.Form>(`/form/${id}`, data);
}

/**
 * 删除表单
 * @param id 表单 ID
 */
export async function deleteFormApi(id: string) {
  return requestClient.delete(`/form/${id}`);
}
```

### 2. 在组件中使用

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { getFormListApi, createFormApi, type FormApi } from '#/api/form';

// 表单列表数据
const formList = ref<FormApi.Form[]>([]);
const loading = ref(false);
const total = ref(0);

// 查询参数
const queryParams = ref<FormApi.FormListParams>({
  page: 1,
  pageSize: 10,
  status: 'published',
});

/**
 * 获取表单列表
 */
async function fetchFormList() {
  try {
    loading.value = true;
    const result = await getFormListApi(queryParams.value);
    formList.value = result.items;
    total.value = result.total;
  } catch (error) {
    console.error('获取表单列表失败:', error);
    // 错误已由拦截器处理，这里只需记录日志
  } finally {
    loading.value = false;
  }
}

/**
 * 创建表单
 */
async function handleCreateForm() {
  try {
    const formData: FormApi.CreateFormParams = {
      title: '新表单',
      description: '这是一个新表单',
      status: 'draft',
    };

    await createFormApi(formData);
    message.success('创建成功');

    // 刷新列表
    await fetchFormList();
  } catch (error) {
    console.error('创建表单失败:', error);
    // 错误已由拦截器处理
  }
}

onMounted(() => {
  fetchFormList();
});
</script>

<template>
  <div>
    <a-button @click="handleCreateForm">创建表单</a-button>

    <a-table
      :data-source="formList"
      :loading="loading"
      :pagination="{
        current: queryParams.page,
        pageSize: queryParams.pageSize,
        total: total,
      }"
    >
      <a-table-column key="title" title="标题" data-index="title" />
      <a-table-column key="status" title="状态" data-index="status" />
    </a-table>
  </div>
</template>
```

## 最佳实践

### 1. 使用 namespace 组织类型

```typescript
export namespace UserApi {
  export interface User {
    id: string;
    username: string;
    email: string;
  }

  export interface LoginParams {
    email: string;
    password: string;
  }

  export interface LoginResult {
    accessToken: string;
    user: User;
  }
}
```

### 2. 使用 TypeScript 工具类型

```typescript
// 创建参数：排除自动生成的字段
export type CreateFormParams = Omit<Form, 'id' | 'createdAt' | 'updatedAt'>;

// 更新参数：所有字段可选
export type UpdateFormParams = Partial<CreateFormParams>;

// 只读类型
export type ReadonlyForm = Readonly<Form>;
```

### 3. 完善的 JSDoc 注释

```typescript
/**
 * 获取表单详情
 * @param id 表单 ID
 * @returns 表单详情
 * @throws {Error} 表单不存在时抛出错误
 */
export async function getFormDetailApi(id: string) {
  return requestClient.get<FormApi.Form>(`/form/${id}`);
}
```

### 4. 错误处理

```typescript
async function handleSubmit() {
  try {
    loading.value = true;
    await submitFormApi(formData);
    message.success('提交成功');
  } catch (error) {
    console.error('提交失败:', error);
    // 错误消息已由拦截器显示，这里只需记录日志
  } finally {
    loading.value = false;
  }
}
```

### 5. 使用 requestClient 和 baseRequestClient

- **requestClient**: 自动提取 `data` 字段，适用于大多数业务接口
- **baseRequestClient**: 返回完整响应，适用于特殊场景（如登录、刷新 token）

```typescript
// 使用 requestClient（推荐）
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
  // 直接返回 UserInfo 类型
}

// 使用 baseRequestClient（特殊场景）
export async function loginApi(data: AuthApi.LoginParams) {
  const response = await baseRequestClient.post<AuthApi.BackendResponse>(
    '/auth/login',
    data
  );
  // 需要手动处理响应格式
  if (!response.success) {
    throw new Error(response.message || '登录失败');
  }
  return {
    accessToken: response.token!,
    user: response.user!,
  };
}
```

## 响应格式约定

### 标准成功响应

```json
{
  "code": 0,
  "data": {
    "id": "1",
    "title": "表单标题"
  },
  "message": "操作成功"
}
```

### 标准错误响应

```json
{
  "code": 1,
  "message": "操作失败",
  "error": "详细错误信息"
}
```

### Token 失效响应

```json
{
  "code": 2,
  "message": "登录已过期，请重新登录"
}
```

## 常见问题

### 1. 如何处理文件上传？

```typescript
export async function uploadFileApi(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return requestClient.post<{ url: string }>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}
```

### 2. 如何处理下载文件？

```typescript
export async function downloadFileApi(id: string) {
  return requestClient.get(`/file/${id}/download`, {
    responseType: 'blob',
  });
}
```

### 3. 如何取消请求？

```typescript
import { ref } from 'vue';

const abortController = ref<AbortController>();

async function fetchData() {
  // 取消之前的请求
  abortController.value?.abort();

  // 创建新的 AbortController
  abortController.value = new AbortController();

  try {
    const result = await requestClient.get('/data', {
      signal: abortController.value.signal,
    });
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求已取消');
    }
    throw error;
  }
}
```

### 4. 如何处理并发请求？

```typescript
async function fetchMultipleData() {
  try {
    const [users, forms, settings] = await Promise.all([
      getUserListApi(),
      getFormListApi(),
      getSettingsApi(),
    ]);

    return { users, forms, settings };
  } catch (error) {
    console.error('获取数据失败:', error);
    throw error;
  }
}
```

## 参考资源

- [Vben Request 文档](https://doc.vben.pro/)
- [Axios 文档](https://axios-http.com/)
- [TypeScript 工具类型](https://www.typescriptlang.org/docs/handbook/utility-types.html)
