# Frontend 项目指南

> 基于 Vben Admin 5.x 的 Vue 3 + TypeScript Monorepo 项目

## 项目概览

这是一个使用 **Vue 3 + Vite + TypeScript** 构建的企业级表单收集应用前端项目，采用 **Monorepo** 架构，使用 **Turbo** 和 **pnpm workspace** 进行包管理。

### 核心技术栈

- **框架**: Vue 3.5 + Composition API + `<script setup>`
- **构建工具**: Vite 7.3
- **语言**: TypeScript 5.9 (严格模式)
- **状态管理**: Pinia 3.0 + pinia-plugin-persistedstate
- **路由**: Vue Router 4.6
- **UI 组件**: Ant Design Vue 4.2 + Shadcn UI + Tailwind CSS 3.4
- **HTTP 客户端**: Axios 1.13
- **表单验证**: Vee-Validate 4.15 + Zod 3.25
- **测试**: Vitest 3.2 (单元测试) + Playwright 1.58 (E2E)
- **代码质量**: ESLint 9 + Prettier 3 + Stylelint 16

## 项目结构

```
frontend/
├── apps/web-formCollector/      # 主应用
│   ├── src/
│   │   ├── adapter/             # 组件和表单适配器
│   │   ├── api/                 # API 接口定义
│   │   ├── layouts/             # 布局组件
│   │   ├── router/              # 路由配置
│   │   ├── store/               # Pinia 状态管理
│   │   ├── views/               # 页面组件
│   │   └── locales/             # 国际化配置
│   └── 配置文件
│
├── packages/                     # 共享包
│   ├── @core/                   # 核心 UI 包
│   │   ├── base/                # 基础包 (design, icons, shared, typings)
│   │   └── ui-kit/              # UI 组件库 (form, layout, menu, popup, shadcn, tabs)
│   ├── effects/                 # 功能包
│   │   ├── access/              # 权限管理
│   │   ├── common-ui/           # 通用 UI 组件
│   │   ├── hooks/               # 自定义 Hooks
│   │   ├── layouts/             # 布局组件
│   │   ├── plugins/             # Vue 插件
│   │   └── request/             # HTTP 请求库
│   ├── constants/               # 常量定义
│   ├── locales/                 # 国际化资源
│   ├── preferences/             # 偏好设置管理
│   ├── stores/                  # Pinia 存储
│   ├── styles/                  # 全局样式
│   ├── types/                   # TypeScript 类型定义
│   └── utils/                   # 工具函数
│
└── internal/                     # 内部工具和配置
    ├── lint-configs/            # Lint 配置 (eslint, prettier, stylelint, commitlint)
    ├── vite-config/             # Vite 配置
    ├── tailwind-config/         # Tailwind 配置
    └── tsconfig/                # TypeScript 配置
```

## 开发规范

### 1. 命名规范

```typescript
// 组件文件: PascalCase
LoginForm.vue
UserProfile.vue

// 组合式函数: camelCase (use 前缀)
useAuthStore()
useUserInfo()

// 常量: UPPER_SNAKE_CASE
const LOGIN_PATH = '/login'
const API_BASE_URL = '/api'

// 类型/接口: PascalCase
interface UserInfo {}
type LoginParams = {}

// 文件夹: kebab-case
user-profile/
form-builder/
```

### 2. 组件开发规范

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

// 1. 定义组件选项
defineOptions({
  name: 'ComponentName',
})

// 2. 定义 Props
interface Props {
  title: string
  count?: number
}
const props = withDefaults(defineProps<Props>(), {
  count: 0,
})

// 3. 定义 Emits
interface Emits {
  (e: 'update', value: string): void
  (e: 'submit'): void
}
const emit = defineEmits<Emits>()

// 4. 响应式数据
const loading = ref(false)
const data = ref<string[]>([])

// 5. 计算属性
const displayTitle = computed(() => `${props.title} (${props.count})`)

// 6. 方法
const handleSubmit = () => {
  emit('submit')
}

// 7. 生命周期
onMounted(() => {
  // 初始化逻辑
})
</script>

<template>
  <div class="component-name">
    <h1>{{ displayTitle }}</h1>
    <button @click="handleSubmit">提交</button>
  </div>
</template>

