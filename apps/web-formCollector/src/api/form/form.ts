import { requestClient } from '#/api/request';

export namespace FormApi {
  /** 表单基础信息 */
  export interface Form {
    id: string;
    title: string;
    description?: string;
    status: 'draft' | 'published' | 'closed';
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }

  /** 表单列表查询参数 */
  export interface FormListParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: 'draft' | 'published' | 'closed';
  }

  /** 表单列表响应 */
  export interface FormListResult {
    items: Form[];
    total: number;
  }

  /** 创建表单参数 */
  export type CreateFormParams = Omit<
    Form,
    'id' | 'createdAt' | 'updatedAt' | 'createdBy'
  >;

  /** 更新表单参数 */
  export type UpdateFormParams = Partial<CreateFormParams>;
}

/**
 * 获取表单列表
 */
export async function getFormListApi(params: FormApi.FormListParams) {
  return requestClient.post<FormApi.FormListResult>('/form/list', params);
}

/**
 * 获取表单详情
 * @param id 表单 ID
 */
export async function getFormDetailApi(id: string) {
  return requestClient.get<FormApi.Form>(`/form/${id}`);
}

/**
 * 创建表单
 * @param data 表单数据
 */
export async function createFormApi(data: FormApi.CreateFormParams) {
  return requestClient.post<FormApi.Form>('/form', data);
}

/**
 * 更新表单
 * @param id 表单 ID
 * @param data 表单数据
 */
export async function updateFormApi(
  id: string,
  data: FormApi.UpdateFormParams,
) {
  return requestClient.put<FormApi.Form>(`/form/${id}`, data);
}

/**
 * 删除表单
 * @param id 表单 ID
 */
export async function deleteFormApi(id: string) {
  return requestClient.delete(`/form/${id}`);
}

/**
 * 发布表单
 * @param id 表单 ID
 */
export async function publishFormApi(id: string) {
  return requestClient.post(`/form/${id}/publish`);
}

/**
 * 关闭表单
 * @param id 表单 ID
 */
export async function closeFormApi(id: string) {
  return requestClient.post(`/form/${id}/close`);
}
