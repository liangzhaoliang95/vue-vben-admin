import { defineOverridesPreferences } from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    name: import.meta.env.VITE_APP_TITLE,
    loginExpiredMode: 'page',
    enableRefreshToken: false,
    watermark: false,
    watermarkContent: 'EZDP',
    accessMode: 'backend',
    defaultHomePath: '/package-deploy-management/project-deploy',
  },
  logo: {
    enable: true,
    fit: 'contain',
    // 可以使用以下任一方式:
    // 1. 网络图片地址
    // source: 'https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp',
    // 2. 本地图片路径 (需要放在 public 目录)
    source: '/logo.png',
    // 3. 导入的图片
    // source: new URL('./assets/logo.png', import.meta.url).href,
  },
  copyright: {
    enable: true,
    companyName: 'liangzhaoliang',
    companySiteLink: 'https://github.com/liangzhaoliang95',
    date: '2025',
    icp: '',
    icpLink: '',
    settingShow: true,
  },
  breadcrumb: {
    showHome: true,
    styleType: 'background',
  },
  footer: {
    enable: true,
    fixed: true,
  },
  sidebar: {
    width: 220,
  },
  tabbar: {
    maxCount: 10,
    middleClickToClose: true,
  },
});
