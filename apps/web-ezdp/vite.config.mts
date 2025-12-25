import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      // 使用相对路径，确保打包后可以部署在任何路径下
      base: './',
      server: {
        proxy: {
          '/server': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/server/, ''),
            // 后端服务地址（使用 127.0.0.1 避免 DNS 解析延迟）
            target: 'http://127.0.0.1:80/server',
            ws: true,
          },
        },
      },
    },
  };
});
