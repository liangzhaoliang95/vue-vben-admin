# 接口请求封装 - 快速开始

## 📁 创建的文件

### 核心文件
- ✅ `src/api/request.ts` - HTTP 客户端配置（已优化）
- ✅ `src/api/form/form.ts` - 表单 API 示例
- ✅ `src/api/form/index.ts` - 表单 API 导出

### 文档文件
- ✅ `API_GUIDE.md` - 完整的 API 使用指南
- ✅ `API_IMPLEMENTATION_SUMMARY.md` - 实现总结
- ✅ `CLAUDE.md` - 项目文档（已更新）

### 示例文件
- ✅ `src/views/examples/FormListExample.vue` - 完整的组件使用示例

## 🚀 快速开始

### 1. 查看核心配置

```bash
# 查看 HTTP 客户端配置
cat src/api/request.ts
```

核心特性：
- ✅ 自动添加 Token（Bearer 前缀）
- ✅ 国际化支持（Accept-Language）
- ✅ Token 失效自动处理（code: 2）
- ✅ Token 自动刷新
- ✅ 统一错误提示

### 2. 查看 API 示例

```bash
# 查看表单 API 示例
cat src/api/form/form.ts
```

学习要点：
- ✅ 使用 namespace 组织类型
- ✅ 完整的 CRUD 操作
- ✅ TypeScript 工具类型（Omit、Partial）
- ✅ JSDoc 注释规范

### 3. 查看组件示例

```bash
# 查看完整的组件使用示例
cat src/views/examples/FormListExample.vue
```

示例包含：
- ✅ 列表查询（分页、搜索）
- ✅ 详情查看
- ✅ 创建、更新、删除
- ✅ 状态变更（发布）
- ✅ 错误处理
- ✅ Loading 状态

### 4. 阅读完整文档

```bash
# 查看完整的 API 使用指南
cat API_GUIDE.md
```

文档包含：
- ✅ 核心特性说明
- ✅ 拦截器详解
- ✅ 使用方式
- ✅ 最佳实践
- ✅ 常见问题（文件上传、下载、取消请求等）

## 📝 创建新的 API 模块

### 步骤 1: 创建目录和文件

```bash
# 创建新的 API 目录
mkdir -p src/api/your-module

# 创建 API 文件
touch src/api/your-module/your-api.ts
touch src/api/your-module/index.ts
```

### 步骤 2: 定义 API

```typescript
// src/api/your-module/your-api.ts
import { requestClient } from '#/api/request';

export namespace YourApi {
  export interface YourData {
    id: string;
    name: string;
  }

  export interface YourListParams {
    page?: number;
    pageSize?: number;
  }

  export interface YourListResult {
    items: YourData[];
    total: number;
  }
}

/**
 * 获取列表
 */
export async function getYourListApi(params: YourApi.YourListParams) {
  return requestClient.post<YourApi.YourListResult>('/your/list', params);
}

/**
 * 获取详情
 */
export async function getYourDetailApi(id: string) {
  return requestClient.get<YourApi.YourData>(`/your/${id}`);
}

/**
 * 创建
 */
export async function createYourApi(data: Omit<YourApi.YourData, 'id'>) {
  return requestClient.post<YourApi.YourData>('/your', data);
}

/**
 * 更新
 */
export async function updateYourApi(id: string, data: Partial<YourApi.YourData>) {
  return requestClient.put<YourApi.YourData>(`/your/${id}`, data);
}

/**
 * 删除
 */
export async function deleteYourApi(id: string) {
  return requestClient.delete(`/your/${id}`);
}
```

### 步骤 3: 导出 API

```typescript
// src/api/your-module/index.ts
export * from './your-api';
```

### 步骤 4: 在组件中使用

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getYourListApi, type YourApi } from '#/api/your-module';

const dataList = ref<YourApi.YourData[]>([]);
const loading = ref(false);

async function fetchData() {
  try {
    loading.value = true;
    const result = await getYourListApi({ page: 1, pageSize: 10 });
    dataList.value = result.items;
  } catch (error) {
    console.error('获取数据失败:', error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div>
    <a-table :data-source="dataList" :loading="loading" />
  </div>
</template>
```

## 🎯 最佳实践

### 1. 命名规范

- API 函数：`xxxApi` 后缀（如 `getFormListApi`）
- 类型定义：使用 namespace 组织（如 `FormApi.Form`）
- 参数类型：`XxxParams` 后缀（如 `FormListParams`）
- 返回类型：`XxxResult` 后缀（如 `FormListResult`）

### 2. 类型定义

```typescript
// ✅ 推荐：使用 namespace 组织
export namespace FormApi {
  export interface Form { ... }
  export interface FormListParams { ... }
  export interface FormListResult { ... }
}

// ❌ 不推荐：分散的类型定义
export interface Form { ... }
export interface FormListParams { ... }
export interface FormListResult { ... }
```

### 3. 错误处理

```typescript
// ✅ 推荐：简洁的错误处理
async function fetchData() {
  try {
    loading.value = true;
    const result = await getDataApi();
    data.value = result;
  } catch (error) {
    console.error('获取数据失败:', error);
    // 错误已由拦截器处理
  } finally {
    loading.value = false;
  }
}

// ❌ 不推荐：重复的错误提示
async function fetchData() {
  try {
    const result = await getDataApi();
    data.value = result;
  } catch (error) {
    message.error('获取数据失败'); // 拦截器已经提示了
  }
}
```

### 4. 使用 TypeScript 工具类型

```typescript
// 创建参数：排除自动生成的字段
export type CreateFormParams = Omit<Form, 'id' | 'createdAt' | 'updatedAt'>;

// 更新参数：所有字段可选
export type UpdateFormParams = Partial<CreateFormParams>;

// 只读类型
export type ReadonlyForm = Readonly<Form>;

// 选择部分字段
export type FormSummary = Pick<Form, 'id' | 'title' | 'status'>;
```

## 📚 参考文档

- [API_GUIDE.md](./API_GUIDE.md) - 完整的 API 使用指南
- [API_IMPLEMENTATION_SUMMARY.md](./API_IMPLEMENTATION_SUMMARY.md) - 实现总结
- [CLAUDE.md](./CLAUDE.md) - 项目文档
- [Vben Request 文档](https://doc.vben.pro/)
- [Axios 文档](https://axios-http.com/)

## 🔍 常见问题

### Q1: 如何处理文件上传？

参考 `API_GUIDE.md` 的"常见问题"章节。

### Q2: 如何处理文件下载？

参考 `API_GUIDE.md` 的"常见问题"章节。

### Q3: 如何取消请求？

参考 `API_GUIDE.md` 的"常见问题"章节。

### Q4: 如何处理并发请求？

参考 `API_GUIDE.md` 的"常见问题"章节。

### Q5: requestClient 和 baseRequestClient 有什么区别？

- **requestClient**: 自动提取 `data` 字段，适用于大多数业务接口
- **baseRequestClient**: 返回完整响应，适用于特殊场景（如登录、刷新 token）

## 🎉 完成！

现在你已经掌握了项目的接口请求封装模式，可以开始创建自己的 API 模块了！

如有问题，请查看：
1. `API_GUIDE.md` - 详细的使用指南
2. `src/api/form/form.ts` - 完整的 API 示例
3. `src/views/examples/FormListExample.vue` - 完整的组件示例
