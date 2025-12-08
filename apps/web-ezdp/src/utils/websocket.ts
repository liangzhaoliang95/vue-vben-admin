/**
 * WebSocket 客户端工具
 */
import { useAccessStore } from '@vben/stores';

import { useAppConfig } from '@vben/hooks';

const getApiURL = () => {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  return apiURL;
};

export interface WebSocketMessage {
  commandType: string;
  commandId: number;
  data: any;
}

export type WebSocketMessageHandler = (message: WebSocketMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private businessLineId: number;
  private taskType: number;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private messageHandlers: WebSocketMessageHandler[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  constructor(businessLineId: number, taskType: number) {
    this.businessLineId = businessLineId;
    this.taskType = taskType;
  }

  /**
   * 连接 WebSocket
   */
  connect(): Promise<void> {
    // 获取 token
    const accessStore = useAccessStore();
    const token = accessStore.accessToken || '';
    if (!token) {
      return Promise.reject(new Error('未获取到 token'));
    }

    // 构建 WebSocket URL
    const apiURL = getApiURL();
    
    // 将 http/https URL 转换为 ws/wss URL
    let wsURL: string;
    if (apiURL.startsWith('http://')) {
      wsURL = apiURL.replace('http://', 'ws://');
    } else if (apiURL.startsWith('https://')) {
      wsURL = apiURL.replace('https://', 'wss://');
    } else {
      // 相对路径，使用当前页面的协议和 host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const path = apiURL.startsWith('/') ? apiURL : `/${apiURL}`;
      wsURL = `${protocol}//${host}${path}`;
    }
    
    // 确保路径不以 / 结尾
    if (wsURL.endsWith('/')) {
      wsURL = wsURL.slice(0, -1);
    }
    
    // 构建完整的 WebSocket URL，通过 query 参数传递 token
    this.url = `${wsURL}/ws?businessLineId=${this.businessLineId}&taskType=${this.taskType}&token=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket 连接成功');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as [string, number, any];
            const wsMessage: WebSocketMessage = {
              commandType: message[0],
              commandId: message[1],
              data: message[2],
            };

            // 处理心跳响应
            if (wsMessage.commandType === 'hearbeat' && wsMessage.commandId === 1) {
              // 心跳响应，不需要处理
              return;
            }

            // 调用所有消息处理器
            this.messageHandlers.forEach((handler) => {
              try {
                handler(wsMessage);
              } catch (error) {
                console.error('WebSocket 消息处理失败:', error);
              }
            });
          } catch (error) {
            console.error('解析 WebSocket 消息失败:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket 连接关闭');
          this.isConnected = false;
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 添加消息处理器
   */
  onMessage(handler: WebSocketMessageHandler) {
    this.messageHandlers.push(handler);
  }

  /**
   * 移除消息处理器
   */
  offMessage(handler: WebSocketMessageHandler) {
    const index = this.messageHandlers.indexOf(handler);
    if (index > -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const heartbeat: [string, number, any] = [
        'hearbeat',
        0,
        { time: Date.now() },
      ];
      this.ws.send(JSON.stringify(heartbeat));
    }
  }

  /**
   * 开始心跳
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    // 每30秒发送一次心跳
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocket 重连次数已达上限');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `WebSocket 将在 ${this.reconnectDelay}ms 后尝试第 ${this.reconnectAttempts} 次重连`,
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch((error) => {
        console.error('WebSocket 重连失败:', error);
      });
    }, this.reconnectDelay);
  }

  /**
   * 检查是否已连接
   */
  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

