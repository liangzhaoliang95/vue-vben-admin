import { requestClient } from '#/api/request';

export namespace SystemAuditLogApi {
  export interface AuditLog {
    id: string;
    userId: string;
    loginName: string;
    userName: string;
    businessLineId: number;
    path: string;
    method: string;
    description: string;
    actionDesc: string;
    requestBody: string;
    responseCode: number;
    clientIp: string;
    duration: number;
    traceId: string;
    auditKey: string;
    createdAt: number;
  }

  export interface ListParams {
    pageIndex: number;
    pageSize: number;
    businessLineId?: number;
    auditKey?: string;
    loginName?: string;
    startMs?: number;
    endMs?: number;
  }

  export interface ListResult {
    total: number;
    list: AuditLog[];
  }
}

export async function getAuditLogList(
  params: SystemAuditLogApi.ListParams,
) {
  return requestClient.post<SystemAuditLogApi.ListResult>(
    '/auditLog/list',
    params,
  );
}
