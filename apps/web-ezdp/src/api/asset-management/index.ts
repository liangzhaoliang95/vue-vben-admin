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

  // 镜像检查相关
  export interface ImageCheckItem {
    id: string;
    businessLineId: number;
    mode: 'manual' | 'version';
    imageName: string;
    branchId: string;
    branchName: string;
    buildVersionId: string;
    buildVersion: string;
    remark: string;
    lastCheckAt: number;
    checkStatus: 'pending' | 'ok' | 'not_found' | 'error';
    checkError: string;
    checkedImages: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
  }

  export interface CreateImageCheckParams {
    mode: 'manual' | 'version';
    imageName?: string;
    branchId?: string;
    buildVersionId?: string;
    remark?: string;
    enabled: boolean;
  }

  export interface UpdateImageCheckParams {
    id: string;
    mode: 'manual' | 'version';
    imageName?: string;
    branchId?: string;
    buildVersionId?: string;
    remark?: string;
    enabled: boolean;
  }

  export interface BranchItem {
    id: string;
    name: string;
  }

  export interface BranchVersionItem {
    id: string;
    version: string;
  }

  export function getImageCheckList() {
    return requestClient.post<ImageCheckItem[]>('/assetManagement/imageCheck/list', {});
  }

  export function createImageCheck(params: CreateImageCheckParams) {
    return requestClient.post('/assetManagement/imageCheck/create', params);
  }

  export function updateImageCheck(params: UpdateImageCheckParams) {
    return requestClient.post('/assetManagement/imageCheck/update', params);
  }

  export function deleteImageCheck(params: { id: string }) {
    return requestClient.post('/assetManagement/imageCheck/delete', params);
  }

  export function checkNowImageCheck(params: { id: string }) {
    return requestClient.post<ImageCheckItem>('/assetManagement/imageCheck/checkNow', params);
  }

  export function getImageCheckBranchList() {
    return requestClient.post<BranchItem[]>('/assetManagement/imageCheck/branchList', {});
  }

  export function getImageCheckBranchVersionList(params: { branchId: string }) {
    return requestClient.post<BranchVersionItem[]>(
      '/assetManagement/imageCheck/branchVersionList',
      params,
    );
  }
}
