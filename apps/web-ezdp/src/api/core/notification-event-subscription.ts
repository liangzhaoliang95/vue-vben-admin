import { requestClient } from '#/api/request';

export namespace EventSubscriptionApi {
  export interface EventSubscriptionItem {
    id: string;
    businessLineId: number;
    eventType: string;
    webhookUrl: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }

  export interface ListParams {
    pageIndex: number;
    pageSize: number;
    eventType?: string;
  }

  export interface ListResult {
    list: EventSubscriptionItem[];
    total: number;
  }

  export interface CreateParams {
    eventType: string;
    webhookUrl: string;
  }

  export interface UpdateParams {
    id: string;
    eventType: string;
    webhookUrl: string;
    enabled: boolean;
  }

  export interface DeleteParams {
    id: string;
  }

  export interface TestWebhookParams {
    webhookUrl: string;
  }
}

/**
 * 获取事件订阅列表
 */
export async function getEventSubscriptionList(
  params: EventSubscriptionApi.ListParams,
) {
  return requestClient.post<EventSubscriptionApi.ListResult>(
    '/notification/eventSubscription/getList',
    params,
  );
}

/**
 * 创建事件订阅
 */
export async function createEventSubscription(
  params: EventSubscriptionApi.CreateParams,
) {
  return requestClient.post<EventSubscriptionApi.EventSubscriptionItem>(
    '/notification/eventSubscription/create',
    params,
  );
}

/**
 * 更新事件订阅
 */
export async function updateEventSubscription(
  params: EventSubscriptionApi.UpdateParams,
) {
  return requestClient.post<EventSubscriptionApi.EventSubscriptionItem>(
    '/notification/eventSubscription/update',
    params,
  );
}

/**
 * 删除事件订阅
 */
export async function deleteEventSubscription(
  params: EventSubscriptionApi.DeleteParams,
) {
  return requestClient.post('/notification/eventSubscription/delete', params);
}

/**
 * 测试Webhook
 */
export async function testEventSubscriptionWebhook(
  params: EventSubscriptionApi.TestWebhookParams,
) {
  return requestClient.post(
    '/notification/eventSubscription/testWebhook',
    params,
  );
}
