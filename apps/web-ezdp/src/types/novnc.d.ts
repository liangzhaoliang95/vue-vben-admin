declare module '@novnc/novnc' {
  export default class RFB extends EventTarget {
    background: string;
    clipViewport: boolean;
    compressionLevel: number;
    focusOnClick: boolean;
    qualityLevel: number;
    resizeSession: boolean;
    scaleViewport: boolean;
    showDotCursor: boolean;
    viewOnly: boolean;
    constructor(
      target: Element | string,
      url: string,
      options?: {
        credentials?: {
          password?: string;
          username?: string;
        };
      },
    );
    disconnect(): void;
    focus(options?: FocusOptions): void;
    sendCredentials(credentials: {
      password?: string;
      username?: string;
    }): void;
  }
}
