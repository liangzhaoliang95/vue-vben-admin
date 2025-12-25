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
    // 使用 BASE_URL 确保在任何部署路径下都能正常访问
    source: `./logo.png`,
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