<style scoped>
/* 使用 Tailwind 优先，必要时使用 scoped CSS */
</style>
```

### 3. 状态管理规范

```typescript
// stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore(
  'user',
  () => {
    // State
    const userInfo = ref<UserInfo | null>(null)
    const token = ref<string>('')

    // Getters
    const isLoggedIn = computed(() => !!token.value)
    const userName = computed(() => userInfo.value?.name ?? '')

    // Actions
    const setUserInfo = (info: UserInfo) => {
      userInfo.value = info
    }

    const setToken = (newToken: string) => {
      token.value = newToken
    }

    const logout = () => {
      userInfo.value = null
      token.value = ''
    }

    return {
      // State
      userInfo,
      token,
      // Getters
      isLoggedIn,
      userName,
      // Actions
      setUserInfo,
      setToken,
      logout,
    }
  },
  {
    // 持久化配置
    persist: {
      key: 'user-store',
      storage: localStorage,
      paths: ['token', 'userInfo'],
    },
  }
)
```

### 4. API 请求规范

```typescript
// api/user.ts
import { requestClient } from '#/api/request'

export namespace UserApi {
  export interface LoginParams {
    username: string
    password: string
  }

  export interface LoginResult {
    token: string
    refreshToken: string
    userInfo: UserInfo
  }

  export interface UserInfo {
    id: string
    username: string
    email: string
    roles: string[]
  }
}

/**
 * 用户登录
 */
export async function loginApi(data: UserApi.LoginParams) {
  return requestClient.post<UserApi.LoginResult>('/auth/login', data)
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<UserApi.UserInfo>('/user/info')
}

/**
 * 更新用户信息
 */
export async function updateUserInfoApi(data: Partial<UserApi.UserInfo>) {
  return requestClient.put<UserApi.UserInfo>('/user/info', data)
}
```

### 5. 路由配置规范

```typescript
// router/routes/modules/user.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/user',
    name: 'User',
    component: () => import('#/layouts/basic.vue'),
    meta: {
      title: '用户管理',
      icon: 'lucide:user',
      order: 1,
    },
    children: [
      {
        path: 'profile',
        name: 'UserProfile',
        component: () => import('#/views/user/profile/index.vue'),
        meta: {
          title: '个人资料',
          icon: 'lucide:user-circle',
        },
      },
      {
        path: 'settings',
        name: 'UserSettings',
        component: () => import('#/views/user/settings/index.vue'),
        meta: {
          title: '账户设置',
          icon: 'lucide:settings',
          // 权限控制
          authority: ['user:settings:view'],
        },
      },
    ],
  },
]

export default routes
```

### 6. 表单开发规范

```vue
<script setup lang="ts">
import { z } from 'zod'
import { useVbenForm } from '@vben/common-ui'

// 定义表单 Schema
const formSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  age: z.number().int().min(18, '年龄必须大于18岁').max(100),
  role: z.enum(['admin', 'user', 'guest']),
})

// 创建表单实例
const [Form, formApi] = useVbenForm({
  // 表单配置
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
  },
  // 表单项配置
  schema: [
    {
      component: 'Input',
      fieldName: 'username',
      label: '用户名',
      rules: z.string().min(3).max(20),
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: '邮箱',
      componentProps: {
        type: 'email',
      },
      rules: z.string().email(),
    },
    {
      component: 'InputNumber',
      fieldName: 'age',
      label: '年龄',
      rules: z.number().int().min(18).max(100),
    },
    {
      component: 'Select',
      fieldName: 'role',
      label: '角色',
      componentProps: {
        options: [
          { label: '管理员', value: 'admin' },
          { label: '普通用户', value: 'user' },
          { label: '访客', value: 'guest' },
        ],
      },
      rules: z.enum(['admin', 'user', 'guest']),
    },
  ],
  // 提交处理
  handleSubmit: async (values) => {
    try {
      // 验证数据
      const validated = formSchema.parse(values)
      // 提交到后端
      await submitApi(validated)
      // 成功提示
      message.success('提交成功')
    } catch (error) {
      if (error instanceof z.ZodError) {
        // 处理验证错误
        console.error('验证失败:', error.errors)
      }
      throw error
    }
  },
})
</script>

<template>
  <Form />
</template>
```

### 7. 权限控制规范

```vue
<script setup lang="ts">
import { useAccess } from '@vben/access'

const { hasAccessByCodes } = useAccess()

// 检查权限
const canEdit = hasAccessByCodes(['user:edit'])
const canDelete = hasAccessByCodes(['user:delete'])
</script>

<template>
  <div>
    <!-- 使用 v-access 指令 -->
    <button v-access="'user:edit'">编辑</button>
    <button v-access="'user:delete'">删除</button>

    <!-- 使用函数判断 -->
    <button v-if="canEdit">编辑</button>
    <button v-if="canDelete">删除</button>

    <!-- 多个权限码（满足任一即可） -->
    <button v-access="['user:edit', 'user:update']">编辑</button>

    <!-- 多个权限码（必须全部满足） -->
    <button v-access="{ codes: ['user:edit', 'user:update'], mode: 'all' }">
      编辑
    </button>
  </div>
