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
    watermark: true,
    watermarkContent: 'EZDP',
    accessMode: 'frontend',
  },
  copyright: {
    enable: true,
    companyName: 'Plaso',
    companySiteLink: 'https://www.plaso.cn',
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
