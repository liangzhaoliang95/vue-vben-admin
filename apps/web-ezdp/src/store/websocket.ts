/**
 * WebSocket 全局管理器 Store
 * 管理全局 WebSocket 连接，所有业务共用一个连接
 */

import { ref } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { defineStore } from 'pinia';

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

interface Subscription {
  id: string;
  handlers: Set<WebSocketMessageHandler>;
}

interface LogCache {
  messages: WebSocketMessage[]; // 缓存的日志消息
  maxSize: number; // 最大缓存数量
}

interface WebSocketConnection {
  ws: WebSocket;
  subscriptions: Set<string>; // 订阅者 ID 集合
  reconnectTimer: null | number;
  heartbeatTimer: null | number;
  reconnectAttempts: number;
  isConnected: boolean;
  keepAliveTimer: null | number; // 保持连接定时器（当没有订阅者时延迟断开）
  connectingPromise: null | Promise<void>; // 正在连接中的 Promise
}

export const useWebSocketStore = defineStore('websocket', () => {
  // 全局唯一连接
  const connection = ref<null | WebSocketConnection>(null);

  // 连接状态（独立的响应式状态，用于触发 UI 更新）
  const connectionStatus = ref(false);

  // 订阅者：key 为订阅者 ID
  const subscriptions = ref<Map<string, Subscription>>(new Map());

  // 正在连接标记，用于防止重复连接
  const isConnecting = ref(false);

  // 全局初始化标记，防止重复初始化
  let isGlobalInitialized = false;

  // 当前订阅的业务线ID
  const currentBusinessLineId = ref<null | number>(null);

  // 日志缓存（按业务线ID存储）
  const logCaches = ref<Map<number, LogCache>>(new Map());

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  const heartbeatInterval = 30_000;
  const keepAliveDelay = 5 * 60 * 1000; // 5分钟，没有订阅者时保持连接的时间

  /**
   * 构建 WebSocket URL（只需要 token）
   */
  function buildWebSocketURL(): string {
    const accessStore = useAccessStore();
    const token = accessStore.accessToken || '';
    if (!token) {
      throw new Error('未获取到 token');
    }

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

    return `${wsURL}/ws?token=${encodeURIComponent(token)}`;
  }

  /**
   * 发送心跳
   */
  function sendHeartbeat(conn: WebSocketConnection) {
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      const heartbeat: [string, number, any] = [
        'hearbeat',
        0,
        { time: Date.now() },
      ];
      const heartbeatStr = JSON.stringify(heartbeat);
      // console.warn(`[WebSocket] 发送心跳: ${heartbeatStr}`);
      conn.ws.send(heartbeatStr);
    } else {
      console.warn(
        `[WebSocket] 无法发送心跳，连接状态: readyState=${conn.ws?.readyState}`,
      );
    }
  }

  /**
   * 开始心跳
   */
  function startHeartbeat(conn: WebSocketConnection) {
    stopHeartbeat(conn);
    conn.heartbeatTimer = window.setInterval(() => {
      sendHeartbeat(conn);
    }, heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  function stopHeartbeat(conn: WebSocketConnection) {
    if (conn.heartbeatTimer) {
      clearInterval(conn.heartbeatTimer);
      conn.heartbeatTimer = null;
    }
  }

  /**
   * 缓存日志消息
   */
  function cacheLogMessage(
    businessLineId: null | number,
    message: WebSocketMessage,
  ) {
    if (businessLineId === null) return;

    // 获取或创建缓存
    let cache = logCaches.value.get(businessLineId);
    if (!cache) {
      cache = {
        messages: [],
        maxSize: 1000, // 最多缓存1000条
      };
      logCaches.value.set(businessLineId, cache);
    }

    // 添加消息到缓存
    cache.messages.push(message);

    // 如果超过最大数量，移除最早的消息
    if (cache.messages.length > cache.maxSize) {
      cache.messages.shift();
    }
  }

  /**
   * 获取缓存的日志
   */
  function getCachedLogs(businessLineId: null | number): WebSocketMessage[] {
    if (businessLineId === null) return [];
    const cache = logCaches.value.get(businessLineId);
    return cache ? [...cache.messages] : [];
  }

  /**
   * 清除指定业务线的日志缓存
   */
  function clearLogCache(businessLineId: null | number) {
    if (businessLineId === null) return;
    const cache = logCaches.value.get(businessLineId);
    if (cache) {
      cache.messages = [];
    }
  }

  /**
   * 处理消息
   */
  function handleMessage(conn: WebSocketConnection, event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as [string, number, any];
      const wsMessage: WebSocketMessage = {
        commandType: message[0],
        commandId: message[1],
        data: message[2],
      };

      // console.warn(`[WebSocket] 收到消息:`, wsMessage);

      // 处理心跳响应
      if (wsMessage.commandType === 'hearbeat' && wsMessage.commandId === 1) {
        // console.warn(`[WebSocket] 收到心跳响应:`, wsMessage.data);
        return;
      }

      // 缓存日志消息（只缓存 log 和 event 类型的消息）
      if (
        wsMessage.commandType === 'log' ||
        wsMessage.commandType === 'event'
      ) {
        cacheLogMessage(currentBusinessLineId.value, wsMessage);
      }

      // 通知所有订阅者
      conn.subscriptions.forEach((subscriptionId) => {
        const subscription = subscriptions.value.get(subscriptionId);
        if (subscription) {
          subscription.handlers.forEach((handler) => {
            try {
              handler(wsMessage);
            } catch (error) {
              console.error('WebSocket 消息处理失败:', error);
            }
          });
        }
      });
    } catch (error) {
      console.error('解析 WebSocket 消息失败:', error);
    }
  }

  /**
   * 尝试重连
   */
  function attemptReconnect(conn: WebSocketConnection) {
    if (conn.reconnectAttempts >= maxReconnectAttempts) {
      console.error(`WebSocket 连接重连次数已达上限`);
      return;
    }

    conn.reconnectAttempts++;
    // console.warn(
    //   `WebSocket 连接将在 ${reconnectDelay}ms 后尝试第 ${conn.reconnectAttempts} 次重连`,
    // );

    conn.reconnectTimer = window.setTimeout(() => {
      connect().catch((error) => {
        console.error(`WebSocket 连接重连失败:`, error);
      });
    }, reconnectDelay);
  }

  /**
   * 连接 WebSocket
   */
  async function connect(): Promise<void> {
    // 如果连接已存在且已连接，直接返回
    const existingConn = connection.value;
    if (
      existingConn &&
      existingConn.isConnected &&
      existingConn.ws &&
      existingConn.ws.readyState === WebSocket.OPEN
    ) {
      // console.warn(`WebSocket 连接已存在且已连接，直接复用`);
      return;
    }

    // 如果正在连接中，等待现有连接完成
    if (isConnecting.value) {
      // console.warn(`WebSocket 连接正在建立中，等待现有连接完成`);
      // 等待连接完成，最多 5 秒
      return new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const conn = connection.value;
          if (
            conn &&
            conn.isConnected &&
            conn.ws &&
            conn.ws.readyState === WebSocket.OPEN
          ) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          } else if (!isConnecting.value) {
            // 不再连接中，可能失败了
            clearInterval(checkInterval);
            clearTimeout(timeout);
            reject(new Error('连接已取消或失败'));
          }
        }, 100);
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('等待连接超时'));
        }, 5000);
      });
    }

    // 如果连接正在建立中（通过 Promise 检查），等待现有连接完成
    if (existingConn && existingConn.connectingPromise) {
      // console.warn(
      //   `WebSocket 连接正在建立中（通过 Promise 检测），等待现有连接完成`,
      // );
      return existingConn.connectingPromise;
    }

    // 如果连接对象存在且有 ws 但未连接，说明可能正在连接中，等待一下
    if (existingConn && existingConn.ws && !existingConn.isConnected) {
      const wsState = existingConn.ws.readyState;
      if (wsState === WebSocket.CONNECTING) {
        // console.warn(
        //   `WebSocket 连接正在连接中（readyState=CONNECTING），等待连接完成`,
        // );
        // 等待连接完成，最多 5 秒
        return new Promise<void>((resolve, reject) => {
          const checkInterval = setInterval(() => {
            const conn = connection.value;
            if (!conn || !conn.ws) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              reject(new Error('连接已断开'));
              return;
            }
            if (conn.isConnected && conn.ws.readyState === WebSocket.OPEN) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              resolve();
            } else if (
              conn.ws.readyState === WebSocket.CLOSED ||
              conn.ws.readyState === WebSocket.CLOSING
            ) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              reject(new Error('连接已关闭'));
            }
          }, 100);
          const timeout = setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('等待连接超时'));
          }, 5000);
        });
      }
    }

    // 如果连接存在但未连接且不在连接中，先清理
    if (existingConn) {
      // console.warn(`WebSocket 连接存在但未连接，清理后重新连接`);
      disconnect();
    }

    // 标记为正在连接中（立即设置，防止重复连接）
    isConnecting.value = true;
    // console.warn(`开始创建 WebSocket 连接`);

    // 先创建一个占位 Promise，立即保存连接对象
    // 这样可以确保其他调用能立即检测到正在连接中
    let resolvePromise: (() => void) | null = null;
    let rejectPromise: ((error: any) => void) | null = null;
    const connectPromise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // 创建 WebSocket 连接
    const url = buildWebSocketURL();
    const ws = new WebSocket(url);

    // 创建连接对象，立即设置 connectingPromise
    const conn: WebSocketConnection = {
      ws,
      subscriptions: new Set(),
      reconnectTimer: null,
      heartbeatTimer: null,
      reconnectAttempts: 0,
      isConnected: false,
      keepAliveTimer: null,
      connectingPromise: connectPromise, // 立即设置 Promise 引用
    };

    // 立即保存连接对象，这样其他调用可以立即检测到正在连接中
    connection.value = conn;

    // 设置 WebSocket 事件处理器
    ws.addEventListener('open', () => {
      // console.warn(`WebSocket 连接成功, readyState: ${ws.readyState}`);
      conn.isConnected = true;
      conn.reconnectAttempts = 0;
      conn.connectingPromise = null; // 清除连接中的 Promise

      // 清除正在连接标记
      isConnecting.value = false;

      // 更新连接状态（触发响应式更新）
      connectionStatus.value = true;

      // 确保连接对象已保存
      connection.value = conn;

      // 延迟一小段时间后发送心跳，确保连接完全建立
      setTimeout(() => {
        if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
          // 立即发送心跳确认连接可用
          sendHeartbeat(conn);
          // console.warn(`WebSocket 连接已发送初始心跳`);

          // 启动心跳定时器
          startHeartbeat(conn);
        }
      }, 100);

      if (resolvePromise) {
        resolvePromise();
      }
    });

    ws.addEventListener('message', (event) => {
      // console.warn(`[WebSocket] 收到消息: ${event.data}`);
      handleMessage(conn, event);
    });

    ws.addEventListener('error', (error) => {
      console.error(`WebSocket 错误:`, error);
      conn.connectingPromise = null; // 清除连接中的 Promise
      // 清除正在连接标记
      isConnecting.value = false;
      // 清理连接对象
      connection.value = null;
      if (rejectPromise) {
        rejectPromise(error);
      }
    });

    ws.addEventListener('close', () => {
      // console.warn(`WebSocket 连接关闭`);
      conn.isConnected = false;
      conn.connectingPromise = null; // 清除连接中的 Promise
      // 清除正在连接标记
      isConnecting.value = false;
      // 更新连接状态（触发响应式更新）
      connectionStatus.value = false;
      stopHeartbeat(conn);
      stopKeepAlive(conn);

      // 如果还有订阅者，尝试重连
      if (conn.subscriptions.size > 0) {
        attemptReconnect(conn);
      } else {
        // 没有订阅者了，清理连接
        connection.value = null;
      }
    });

    return connectPromise;
  }

  /**
   * 停止保持连接定时器
   */
  function stopKeepAlive(conn: WebSocketConnection) {
    if (conn.keepAliveTimer) {
      clearTimeout(conn.keepAliveTimer);
      conn.keepAliveTimer = null;
    }
  }

  /**
   * 开始保持连接定时器（延迟断开）
   */
  function startKeepAlive(conn: WebSocketConnection) {
    stopKeepAlive(conn);
    conn.keepAliveTimer = window.setTimeout(() => {
      // 如果还是没有订阅者，才真正断开
      if (conn.subscriptions.size === 0) {
        disconnect();
      }
    }, keepAliveDelay);
  }

  /**
   * 断开连接
   */
  function disconnect() {
    const conn = connection.value;
    if (conn) {
      stopHeartbeat(conn);
      stopKeepAlive(conn);
      if (conn.reconnectTimer) {
        clearTimeout(conn.reconnectTimer);
        conn.reconnectTimer = null;
      }
      if (conn.ws) {
        conn.ws.close();
      }
      connection.value = null;
    }
  }

  /**
   * 订阅消息
   * @param subscriptionId 订阅者 ID（唯一标识）
   * @param handler 消息处理器
   * @returns 取消订阅的函数
   *
   * 注意：后续不同任务的日志下发使用订阅机制实现，此处先不实现具体订阅逻辑
   */
  async function subscribe(
    subscriptionId: string,
    handler: WebSocketMessageHandler,
  ): Promise<() => void> {
    // 创建或获取订阅
    let subscription = subscriptions.value.get(subscriptionId);
    if (!subscription) {
      subscription = {
        id: subscriptionId,
        handlers: new Set(),
      };
      subscriptions.value.set(subscriptionId, subscription);
    }

    // 添加处理器
    subscription.handlers.add(handler);

    // 确保连接已建立
    let conn = connection.value;

    // 检查连接状态：如果连接不存在、未连接、或者正在连接中，都需要等待连接完成
    if (!conn) {
      // 连接不存在，创建新连接
      try {
        await connect();
        conn = connection.value;
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        throw error;
      }
    } else if (conn.connectingPromise) {
      // 连接正在建立中，等待现有连接完成
      try {
        await conn.connectingPromise;
        // 等待完成后重新获取连接对象（状态可能已更新）
        conn = connection.value;
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        throw error;
      }
    } else if (
      !conn.isConnected ||
      !conn.ws ||
      conn.ws.readyState !== WebSocket.OPEN
    ) {
      // 连接存在但未连接成功，重新连接
      try {
        await connect();
        conn = connection.value;
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        throw error;
      }
    }

    // 再次确认连接状态（双重检查）
    conn = connection.value;
    if (
      !conn ||
      !conn.isConnected ||
      !conn.ws ||
      conn.ws.readyState !== WebSocket.OPEN
    ) {
      console.warn(`WebSocket 连接状态异常，尝试重新连接`);
      try {
        await connect();
        conn = connection.value;
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        throw error;
      }
    }

    // 将订阅者添加到连接
    const updatedConn = connection.value;
    if (updatedConn) {
      updatedConn.subscriptions.add(subscriptionId);
      // 如果有新的订阅者，停止保持连接定时器（不再需要延迟断开）
      stopKeepAlive(updatedConn);
    }

    // 返回取消订阅的函数
    return () => {
      unsubscribe(subscriptionId, handler);
    };
  }

  /**
   * 取消订阅
   */
  function unsubscribe(
    subscriptionId: string,
    handler?: WebSocketMessageHandler,
  ) {
    const subscription = subscriptions.value.get(subscriptionId);
    if (!subscription) {
      return;
    }

    if (handler) {
      // 只移除指定的处理器
      subscription.handlers.delete(handler);
      if (subscription.handlers.size === 0) {
        // 没有处理器了，移除订阅
        subscriptions.value.delete(subscriptionId);

        // 检查连接是否还有订阅者
        const conn = connection.value;
        if (conn) {
          conn.subscriptions.delete(subscriptionId);

          // 如果没有订阅者了，启动保持连接定时器（延迟断开）
          if (conn.subscriptions.size === 0) {
            startKeepAlive(conn);
          }
        }
      }
    } else {
      // 移除所有处理器
      subscriptions.value.delete(subscriptionId);

      // 检查连接是否还有订阅者
      const conn = connection.value;
      if (conn) {
        conn.subscriptions.delete(subscriptionId);

        // 如果没有订阅者了，启动保持连接定时器（延迟断开）
        if (conn.subscriptions.size === 0) {
          startKeepAlive(conn);
        }
      }
    }
  }

  /**
   * 检查连接状态（返回响应式状态）
   */
  function isConnected(): boolean {
    // 先检查实际连接状态
    const conn = connection.value;
    const actualStatus =
      conn?.isConnected === true && conn.ws?.readyState === WebSocket.OPEN;

    // 如果状态不一致，更新响应式状态
    if (connectionStatus.value !== actualStatus) {
      connectionStatus.value = actualStatus;
    }

    return connectionStatus.value;
  }

  /**
   * 断开所有连接（用于登出时清理）
   */
  function disconnectAll() {
    const conn = connection.value;
    if (conn) {
      stopHeartbeat(conn);
      if (conn.reconnectTimer) {
        clearTimeout(conn.reconnectTimer);
      }
      if (conn.ws) {
        conn.ws.close();
      }
    }
    connection.value = null;
    subscriptions.value.clear();
  }

  /**
   * 初始化全局 WebSocket 连接
   * 应用启动时自动建立连接
   */
  function initGlobalWebSocket() {
    // 防止重复初始化
    if (isGlobalInitialized) {
      // console.warn('[WebSocket] 全局初始化已执行，跳过重复初始化');
      return;
    }

    isGlobalInitialized = true;
    // console.warn('[WebSocket] 开始全局初始化');

    // 立即建立连接
    connect().catch((error) => {
      console.error('全局 WebSocket 连接失败:', error);
    });
  }

  /**
   * 发送消息到WebSocket
   * @param message 消息数组 [commandType, commandId, data]
   */
  function send(message: any[]) {
    const conn = connection.value;
    if (!conn || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未连接，无法发送消息');
      return;
    }

    try {
      const messageStr = JSON.stringify(message);
      conn.ws.send(messageStr);
      // console.warn('发送WebSocket消息:', message);
    } catch (error) {
      console.error('发送WebSocket消息失败:', error);
    }
  }

  /**
   * 订阅业务线日志（一个连接只能订阅一个业务线）
   * 切换业务线时会自动取消旧订阅
   */
  async function subscribeBusinessLine(businessLineId: number) {
    // console.warn(`[WebSocket] 订阅业务线: ${businessLineId}`);

    // 如果已订阅相同业务线，直接返回
    if (currentBusinessLineId.value === businessLineId) {
      // console.warn(`[WebSocket] 已订阅该业务线，跳过: ${businessLineId}`);
      return;
    }

    // 确保连接已建立
    const conn = connection.value;
    if (
      !conn ||
      !conn.isConnected ||
      !conn.ws ||
      conn.ws.readyState !== WebSocket.OPEN
    ) {
      // console.warn(`[WebSocket] 连接未建立，先建立连接`);
      await connect();
    }

    // 发送订阅消息（使用数组格式：["subscribe", 0, {businessLineId: 2}]）
    const subscribeMsg = ['subscribe', 0, { businessLineId }];

    const messageConn = connection.value;
    if (
      messageConn &&
      messageConn.ws &&
      messageConn.ws.readyState === WebSocket.OPEN
    ) {
      const msgStr = JSON.stringify(subscribeMsg);
      messageConn.ws.send(msgStr);
      // console.warn('[WebSocket] 发送订阅消息:', subscribeMsg);
    }

    // 更新当前订阅的业务线ID
    currentBusinessLineId.value = businessLineId;

    // console.warn(`[WebSocket] 订阅业务线成功: ${businessLineId}`);
  }

  /**
   * 取消订阅当前业务线
   */
  function unsubscribeBusinessLine() {
    if (currentBusinessLineId.value === null) {
      return;
    }

    // console.warn(`[WebSocket] 取消订阅业务线: ${currentBusinessLineId.value}`);

    // 发送取消订阅消息（使用数组格式：["unsubscribe", 0, {businessLineId: 2}]）
    const unsubscribeMsg = [
      'unsubscribe',
      0,
      { businessLineId: currentBusinessLineId.value },
    ];

    const conn = connection.value;
    if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      const msgStr = JSON.stringify(unsubscribeMsg);
      conn.ws.send(msgStr);
      // console.warn('[WebSocket] 发送取消订阅消息:', unsubscribeMsg);
    }

    // 清除当前订阅
    currentBusinessLineId.value = null;
  }

  return {
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    disconnectAll,
    isConnected,
    initGlobalWebSocket,
    send,
    subscribeBusinessLine,
    unsubscribeBusinessLine,
    currentBusinessLineId, // 暴露当前订阅的业务线ID
    connectionStatus, // 暴露响应式状态，供组件直接使用
    getCachedLogs, // 获取缓存的日志
    clearLogCache, // 清除日志缓存
  };
});
