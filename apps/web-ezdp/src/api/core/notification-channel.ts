import { requestClient } from '#/api/request';

export namespace NotificationChannelApi {
  export interface WecomConfig {
    webhookUrl: string;
  }

  export interface NotificationChannelItem {
    id: string;
    businessLineId: number;
    name: string;
    type: string;
    config?: WecomConfig;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }

  export interface ListParams {
    pageIndex: number;
    pageSize: number;
    businessLineId?: number;
  }

  export interface ListResult {
    items: NotificationChannelItem[];
    total: number;
  }

  export interface CreateParams {
    businessLineId: number;
    name: string;
    type: string;
    config: WecomConfig;
    enabled: boolean;
  }

  export interface UpdateParams {
    id: string;
    name: string;
    type: string;
    config: WecomConfig;
    enabled: boolean;
  }

  export interface DeleteParams {
    id: string;
  }
}

/**
 * 获取通知渠道列表
 */
export async function getNotificationChannelList(
  params: NotificationChannelApi.ListParams,
) {
  return requestClient.post<NotificationChannelApi.ListResult>(
    '/notificationChannel/list',
    params,
  );
}

/**
 * 创建通知渠道
 */
export async function createNotificationChannel(
  params: NotificationChannelApi.CreateParams,
) {
  return requestClient.post<NotificationChannelApi.NotificationChannelItem>(
    '/notificationChannel/create',
    params,
  );
}

/**
 * 更新通知渠道
 */
export async function updateNotificationChannel(
  params: NotificationChannelApi.UpdateParams,
) {
  return requestClient.post('/notificationChannel/update', params);
}

/**
 * 删除通知渠道
 */
export async function deleteNotificationChannel(
  params: NotificationChannelApi.DeleteParams,
) {
  return requestClient.post('/notificationChannel/delete', params);
}
