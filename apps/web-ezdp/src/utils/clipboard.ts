/**
 * 复制文本到剪贴板（带降级方案）
 * 优先使用现代 Clipboard API，如果不可用则使用传统的 execCommand 方法
 * @param text 要复制的文本
 * @returns Promise<void>
 */
export async function copyToClipboard(text: string): Promise<void> {
  // 优先使用现代 Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn('Clipboard API 失败，尝试降级方案:', error);
    }
  }

  // 降级方案：使用传统的 execCommand 方法
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      throw new Error('execCommand 复制失败');
    }
  } finally {
    document.body.removeChild(textArea);
  }
}
