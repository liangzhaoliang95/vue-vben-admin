/**
 * 分页结果接口
 */
export interface PageResult<T> {
  items: T[];
  total: number;
}
