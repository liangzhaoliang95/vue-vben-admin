import { requestClient } from '#/api/request';

export namespace AssetManagementApi {
  export interface SslCertCheck {
    id: string;
    businessLineId: number;
    domain: string;
    port: number;
    remark: string;
    lastCheckAt: number;
    expireAt: number;
    daysRemaining: number;
    checkStatus: 'pending' | 'ok' | 'expiring' | 'expired' | 'error';
    checkError: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }

  export interface CreateSslCertCheckParams {
    domain: string;
    port: number;
    remark?: string;
    enabled: boolean;
  }

  export interface UpdateSslCertCheckParams {
    id: string;
    domain: string;
    port: number;
    remark?: string;
    enabled: boolean;
  }

  export function getSslCertCheckList() {
    return requestClient.post<SslCertCheck[]>('/assetManagement/sslCertCheck/list', {});
  }

  export function createSslCertCheck(params: CreateSslCertCheckParams) {
    return requestClient.post('/assetManagement/sslCertCheck/create', params);
  }

  export function updateSslCertCheck(params: UpdateSslCertCheckParams) {
    return requestClient.post('/assetManagement/sslCertCheck/update', params);
  }

  export function deleteSslCertCheck(params: { id: string }) {
    return requestClient.post('/assetManagement/sslCertCheck/delete', params);
  }

  export function checkNowSslCert(params: { id: string }) {
    return requestClient.post<SslCertCheck>('/assetManagement/sslCertCheck/checkNow', params);
  }
}
