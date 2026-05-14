<script lang="ts" setup>
import type { BranchManagementApi } from '#/api/package-deploy-management/branch-management';

import { nextTick, onUnmounted, ref, watch } from 'vue';

import { Modal, message } from 'ant-design-vue';

import { updateBranchManagement } from '#/api/package-deploy-management/branch-management';
import { $t } from '#/locales';

interface Props {
  open: boolean;
  branches: BranchManagementApi.BranchManagement[];
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'refresh'): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const NODE_W = 160;
const NODE_H = 48;
const H_GAP = 40;
const V_GAP = 60;
const PADDING = 40;

// 视口变换状态
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOffsetX = 0;
let dragStartOffsetY = 0;

// canvas 逻辑尺寸（内容区域大小，不含 dpr）
let contentW = 0;

// 拖拽状态
interface DragState {
  active: boolean;
  node: TreeNode | null;
  ghostX: number;
  ghostY: number;
  dropTarget: DropTarget | null;
}

type DropTarget =
  | { type: 'edge'; parentNode: TreeNode; childNode: TreeNode }
  | { type: 'node'; targetNode: TreeNode }
  | { type: 'root' };

const dragState: DragState = {
  active: false,
  node: null,
  ghostX: 0,
  ghostY: 0,
  dropTarget: null,
};

interface TreeNode {
  branch: BranchManagementApi.BranchManagement;
  children: TreeNode[];
  x: number;
  y: number;
  subtreeWidth: number;
  depth: number;
}

// 缓存当前布局的所有节点和边，供命中检测使用
let cachedNodes: TreeNode[] = [];
let cachedEdges: { parent: TreeNode; child: TreeNode }[] = [];

function buildTree(): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const b of props.branches) {
    map.set(b.id, {
      branch: b,
      children: [],
      x: 0,
      y: 0,
      subtreeWidth: 0,
      depth: 0,
    });
  }

  const roots: TreeNode[] = [];
  for (const b of props.branches) {
    const node = map.get(b.id)!;
    if (b.parentBranchId && map.has(b.parentBranchId)) {
      map.get(b.parentBranchId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortChildren(node: TreeNode) {
    node.children.sort(
      (a, b) => (a.branch.sortOrder ?? 0) - (b.branch.sortOrder ?? 0),
    );
    for (const child of node.children) sortChildren(child);
  }
  roots.sort((a, b) => (a.branch.sortOrder ?? 0) - (b.branch.sortOrder ?? 0));
  for (const r of roots) sortChildren(r);

  return roots;
}

function calcSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) {
    node.subtreeWidth = NODE_W;
    return NODE_W;
  }
  let total = 0;
  for (let i = 0; i < node.children.length; i++) {
    total += calcSubtreeWidth(node.children[i]!);
    if (i < node.children.length - 1) total += H_GAP;
  }
  node.subtreeWidth = Math.max(total, NODE_W);
  return node.subtreeWidth;
}

function assignPositions(node: TreeNode, startX: number, depth: number) {
  node.depth = depth;
  node.x = startX + (node.subtreeWidth - NODE_W) / 2;
  let childX = startX;
  for (const child of node.children) {
    assignPositions(child, childX, depth + 1);
    childX += child.subtreeWidth + H_GAP;
  }
}

function collectNodes(node: TreeNode, out: TreeNode[]) {
  out.push(node);
  for (const c of node.children) collectNodes(c, out);
}

function collectEdges(
  node: TreeNode,
  out: { parent: TreeNode; child: TreeNode }[],
) {
  for (const child of node.children) {
    out.push({ parent: node, child });
    collectEdges(child, out);
  }
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 0 && ctx.measureText(result + '…').width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + '…';
}

/** 将屏幕坐标转换为画布内容坐标 */
function screenToCanvas(clientX: number, clientY: number) {
  const canvas = canvasRef.value;
  if (!canvas) return { cx: 0, cy: 0 };
  const rect = canvas.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  return {
    cx: (mx - offsetX) / scale,
    cy: (my - offsetY) / scale,
  };
}

/** 检测点是否在某个节点内 */
function hitTestNode(cx: number, cy: number): TreeNode | null {
  for (const node of cachedNodes) {
    if (cx >= node.x && cx <= node.x + NODE_W && cy >= node.y && cy <= node.y + NODE_H) {
      return node;
    }
  }
  return null;
}

