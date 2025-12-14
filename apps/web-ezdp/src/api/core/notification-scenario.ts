/**
 * 通知场景配置相关 API
 */

import { requestClient } from '#/api/request';

export namespace NotificationScenarioApi {
  /** 可配置的场景项 */
  export interface AvailableScenarioItem {
    scenarioType: string;
    name: string;
    description: string;
  }

  /** 可配置场景列表返回 */
  export interface AvailableScenariosResult {
    scenarios: AvailableScenarioItem[];
  }

  /** 场景配置项 */
  export interface ScenarioItem {
    id: string;
    businessLineId: number;
    scenarioType: string;
    channelIds: string[];
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }

  /** 获取场景配置列表参数 */
  export type GetListParams = Record<string, never>;

  /** 更新场景配置参数 */
  export interface UpdateParams {
    id: string;
    channelIds: string[];
    enabled: boolean;
  }

  /** 创建场景配置参数 */
  export interface CreateParams {
    scenarioType: string;
    channelIds: string[];
    enabled: boolean;
  }
}

/**
 * 获取可配置的场景列表
 */
export async function getAvailableScenarios() {
  return requestClient.post<NotificationScenarioApi.AvailableScenariosResult>(
    '/notificationScenario/availableScenarios',
    {},
  );
}

/**
 * 获取场景配置列表
 */
export async function getNotificationScenarioList(
  params: NotificationScenarioApi.GetListParams = {},
) {
  return requestClient.post<NotificationScenarioApi.ScenarioItem[]>(
    '/notificationScenario/list',
    params,
  );
}

/**
 * 创建场景配置
 */
export async function createNotificationScenario(
  params: NotificationScenarioApi.CreateParams,
) {
  return requestClient.post<null>('/notificationScenario/create', params);
}

/**
 * 更新场景配置
 */
export async function updateNotificationScenario(
  params: NotificationScenarioApi.UpdateParams,
) {
  return requestClient.post<null>('/notificationScenario/update', params);
}
