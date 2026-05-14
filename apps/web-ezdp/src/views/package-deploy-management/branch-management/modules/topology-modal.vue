<script lang="ts" setup>
import type { BranchManagementApi } from '#/api/package-deploy-management/branch-management';

import { nextTick, onUnmounted, ref, watch } from 'vue';

import { Modal } from 'ant-design-vue';

import { $t } from '#/locales';

interface Props {
  open: boolean;
  branches: BranchManagementApi.BranchManagement[];
}

interface Emits {
  (e: 'update:open', value: boolean): void;
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

interface TreeNode {
  branch: BranchManagementApi.BranchManagement;
  children: TreeNode[];
  // 子节点（被继承者）在上，父节点（被继承的）在下
  // depth=0 表示叶子节点（没有子分支的分支），depth 越大越靠下
  x: number;
  y: number;
  subtreeWidth: number;
  depth: number;
}

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

  // children 表示"以该节点为父分支的子分支"（继承者）
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

// 计算每棵树的最大深度（用于翻转 y 坐标）

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

// 正向分配位置（根在 depth=0），之后再翻转 y
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

  // 计算每棵树的最大深度，用于翻转 y（叶子在上，根在下）
  const allNodes: TreeNode[] = [];
  for (const r of roots) collectNodes(r, allNodes);

  const globalMaxDepth = Math.max(...allNodes.map((n) => n.depth));

  // 翻转 y：depth=0（根）在最下面，depth=maxDepth（叶子）在最上面
  for (const n of allNodes) {
    const flippedDepth = globalMaxDepth - n.depth;
    n.y = PADDING + flippedDepth * (NODE_H + V_GAP);
  }

  // 先画连线
  function drawEdges(node: TreeNode) {
    for (const child of node.children) {
      // child 是继承者（在上方），node 是被继承者（在下方）
      // 连线从 child 底部 -> node 顶部
      const cx = child.x + NODE_W / 2;
      const cy = child.y + NODE_H; // child 底部
      const px = node.x + NODE_W / 2;
      const py = node.y; // node 顶部
      const midY = (cy + py) / 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx, midY, px, midY, px, py);
      ctx.strokeStyle = dark ? '#4a6fa5' : '#93c5fd';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 箭头指向父节点（向下）
      const arrowSize = 7;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - arrowSize * 0.5, py + arrowSize);
      ctx.lineTo(px + arrowSize * 0.5, py + arrowSize);
      ctx.closePath();
      ctx.fillStyle = dark ? '#4a6fa5' : '#93c5fd';
      ctx.fill();

      drawEdges(child);
    }
  }

  for (const r of roots) drawEdges(r);

  // 再画节点（覆盖在连线上）
  function drawNode(node: TreeNode) {
    const { x, y, branch, depth } = node;
    const isRoot = depth === 0; // 根节点（最底层，被所有人继承）
    const isLeaf = node.children.length === 0; // 叶子节点（最顶层）
    const isDisabled = !branch.enabled;

    const grad = ctx.createLinearGradient(x, y, x, y + NODE_H);
    if (isDisabled) {
      grad.addColorStop(0, dark ? '#3a3a3a' : '#e5e7eb');
      grad.addColorStop(1, dark ? '#2a2a2a' : '#d1d5db');
    } else if (isRoot) {
      // 根节点：最深蓝
      grad.addColorStop(0, dark ? '#1e3a8a' : '#1d4ed8');
      grad.addColorStop(1, dark ? '#1e40af' : '#1e40af');
    } else if (isLeaf) {
      // 叶子节点：最浅蓝
      grad.addColorStop(0, dark ? '#0e7490' : '#0ea5e9');
      grad.addColorStop(1, dark ? '#0c6a80' : '#0284c7');
    } else {
      grad.addColorStop(0, dark ? '#1e4d8c' : '#3b82f6');
      grad.addColorStop(1, dark ? '#1a3a6e' : '#2563eb');
    }

    roundRect(ctx, x, y, NODE_W, NODE_H, 8);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = isRoot
      ? dark ? '#60a5fa' : '#93c5fd'
      : dark ? '#3b82f6' : '#bfdbfe';
    ctx.lineWidth = isRoot ? 2 : 1.5;
    ctx.stroke();

    ctx.fillStyle = isDisabled ? (dark ? '#6b7280' : '#9ca3af') : '#ffffff';
    ctx.font = `${isRoot ? 'bold ' : ''}13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = truncateText(ctx, branch.name, NODE_W - 20);
    ctx.fillText(label, x + NODE_W / 2, y + NODE_H / 2);

    for (const child of node.children) drawNode(child);
  }

  for (const r of roots) drawNode(r);
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

  // 计算总高度
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

  // canvas 固定为容器大小
  const dpr = window.devicePixelRatio || 1;
  const viewW = container.clientWidth;
  const viewH = container.clientHeight;
  canvas.width = viewW * dpr;
  canvas.height = viewH * dpr;
  canvas.style.width = `${viewW}px`;
  canvas.style.height = `${viewH}px`;

  // 初始缩放：让内容适应视口
  const scaleX = viewW / totalWidth;
  const scaleY = viewH / totalHeight;
  scale = Math.min(scaleX, scaleY, 1) * 0.9;

  // 居中
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

  // 以鼠标位置为缩放中心
  offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
  offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
  scale = newScale;

  redraw();
}

// 右键拖动
function onMouseDown(e: MouseEvent) {
  if (e.button !== 2) return;
  e.preventDefault();
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartOffsetX = offsetX;
  dragStartOffsetY = offsetY;
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging) return;
  offsetX = dragStartOffsetX + (e.clientX - dragStartX);
  offsetY = dragStartOffsetY + (e.clientY - dragStartY);
  redraw();
}

function onMouseUp(e: MouseEvent) {
  if (e.button !== 2) return;
  isDragging = false;
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
