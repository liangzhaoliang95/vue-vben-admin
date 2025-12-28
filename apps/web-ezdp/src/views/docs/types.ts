/**
 * 文档项类型定义
 */
export interface DocItem {
  id: string;
  title: string;
  description: string;
  fileName: string;
}

/**
 * 页面状态类型
 */
export interface DocPageState {
  selectedDoc: string | null;
  content: string;
  loading: boolean;
  error: string | null;
}
