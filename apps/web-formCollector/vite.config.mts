import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, '/server/formCollector'),
            // 后端服务地址（后端运行在 80 端口）
            target: 'http://localhost:80',
            ws: true,
          },
        },
      },
    },
  };
});
