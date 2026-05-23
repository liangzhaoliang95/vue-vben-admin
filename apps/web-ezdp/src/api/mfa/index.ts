import { requestClient } from '#/api/request';

export namespace MFAApi {
  export interface GenerateSecretResult {
    secret: string;
    qrCodeUrl: string;
  }

  export interface MFAStatusResult {
    enabled: boolean;
    hasKey: boolean;
    verified: boolean;
  }

  export function generateSecret() {
    return requestClient.post<GenerateSecretResult>('/mfa/generateSecret', {});
  }

  export function confirmEnable(code: string) {
    return requestClient.post<null>('/mfa/confirmEnable', { code });
  }

  export function disable(code: string) {
    return requestClient.post<null>('/mfa/disable', { code });
  }

  export function getStatus() {
    return requestClient.post<MFAStatusResult>('/mfa/status', {});
  }

  export function verify(code: string) {
    return requestClient.post<null>('/mfa/verify', { code });
  }
}
