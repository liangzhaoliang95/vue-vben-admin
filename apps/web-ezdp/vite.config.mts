import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/server': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/server/, ''),
            // mock代理目标地址
            target: 'http://localhost/server',
            ws: true,
          },
        },
      },
    },
  };
});
