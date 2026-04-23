import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/nc/login/doLogin', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh', {
    withCredentials: true,
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  // return requestClient.get<string[]>('/auth/codes');
  return [];
}

export namespace WorkWechatApi {
  /** 生成二维码配置返回值 */
  export interface QrcodeResult {
    corpId: string;
    agentId: string;
  }

  /** 通过企业微信code登录参数 */
  export interface LoginParams {
    key: string;
  }

  /** 登录返回值（与账号登录一致） */
  export interface LoginResult {
    accessToken: string;
  }
}

/**
 * 生成企业微信登录二维码配置
 */
export async function generateWorkWechatQrcodeApi() {
  return requestClient.post<WorkWechatApi.QrcodeResult>('/nc/wechatWork/generateQrCode');
}

/**
 * 通过企业微信code登录
 */
export async function workWechatLoginApi(params: WorkWechatApi.LoginParams) {
  return requestClient.post<WorkWechatApi.LoginResult>('/nc/wechatWork/checkLoginStatus', params);
}
