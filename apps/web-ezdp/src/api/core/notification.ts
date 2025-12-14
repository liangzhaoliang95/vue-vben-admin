import { requestClient } from '#/api/request';

export namespace NotificationApi {
  export interface NotificationItem {
    id: string;
    type: string;
    title: string;
    content: string;
    relatedId?: string;
    relatedType?: string;
    isRead: boolean;
    readAt: number;
    createdAt: number;
  }

  export interface NotificationListParams {
    pageIndex: number;
    pageSize: number;
    businessLineId?: number;
    isRead?: boolean;
  }

  export interface NotificationListResult {
    items: NotificationItem[];
    total: number;
  }

  export interface UnreadCountResult {
    count: number;
  }

  export interface CreateNotificationParams {
    businessLineId: number;
    userId: string;
    type: string;
    title: string;
    content: string;
    relatedId?: string;
    relatedType?: string;
  }

  export interface MarkAsReadParams {
    id: string;
  }

  export interface DeleteParams {
    id: string;
  }
}

/**
 * 获取通知列表
 */
export async function getNotificationList(
  params: NotificationApi.NotificationListParams,
) {
  return requestClient.post<NotificationApi.NotificationListResult>(
    '/notification/list',
    params,
  );
}

/**
 * 获取未读通知数量
 */
export async function getUnreadCount() {
  return requestClient.post<NotificationApi.UnreadCountResult>(
    '/notification/unreadCount',
    {},
  );
}

/**
 * 创建通知
 */
export async function createNotification(
  params: NotificationApi.CreateNotificationParams,
) {
  return requestClient.post<NotificationApi.NotificationItem>(
    '/notification/create',
    params,
  );
}

/**
 * 标记通知为已读
 */
export async function markAsRead(params: NotificationApi.MarkAsReadParams) {
  return requestClient.post('/notification/markAsRead', params);
}

/**
 * 全部标记为已读
 */
export async function markAllAsRead(businessLineId?: number) {
  return requestClient.post('/notification/markAllAsRead', {
    businessLineId,
  });
}

/**
 * 删除通知
 */
export async function deleteNotification(params: NotificationApi.DeleteParams) {
  return requestClient.post('/notification/delete', params);
}

/**
 * 清空已读通知
 */
export async function clearReadNotifications(businessLineId?: number) {
  return requestClient.post('/notification/clearRead', {
    businessLineId,
  });
}
