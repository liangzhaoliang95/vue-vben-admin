import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    email: string; // 邮箱
    password: string; // 密码
  }

  /** Token 信息 */
  export interface TokenInfo {
    accessToken: string; // 访问令牌
    expireTime: number; // 过期时间（毫秒时间戳）
  }

  /** 用户信息 */
  export interface UserInfo {
    userId: string; // 用户ID
    userName: string; // 用户名（昵称）
    phone: string; // 手机号
    email: string; // 邮箱
    avatar: string; // 头像URL
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    tokenInfo: TokenInfo; // Token信息
    userInfo: UserInfo; // 用户信息
  }

  /** 注册接口参数 */
  export interface RegisterParams {
    email: string; // 邮箱（必填）
    userName: string; // 用户昵称（2-50字符）
    password: string; // 密码（6-20字符）
    code: string; // 邮箱验证码（6位）
  }

  /** 注册接口返回值 */
  export interface RegisterResult {
    token: string; // Token
    userId: string; // 用户ID
    userName: string; // 用户名
    email: string; // 邮箱
  }

  /** 发送验证码参数 */
  export interface SendCodeParams {
    email: string; // 邮箱
  }

  /** 重置密码参数 */
  export interface ResetPasswordParams {
    email: string; // 邮箱
    code: string; // 验证码
    newPassword: string; // 新密码
  }

  /** 检查邮箱参数 */
  export interface CheckEmailParams {
    email: string; // 邮箱
  }

  /** 检查邮箱返回值 */
  export interface CheckEmailResult {
    exists: boolean; // 是否存在
  }

  /** 后端用户信息 */
  export interface BackendUser {
    userId: string; // 用户ID
    loginName: string; // 登录名
    userName: string; // 用户名
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
    accessToken: string; // 访问令牌
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
  const response = await requestClient.post<AuthApi.LoginResult>(
    '/nc/login/doLogin',
    data,
  );

  return response;
}

/**
 * 注册
 */
export async function registerApi(
  data: AuthApi.RegisterParams,
): Promise<AuthApi.RegisterResult> {
  const response = await requestClient.post<AuthApi.RegisterResult>(
    '/auth/register',
    data,
  );

  return response;
}

/**
 * 发送注册验证码
 */
export async function sendRegisterCodeApi(
  data: AuthApi.SendCodeParams,
): Promise<void> {
  await requestClient.post('/auth/sendRegisterCode', data);
}

/**
 * 发送重置密码验证码
 */
export async function sendResetPasswordCodeApi(
  data: AuthApi.SendCodeParams,
): Promise<void> {
  await requestClient.post('/auth/sendResetPasswordCode', data);
}

/**
 * 重置密码
 */
export async function resetPasswordApi(
  data: AuthApi.ResetPasswordParams,
): Promise<void> {
  await requestClient.post('/auth/resetPassword', data);
}

/**
 * 检查邮箱是否已存在
 */
export async function checkEmailExistsApi(
  data: AuthApi.CheckEmailParams,
): Promise<AuthApi.CheckEmailResult> {
  return await requestClient.post<AuthApi.CheckEmailResult>(
    '/auth/checkEmailExists',
    data,
  );
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
