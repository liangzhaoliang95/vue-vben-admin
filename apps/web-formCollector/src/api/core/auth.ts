import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    email: string;
    password: string;
  }

  /** 注册接口参数 */
  export interface RegisterParams {
    username: string;
    email: string;
    password: string;
  }

  /** 后端用户信息 */
  export interface BackendUser {
    id: number;
    username: string;
    email: string;
  }

  /** 后端响应格式 */
  export interface BackendResponse<T = any> {
    success: boolean;
    message?: string;
    token?: string;
    user?: T;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    user: BackendUser;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录
 */
export async function loginApi(
  data: AuthApi.LoginParams,
): Promise<AuthApi.LoginResult> {
  const response = await baseRequestClient.post<
    AuthApi.BackendResponse<AuthApi.BackendUser>
  >('/auth/login', data);

  if (!response.success) {
    throw new Error(response.message || '登录失败');
  }

  return {
    accessToken: response.token!,
    user: response.user!,
  };
}

/**
 * 注册
 */
export async function registerApi(
  data: AuthApi.RegisterParams,
): Promise<AuthApi.BackendResponse> {
  const response = await baseRequestClient.post<AuthApi.BackendResponse>(
    '/auth/register',
    data,
  );

  if (!response.success) {
    throw new Error(response.message || '注册失败');
  }

  return response;
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
  return requestClient.get<string[]>('/auth/codes');
}