/** 计算点到贝塞尔曲线的近似距离 */
function pointToEdgeDist(
  px: number,
  py: number,
  edge: { parent: TreeNode; child: TreeNode },
): number {
  const child = edge.child;
  const parent = edge.parent;
  const cx = child.x + NODE_W / 2;
  const cy = child.y + NODE_H;
  const px0 = parent.x + NODE_W / 2;
  const py0 = parent.y;
  const midY = (cy + py0) / 2;

  // 采样贝塞尔曲线上的点，找最近距离
  let minDist = Number.POSITIVE_INFINITY;
  for (let t = 0; t <= 1; t += 0.05) {
    const t2 = t;
    const bx =
      (1 - t2) ** 3 * cx +
      3 * (1 - t2) ** 2 * t2 * cx +
      3 * (1 - t2) * t2 ** 2 * px0 +
      t2 ** 3 * px0;
    const by =
      (1 - t2) ** 3 * cy +
      3 * (1 - t2) ** 2 * t2 * midY +
      3 * (1 - t2) * t2 ** 2 * midY +
      t2 ** 3 * py0;
    const dist = Math.hypot(px - bx, py - by);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/** 检测最近的边 */
function hitTestEdge(
  cx: number,
  cy: number,
): { parent: TreeNode; child: TreeNode } | null {
  const threshold = 15;
  let bestEdge: { parent: TreeNode; child: TreeNode } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const edge of cachedEdges) {
    // 跳过与拖拽节点相关的边
    if (dragState.node) {
      if (edge.parent.branch.id === dragState.node.branch.id || edge.child.branch.id === dragState.node.branch.id) {
        continue;
      }
    }
    const dist = pointToEdgeDist(cx, cy, edge);
    if (dist < threshold && dist < bestDist) {
      bestDist = dist;
      bestEdge = edge;
    }
  }
  return bestEdge;
}

/** 检测拖拽释放目标 */
function detectDropTarget(cx: number, cy: number): DropTarget | null {
  if (!dragState.node) return null;

  // 1. 检测是否悬停在某个节点上（变为该节点的子分支）
  const hitNode = hitTestNode(cx, cy);
  if (hitNode && hitNode.branch.id !== dragState.node.branch.id) {
    return { type: 'node', targetNode: hitNode };
  }

  // 2. 检测是否悬停在某条边上（插入到边中间）
  const hitEdge = hitTestEdge(cx, cy);
  if (hitEdge) {
    return { type: 'edge', parentNode: hitEdge.parent, childNode: hitEdge.child };
  }

  // 3. 空白区域 → 变为根节点
  return { type: 'root' };
}

/** 执行拖拽释放后的继承关系更新 */
async function executeDrop(target: DropTarget) {
  const dragNode = dragState.node;
  if (!dragNode) return;

  const dragId = dragNode.branch.id;
  let newParentBranchId = '';
  let needUpdateChild: { childId: string; newParentId: string } | null = null;

  if (target.type === 'edge') {
    // 插入到边中间：dragNode 的 parent → edge.parentNode，edge.child 的 parent → dragNode
    newParentBranchId = target.parentNode.branch.id;
    needUpdateChild = {
      childId: target.childNode.branch.id,
      newParentId: dragId,
    };
  } else if (target.type === 'node') {
    // 变为某节点的子分支
    newParentBranchId = target.targetNode.branch.id;
  } else {
    // 变为根节点
    newParentBranchId = '';
  }

  // 不能将自己设为自己的子分支（虽然上面已排除自身，但多加一层保护）
  if (newParentBranchId === dragId) {
    message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
    return;
  }

  // 检查是否形成了循环：新父级是否是拖拽节点的后代
  if (newParentBranchId) {
    if (isDescendant(dragId, newParentBranchId)) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }
  }

  try {
    // 更新拖拽节点的 parentBranchId
    await updateBranchManagement(dragId, { parentBranchId: newParentBranchId });

    // 如果需要，更新连线上 child 的 parentBranchId
    if (needUpdateChild) {
      await updateBranchManagement(needUpdateChild.childId, {
        parentBranchId: needUpdateChild.newParentId,
      });
    }

    message.success($t('deploy.packageDeployManagement.branchManagement.topologyDragSuccess'));
    emits('refresh');
  } catch {
    message.error($t('deploy.packageDeployManagement.branchManagement.topologyDragFailed'));
  }
}

/** 检查 targetId 是否是 ancestorId 的后代（在当前 branches 数据中） */
function isDescendant(ancestorId: string, targetId: string): boolean {
  const map = new Map<string, string>();
  for (const b of props.branches) {
    if (b.parentBranchId) {
      map.set(b.id, b.parentBranchId);
    }
  }

  let current = targetId;
  const visited = new Set<string>();
  while (current) {
    if (current === ancestorId) return true;
    if (visited.has(current)) break;
    visited.add(current);
    current = map.get(current) ?? '';
  }
  return false;
}