</template>
```

### 8. 国际化规范

```typescript
// locales/zh-CN/user.json
{
  "user": {
    "profile": "个人资料",
    "settings": "账户设置",
    "logout": "退出登录",
    "form": {
      "username": "用户名",
      "email": "邮箱",
      "password": "密码",
      "confirmPassword": "确认密码"
    },
    "validation": {
      "usernameRequired": "请输入用户名",
      "emailInvalid": "请输入有效的邮箱地址",
      "passwordMismatch": "两次密码输入不一致"
    }
  }
}
```

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div>
    <h1>{{ t('user.profile') }}</h1>
    <input :placeholder="t('user.form.username')" />
  </div>
</template>
```

## 代码质量要求

### 1. 不可变性 (CRITICAL)

```typescript
// ❌ 错误: 直接修改对象
function updateUser(user: User, name: string) {
  user.name = name // 禁止！
  return user
}

// ✅ 正确: 创建新对象
function updateUser(user: User, name: string) {
  return {
    ...user,
    name,
  }
}

// ❌ 错误: 直接修改数组
function addItem(list: Item[], item: Item) {
  list.push(item) // 禁止！
  return list
}

// ✅ 正确: 创建新数组
function addItem(list: Item[], item: Item) {
  return [...list, item]
}
```

### 2. 错误处理

```typescript
// API 请求错误处理
async function fetchUserData(userId: string) {
  try {
    const response = await getUserApi(userId)
    return response.data
  } catch (error) {
    console.error('获取用户数据失败:', error)
    // 显示用户友好的错误消息
    message.error('获取用户数据失败，请稍后重试')
    throw new Error(`Failed to fetch user data: ${userId}`)
  }
}

// 组件中的错误处理
const handleSubmit = async () => {
  try {
    loading.value = true
    await submitForm()
    message.success('提交成功')
  } catch (error) {
    console.error('提交失败:', error)
    message.error('提交失败，请检查输入后重试')
  } finally {
    loading.value = false
  }
}
```

### 3. 输入验证

```typescript
import { z } from 'zod'

// 定义验证 Schema
const userSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  age: z.number().int().min(18).max(150),
  role: z.enum(['admin', 'user', 'guest']),
})

// 验证输入
function validateUserInput(input: unknown) {
  try {
    const validated = userSchema.parse(input)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    throw error
  }
}
```

### 4. 代码质量检查清单

提交代码前必须检查：

- [ ] 代码可读性良好，命名清晰
- [ ] 函数保持简短 (<50 行)
- [ ] 文件保持专注 (<800 行)
- [ ] 无深层嵌套 (>4 层)
- [ ] 完善的错误处理
- [ ] 无 console.log 语句
- [ ] 无硬编码值
- [ ] 使用不可变模式
- [ ] TypeScript 类型完整
- [ ] 通过 ESLint 检查
- [ ] 通过 Prettier 格式化
- [ ] 通过 TypeScript 类型检查

## 开发工作流

### 1. 启动开发服务器

```bash
# 启动所有应用
pnpm dev

# 启动特定应用
pnpm dev:formCollector
```

### 2. 构建生产版本

```bash
# 构建所有应用
pnpm build

# 构建特定应用
pnpm build:formCollector
```

### 3. 代码检查和格式化

```bash
# 代码检查
pnpm lint

# 代码格式化
pnpm format

# 完整检查（循环依赖、类型、拼写）
pnpm check

# TypeScript 类型检查
pnpm check:type
```

### 4. 测试

```bash
# 单元测试
pnpm test:unit

# E2E 测试
pnpm test:e2e

# 测试覆盖率
pnpm test:unit --coverage
```

### 5. 添加新功能的完整流程

```bash
# 1. 创建功能分支
git checkout -b feat/new-feature

# 2. 开发功能（遵循 TDD）
# - 编写测试
# - 实现功能
# - 运行测试确保通过

# 3. 代码检查
pnpm lint
pnpm check:type

# 4. 运行测试
pnpm test:unit

# 5. 提交代码
git add .
git commit -m "feat: add new feature"

# 6. 推送到远程
git push -u origin feat/new-feature

# 7. 创建 Pull Request
```

## 性能优化建议

### 1. 组件懒加载

