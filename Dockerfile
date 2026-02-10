# 第一阶段：构建前端应用
FROM node:20-alpine AS builder

# 安装必要的构建工具
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 启用 corepack 并准备 pnpm
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# 复制所有源代码（.dockerignore 会排除 node_modules 和 dist）
COPY . .

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建 internal packages（stub 模式，生成类型定义和代理文件）
RUN pnpm -r run stub --if-present

# 构建项目
RUN pnpm run build:formCollector

# 第二阶段：运行 nginx
FROM nginx:alpine

# 复制构建产物到 nginx 目录
COPY --from=builder /app/apps/web-formCollector/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY scripts/deploy/nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE 8080

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