function redraw() {
  const canvas = canvasRef.value;
  if (!canvas || contentW === 0) return;

  const dark = isDark();
  const dpr = window.devicePixelRatio || 1;
  const viewW = canvas.width / dpr;
  const viewH = canvas.height / dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = dark ? '#141414' : '#f0f5ff';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawContent(ctx, dark);
  ctx.restore();
}

function drawContent(ctx: CanvasRenderingContext2D, dark: boolean) {
  const roots = buildTree();
  if (roots.length === 0) return;

  for (const r of roots) calcSubtreeWidth(r);

  let startX = PADDING;
  for (let i = 0; i < roots.length; i++) {
    assignPositions(roots[i]!, startX, 0);
    startX += roots[i]!.subtreeWidth + H_GAP * 2;
  }

  const allNodes: TreeNode[] = [];
  for (const r of roots) collectNodes(r, allNodes);
  cachedNodes = allNodes;

  const globalMaxDepth = Math.max(...allNodes.map((n) => n.depth));

  for (const n of allNodes) {
    const flippedDepth = globalMaxDepth - n.depth;
    n.y = PADDING + flippedDepth * (NODE_H + V_GAP);
  }

  // 收集所有边
  const allEdges: { parent: TreeNode; child: TreeNode }[] = [];
  for (const r of roots) collectEdges(r, allEdges);
  cachedEdges = allEdges;

  // 先画连线
  function drawEdges(node: TreeNode) {
    for (const child of node.children) {
      const cx = child.x + NODE_W / 2;
      const cy = child.y + NODE_H;
      const px = node.x + NODE_W / 2;
      const py = node.y;
      const midY = (cy + py) / 2;

      const isHighlighted =
        dragState.active &&
        dragState.dropTarget?.type === 'edge' &&
        dragState.dropTarget.parentNode.branch.id === node.branch.id &&
        dragState.dropTarget.childNode.branch.id === child.branch.id;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx, midY, px, midY, px, py);

      if (isHighlighted) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
      } else {
        ctx.strokeStyle = dark ? '#4a6fa5' : '#93c5fd';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 箭头指向父节点（向下）
      const arrowSize = 7;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - arrowSize * 0.5, py + arrowSize);
      ctx.lineTo(px + arrowSize * 0.5, py + arrowSize);
      ctx.closePath();
      ctx.fillStyle = isHighlighted ? '#f59e0b' : dark ? '#4a6fa5' : '#93c5fd';
      ctx.fill();

      // 高亮边上显示"插入"提示
      if (isHighlighted) {
        const labelX = (cx + px) / 2;
        const labelY = (cy + py) / 2;
        const label = $t('deploy.packageDeployManagement.branchManagement.topologyDragInsert');
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const textW = ctx.measureText(label).width;
        const pad = 6;

        roundRect(ctx, labelX - textW / 2 - pad, labelY - 10 - pad, textW + pad * 2, 20 + pad, 4);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelX, labelY);
      }

      drawEdges(child);
    }
  }

  for (const r of roots) drawEdges(r);

  // 如果拖拽中，目标节点高亮
  let highlightNodeId: string | null = null;
  if (dragState.active && dragState.dropTarget?.type === 'node') {
    highlightNodeId = dragState.dropTarget.targetNode.branch.id;
  }

  // 画节点
  function drawNode(node: TreeNode) {
    // 拖拽中的节点半透明
    const isDragSource =
      dragState.active && dragState.node?.branch.id === node.branch.id;
    if (isDragSource) {
      ctx.globalAlpha = 0.35;
    }

    const { x, y, branch, depth } = node;
    const isRoot = depth === 0;
    const isLeaf = node.children.length === 0;
    const isDisabled = !branch.enabled;
    const isHighlight = node.branch.id === highlightNodeId;

    const grad = ctx.createLinearGradient(x, y, x, y + NODE_H);
    if (isHighlight) {
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#d97706');
    } else if (isDisabled) {
      grad.addColorStop(0, dark ? '#3a3a3a' : '#e5e7eb');
      grad.addColorStop(1, dark ? '#2a2a2a' : '#d1d5db');
    } else if (isRoot) {
      grad.addColorStop(0, dark ? '#1e3a8a' : '#1d4ed8');
      grad.addColorStop(1, dark ? '#1e40af' : '#1e40af');
    } else if (isLeaf) {
      grad.addColorStop(0, dark ? '#0e7490' : '#0ea5e9');
      grad.addColorStop(1, dark ? '#0c6a80' : '#0284c7');
    } else {
      grad.addColorStop(0, dark ? '#1e4d8c' : '#3b82f6');
      grad.addColorStop(1, dark ? '#1a3a6e' : '#2563eb');
    }

    roundRect(ctx, x, y, NODE_W, NODE_H, 8);
    ctx.fillStyle = grad;
    ctx.fill();

    if (isHighlight) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
    } else {
      ctx.strokeStyle = isRoot
        ? dark ? '#60a5fa' : '#93c5fd'
        : dark ? '#3b82f6' : '#bfdbfe';
      ctx.lineWidth = isRoot ? 2 : 1.5;
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = isDisabled ? (dark ? '#6b7280' : '#9ca3af') : '#ffffff';
    ctx.font = `${isRoot || isHighlight ? 'bold ' : ''}13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = truncateText(ctx, branch.name, NODE_W - 20);
    ctx.fillText(label, x + NODE_W / 2, y + NODE_H / 2);

    if (isDragSource) {
      ctx.globalAlpha = 1;
    }

    for (const child of node.children) drawNode(child);
  }

  for (const r of roots) drawNode(r);

  // 画拖拽幽灵节点
  if (dragState.active && dragState.node) {
    const gx = dragState.ghostX - NODE_W / 2;
    const gy = dragState.ghostY - NODE_H / 2;
    ctx.globalAlpha = 0.85;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    const grad = ctx.createLinearGradient(gx, gy, gx, gy + NODE_H);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(1, '#d97706');

    roundRect(ctx, gx, gy, NODE_W, NODE_H, 8);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = truncateText(ctx, dragState.node.branch.name, NODE_W - 20);
    ctx.fillText(label, gx + NODE_W / 2, gy + NODE_H / 2);

    ctx.globalAlpha = 1;

    // 在幽灵节点下方显示放置提示
    if (dragState.dropTarget) {
      let tip = '';
      if (dragState.dropTarget.type === 'root') {
        tip = $t('deploy.packageDeployManagement.branchManagement.topologyDragToRoot');
      } else if (dragState.dropTarget.type === 'node') {
        tip = $t('deploy.packageDeployManagement.branchManagement.topologyDragToChild', {
          name: dragState.dropTarget.targetNode.branch.name,
        });
      }
      if (tip) {
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const tipW = ctx.measureText(tip).width;
        const tipX = gx + NODE_W / 2;
        const tipY = gy + NODE_H + 8;

        roundRect(ctx, tipX - tipW / 2 - 6, tipY - 2, tipW + 12, 20, 4);
        ctx.fillStyle = dark ? 'rgba(30,30,30,0.9)' : 'rgba(0,0,0,0.75)';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(tip, tipX, tipY);
      }
    }
  }
}

function initCanvas() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const roots = buildTree();
  if (roots.length === 0) return;

  for (const r of roots) calcSubtreeWidth(r);

  let totalWidth = PADDING * 2;
  for (let i = 0; i < roots.length; i++) {
    totalWidth += roots[i]!.subtreeWidth;
    if (i < roots.length - 1) totalWidth += H_GAP * 2;
  }

  let startX = PADDING;
  for (let i = 0; i < roots.length; i++) {
    assignPositions(roots[i]!, startX, 0);
    startX += roots[i]!.subtreeWidth + H_GAP * 2;
  }
  const allNodes: TreeNode[] = [];
  for (const r of roots) collectNodes(r, allNodes);
  const maxDepth = Math.max(...allNodes.map((n) => n.depth));
  const totalHeight = PADDING * 2 + (maxDepth + 1) * (NODE_H + V_GAP) - V_GAP;

  contentW = totalWidth;

  const dpr = window.devicePixelRatio || 1;
  const viewW = container.clientWidth;
  const viewH = container.clientHeight;
  canvas.width = viewW * dpr;
  canvas.height = viewH * dpr;
  canvas.style.width = `${viewW}px`;
  canvas.style.height = `${viewH}px`;

  const scaleX = viewW / totalWidth;
  const scaleY = viewH / totalHeight;
  scale = Math.min(scaleX, scaleY, 1) * 0.9;

  offsetX = (viewW - totalWidth * scale) / 2;
  offsetY = (viewH - totalHeight * scale) / 2;

  redraw();
}

// 滚轮缩放
function onWheel(e: WheelEvent) {
  e.preventDefault();
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(Math.max(scale * delta, 0.1), 5);

  offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
  offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
  scale = newScale;

  redraw();
}

// 鼠标按下：左键 = 开始拖拽节点，右键 = 平移画布
function onMouseDown(e: MouseEvent) {
  if (e.button === 2) {
    // 右键拖动画布
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartOffsetX = offsetX;
    dragStartOffsetY = offsetY;
    return;
  }

  if (e.button === 0) {
    // 左键：检测是否点击了节点
    const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
    const hitNode = hitTestNode(cx, cy);
    if (hitNode) {
      e.preventDefault();
      dragState.active = true;
      dragState.node = hitNode;
      dragState.ghostX = cx;
      dragState.ghostY = cy;
      dragState.dropTarget = null;
      const canvas = canvasRef.value;
      if (canvas) {
        canvas.style.cursor = 'grabbing';
      }
      redraw();
    }
  }
}

function onMouseMove(e: MouseEvent) {
  // 右键平移画布
  if (isDragging) {
    offsetX = dragStartOffsetX + (e.clientX - dragStartX);
    offsetY = dragStartOffsetY + (e.clientY - dragStartY);
    redraw();
    return;
  }

  // 左键拖拽节点
  if (dragState.active) {
    const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
    dragState.ghostX = cx;
    dragState.ghostY = cy;
    dragState.dropTarget = detectDropTarget(cx, cy);
    redraw();
    return;
  }

  // 悬停时改变光标样式
  const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
  const hitNode = hitTestNode(cx, cy);
  const canvas = canvasRef.value;
  if (canvas) {
    canvas.style.cursor = hitNode ? 'grab' : 'default';
  }
}

function onMouseUp(e: MouseEvent) {
  if (e.button === 2) {
    isDragging = false;
    return;
  }

  if (e.button === 0 && dragState.active) {
    // 执行放置
    if (dragState.dropTarget) {
      executeDrop(dragState.dropTarget);
    }
    // 重置拖拽状态
    dragState.active = false;
    dragState.node = null;
    dragState.dropTarget = null;
    const canvas = canvasRef.value;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
    redraw();
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
}

function bindEvents() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
}

function unbindEvents() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.removeEventListener('wheel', onWheel);
  canvas.removeEventListener('mousedown', onMouseDown);
  canvas.removeEventListener('mousemove', onMouseMove);
  canvas.removeEventListener('mouseup', onMouseUp);
  canvas.removeEventListener('contextmenu', onContextMenu);
}

watch(
  () => props.open,
  async (val) => {
    if (val) {
      await nextTick();
      scale = 1;
      offsetX = 0;
      offsetY = 0;
      initCanvas();
      bindEvents();
    } else {
      unbindEvents();
      // 重置拖拽状态
      dragState.active = false;
      dragState.node = null;
      dragState.dropTarget = null;
    }
  },
);

watch(
  () => props.branches,
  async () => {
    if (props.open) {
      await nextTick();
      initCanvas();
    }
  },
);

onUnmounted(() => {
  unbindEvents();
});
</script>

<template>
  <Modal
    :open="props.open"
    :title="$t('deploy.packageDeployManagement.branchManagement.topologyTitle')"
    :footer="null"
    width="80vw"
    :body-style="{ padding: '0' }"
    @cancel="emits('update:open', false)"
  >
    <div ref="containerRef" class="topology-container">
      <canvas ref="canvasRef" class="topology-canvas" />
      <div class="topology-legend">
        <span class="legend-item">
          <span class="legend-dot" style="background: #0ea5e9" />
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyLeafBranch') }}
        </span>
        <span class="legend-item">
          <span class="legend-dot" style="background: #3b82f6" />
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyChildBranch') }}
        </span>
        <span class="legend-item">
          <span class="legend-dot" style="background: #1d4ed8" />
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyRootBranch') }}
        </span>
        <span class="legend-item">
          <span class="legend-dot" style="background: #9ca3af" />
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyDisabledBranch') }}
        </span>
        <span class="legend-tip">
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyTip') }}
        </span>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.topology-container {
  position: relative;
  width: 100%;
  height: 60vh;
  overflow: hidden;
  background: #f0f5ff;
}

:global(.dark) .topology-container {
  background: #141414;
}

.topology-canvas {
  display: block;
  cursor: grab;
}

.topology-canvas:active {
  cursor: grabbing;
}

.topology-legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
  backdrop-filter: blur(4px);
}

:global(.dark) .topology-legend {
  background: rgba(30, 30, 30, 0.85);
  color: #9ca3af;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  display: inline-block;
  width: 20px;
  height: 12px;
  border-radius: 3px;
}

.legend-tip {
  color: #9ca3af;
  font-size: 11px;
}
</style>