```typescript
// 路由懒加载
const routes = [
  {
    path: '/user',
    component: () => import('#/views/user/index.vue'),
  },
]

// 组件懒加载
const HeavyComponent = defineAsyncComponent(() =>
  import('./components/HeavyComponent.vue')
)
```

### 2. 使用 computed 缓存计算结果

```typescript
// ✅ 使用 computed 缓存
const filteredList = computed(() => {
  return list.value.filter(item => item.active)
})

// ❌ 避免在模板中直接计算
// <div v-for="item in list.filter(i => i.active)">
```

### 3. 使用 v-show 代替 v-if（频繁切换）

```vue
<!-- 频繁切换使用 v-show -->
<div v-show="isVisible">内容</div>

<!-- 条件渲染使用 v-if -->
<div v-if="hasPermission">内容</div>
```

### 4. 使用虚拟滚动处理大列表

```vue
<script setup lang="ts">
import { VirtualList } from '@vben/common-ui'

const items = ref<Item[]>([]) // 大量数据
</script>

<template>
  <VirtualList :items="items" :item-height="50">
    <template #default="{ item }">
      <div>{{ item.name }}</div>
    </template>
  </VirtualList>
</template>
```

## 常见问题

### 1. 如何添加新的 API 接口？

在 `apps/web-formCollector/src/api/` 目录下创建或编辑文件：

```typescript
// api/user.ts
export async function getUserListApi(params: QueryParams) {
  return requestClient.get<UserList>('/users', { params })
}
```

### 2. 如何添加新的路由？

在 `apps/web-formCollector/src/router/routes/modules/` 目录下创建新文件：

```typescript
// router/routes/modules/example.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/example',
    name: 'Example',
    component: () => import('#/views/example/index.vue'),
    meta: {
      title: '示例页面',
      icon: 'lucide:file',
    },
  },
]

export default routes
```

### 3. 如何添加新的 Store？

在 `apps/web-formCollector/src/store/` 目录下创建新文件：

```typescript
// store/example.ts
import { defineStore } from 'pinia'

export const useExampleStore = defineStore('example', () => {
  const data = ref<Data[]>([])

  const fetchData = async () => {
    const response = await getDataApi()
    data.value = response.data
  }

  return {
    data,
    fetchData,
  }
})
```

### 4. 如何自定义主题？

修改 `apps/web-formCollector/src/preferences.ts`：

```typescript
export const overridesPreferences = {
  theme: {
    mode: 'dark', // 'light' | 'dark' | 'auto'
    colorPrimary: '#1890ff',
  },
}
```

### 5. 如何处理环境变量？

在 `.env.development` 或 `.env.production` 中定义：

```bash
# .env.development
VITE_API_URL=http://localhost:3000
VITE_APP_TITLE=表单收集器
```

在代码中使用：

```typescript
const apiUrl = import.meta.env.VITE_API_URL
const appTitle = import.meta.env.VITE_APP_TITLE
```

## 项目特色功能

### 1. 动态路由和权限系统

- 基于角色的访问控制 (RBAC)
- 动态路由生成
- 细粒度权限控制

### 2. 完整的认证系统

- 登录/注册/忘记密码
- Token 自动刷新
- 权限码管理

### 3. 国际化支持

- 多语言切换
- 组件库本地化
- 动态语言加载

### 4. 主题系统

- 亮色/暗色主题
- 自定义主题色
- 紧凑模式

### 5. 表单构建器

- 可视化表单设计
- 丰富的表单组件
- 表单验证和提交

## 相关资源

- [Vben Admin 文档](https://doc.vben.pro/)
- [Vue 3 文档](https://cn.vuejs.org/)
- [Vite 文档](https://cn.vitejs.dev/)
- [Ant Design Vue 文档](https://antdv.com/)
- [Pinia 文档](https://pinia.vuejs.org/zh/)
- [VueUse 文档](https://vueuse.org/)

## 注意事项

1. **始终使用 TypeScript** - 不要使用 `any` 类型
2. **遵循不可变性原则** - 永远不要直接修改对象或数组
3. **完善的错误处理** - 所有异步操作都要有 try-catch
4. **输入验证** - 使用 Zod 验证所有用户输入
5. **代码质量** - 提交前运行 `pnpm lint` 和 `pnpm check:type`
6. **测试覆盖** - 新功能必须有单元测试
7. **性能优化** - 使用懒加载、computed、虚拟滚动等
8. **无 console.log** - 生产代码中不要有 console.log
9. **小文件原则** - 文件保持在 800 行以内
10. **清晰命名** - 使用描述性的变量和函数名
