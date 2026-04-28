import { requestClient } from '#/api/request';

export namespace AnnouncementApi {
  export interface AnnouncementItem {
    id: string;
    businessLineId: number;
    title: string;
    content: string;
    linkUrl?: string;
    isEnabled: boolean;
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
  }

  export interface ListParams {
    pageIndex: number;
    pageSize: number;
    businessLineId?: number;
  }

  export interface ListResult {
    list: AnnouncementItem[];
    total: number;
  }

  export interface CreateParams {
    title: string;
    content: string;
    linkUrl?: string;
    isEnabled?: boolean;
  }

  export interface UpdateParams {
    id: string;
    title: string;
    content: string;
    linkUrl?: string;
    sortOrder?: number;
    isEnabled?: boolean;
  }

  export interface DeleteParams {
    id: string;
  }

  export interface SortItem {
    id: string;
    sortOrder: number;
  }

  export interface SortParams {
    items: SortItem[];
  }

  export interface PublicListParams {
    businessLineId: number;
  }
}

/**
 * 获取公告列表（管理端）
 */
export async function getAnnouncementList(params: AnnouncementApi.ListParams) {
  return requestClient.post<AnnouncementApi.ListResult>(
    '/notification/announcement/list',
    params,
  );
}

/**
 * 创建公告
 */
export async function createAnnouncement(
  params: AnnouncementApi.CreateParams,
) {
  return requestClient.post<AnnouncementApi.AnnouncementItem>(
    '/notification/announcement/create',
    params,
  );
}

/**
 * 更新公告
 */
export async function updateAnnouncement(
  params: AnnouncementApi.UpdateParams,
) {
  return requestClient.post('/notification/announcement/update', params);
}

/**
 * 删除公告
 */
export async function deleteAnnouncement(
  params: AnnouncementApi.DeleteParams,
) {
  return requestClient.post('/notification/announcement/delete', params);
}

/**
 * 更新公告排序
 */
export async function updateAnnouncementSort(params: AnnouncementApi.SortParams) {
  return requestClient.post('/notification/announcement/sort', params);
}

/**
 * 获取公开公告列表（工作台）
 */
export async function getPublicAnnouncementList(
  params: AnnouncementApi.PublicListParams,
) {
  return requestClient.post<AnnouncementApi.AnnouncementItem[]>(
    '/notification/announcement/publicList',
    params,
  );
}
