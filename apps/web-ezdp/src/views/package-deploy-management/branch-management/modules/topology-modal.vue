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
const H_GAP = 80;
const V_GAP = 24;
const PADDING = 40;
// 连接点半径
const CONN_R = 8;

// 视口变换
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// 画布平移（右键拖动）
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;

let contentW = 0;

interface TreeNode {
  branch: BranchManagementApi.BranchManagement;
  children: TreeNode[];
  x: number;
  y: number;
  subtreeWidth: number;
  depth: number;
}

// 缓存布局
let cachedNodes: TreeNode[] = [];
let cachedEdges: { parent: TreeNode; child: TreeNode }[] = [];

// ── 框选状态 ──────────────────────────────────────────────
interface SelectionBox {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}
const selBox: SelectionBox = {
  active: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
};
// 当前选中的节点集合
let selectedNodes: Set<string> = new Set();

// ── 单节点拖拽（原有功能）────────────────────────────────
interface SingleDragState {
  active: boolean;
  node: TreeNode | null;
  ghostX: number;
  ghostY: number;
  dropTarget: DropTarget | null;
}
type DropTarget =
  | { type: 'edge'; parentNode: TreeNode; childNode: TreeNode }
  | { type: 'node-left'; targetNode: TreeNode }  // 拖到节点左侧：成为目标父级（目标继承拖拽节点）
  | { type: 'node-right'; targetNode: TreeNode } // 拖到节点右侧：成为目标子级（拖拽节点继承目标）
  | { type: 'root' };

const singleDrag: SingleDragState = {
  active: false,
  node: null,
  ghostX: 0,
  ghostY: 0,
  dropTarget: null,
};

// ── 选中组连接点拖拽 ──────────────────────────────────────
// side: 'left' = 整组继承某父节点；'right' = 某节点继承整组
interface GroupConnDrag {
  active: boolean;
  side: 'left' | 'right' | null;
  ghostX: number;
  ghostY: number;
  dropNode: TreeNode | null; // 悬停的目标节点
}
const groupDrag: GroupConnDrag = {
  active: false,
  side: null,
  ghostX: 0,
  ghostY: 0,
  dropNode: null,
};

// ── 工具函数 ──────────────────────────────────────────────
function buildTree(): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const b of props.branches) {
    map.set(b.id, { branch: b, children: [], x: 0, y: 0, subtreeWidth: 0, depth: 0 });
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
    node.children.sort((a, b) => (a.branch.sortOrder ?? 0) - (b.branch.sortOrder ?? 0));
    for (const child of node.children) sortChildren(child);
  }
  roots.sort((a, b) => (a.branch.sortOrder ?? 0) - (b.branch.sortOrder ?? 0));
  for (const r of roots) sortChildren(r);
  return roots;
}

function calcSubtreeHeight(node: TreeNode): number {
  if (node.children.length === 0) { node.subtreeWidth = NODE_H; return NODE_H; }
  let total = 0;
  for (let i = 0; i < node.children.length; i++) {
    total += calcSubtreeHeight(node.children[i]!);
    if (i < node.children.length - 1) total += V_GAP;
  }
  node.subtreeWidth = Math.max(total, NODE_H);
  return node.subtreeWidth;
}

function assignPositions(node: TreeNode, startY: number, depth: number) {
  node.depth = depth;
  node.x = PADDING + depth * (NODE_W + H_GAP);
  node.y = startY + (node.subtreeWidth - NODE_H) / 2;
  let childY = startY;
  for (const child of node.children) {
    assignPositions(child, childY, depth + 1);
    childY += child.subtreeWidth + V_GAP;
  }
}

function collectNodes(node: TreeNode, out: TreeNode[]) {
  out.push(node);
  for (const c of node.children) collectNodes(c, out);
}

function collectEdges(node: TreeNode, out: { parent: TreeNode; child: TreeNode }[]) {
  for (const child of node.children) {
    out.push({ parent: node, child });
    collectEdges(child, out);
  }
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 0 && ctx.measureText(result + '…').width > maxWidth) result = result.slice(0, -1);
  return result + '…';
}

function screenToCanvas(clientX: number, clientY: number) {
  const canvas = canvasRef.value;
  if (!canvas) return { cx: 0, cy: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    cx: (clientX - rect.left - offsetX) / scale,
    cy: (clientY - rect.top - offsetY) / scale,
  };
}

function hitTestNode(cx: number, cy: number): TreeNode | null {
  for (const node of cachedNodes) {
    if (cx >= node.x && cx <= node.x + NODE_W && cy >= node.y && cy <= node.y + NODE_H) return node;
  }
  return null;
}

function pointToEdgeDist(px: number, py: number, edge: { parent: TreeNode; child: TreeNode }): number {
  const { parent, child } = edge;
  const x0 = parent.x + NODE_W, y0 = parent.y + NODE_H / 2;
  const x1 = child.x, y1 = child.y + NODE_H / 2;
  const midX = (x0 + x1) / 2;
  let minDist = Number.POSITIVE_INFINITY;
  for (let t = 0; t <= 1; t += 0.05) {
    const bx = (1-t)**3*x0 + 3*(1-t)**2*t*midX + 3*(1-t)*t**2*midX + t**3*x1;
    const by = (1-t)**3*y0 + 3*(1-t)**2*t*y0   + 3*(1-t)*t**2*y1   + t**3*y1;
    const d = Math.hypot(px - bx, py - by);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function hitTestEdge(cx: number, cy: number): { parent: TreeNode; child: TreeNode } | null {
  const threshold = 15;
  let best: { parent: TreeNode; child: TreeNode } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const edge of cachedEdges) {
    if (singleDrag.node) {
      if (edge.parent.branch.id === singleDrag.node.branch.id || edge.child.branch.id === singleDrag.node.branch.id) continue;
    }
    const d = pointToEdgeDist(cx, cy, edge);
    if (d < threshold && d < bestDist) { bestDist = d; best = edge; }
  }
  return best;
}

function detectDropTarget(cx: number, cy: number): DropTarget | null {
  if (!singleDrag.node) return null;

  // 1. 检测是否悬停在节点上
  const hitNode = hitTestNode(cx, cy);
  if (hitNode && hitNode.branch.id !== singleDrag.node.branch.id) {
    // 判断是在节点左侧还是右侧
    const nodeCenterX = hitNode.x + NODE_W / 2;
    console.log('[拖拽检测] 悬停在节点上', {
      hitNodeName: hitNode.branch.name,
      cx,
      nodeCenterX,
      isLeft: cx < nodeCenterX,
    });
    if (cx < nodeCenterX) {
      // 拖到节点左侧：成为目标父级（目标继承拖拽节点）
      return { type: 'node-left', targetNode: hitNode };
    } else {
      // 拖到节点右侧：成为目标子级（拖拽节点继承目标）
      return { type: 'node-right', targetNode: hitNode };
    }
  }

  // 2. 检测是否悬停在边上（插入到边中间）
  const hitEdge = hitTestEdge(cx, cy);
  if (hitEdge) return { type: 'edge', parentNode: hitEdge.parent, childNode: hitEdge.child };

  // 3. 空白区域 → 变为根节点
  console.log('[拖拽检测] 空白区域，设为根节点', { cx, cy });
  return { type: 'root' };
}

function isDescendant(ancestorId: string, targetId: string): boolean {
  const map = new Map<string, string>();
  for (const b of props.branches) { if (b.parentBranchId) map.set(b.id, b.parentBranchId); }
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

// ── 选中组的包围盒和连接点 ────────────────────────────────
function getSelectionBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const nodes = cachedNodes.filter(n => selectedNodes.has(n.branch.id));
  if (nodes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + NODE_H);
  }
  return { minX, minY, maxX, maxY };
}

// 左连接点中心（整组继承某父）
function getLeftConnCenter(): { x: number; y: number } | null {
  const b = getSelectionBounds();
  if (!b) return null;
  return { x: b.minX - 20, y: (b.minY + b.maxY) / 2 };
}

// 右连接点中心（某节点继承整组）
function getRightConnCenter(): { x: number; y: number } | null {
  const b = getSelectionBounds();
  if (!b) return null;
  return { x: b.maxX + 20, y: (b.minY + b.maxY) / 2 };
}

function hitTestConnPoint(cx: number, cy: number): 'left' | 'right' | null {
  if (selectedNodes.size === 0) return null;
  const lc = getLeftConnCenter();
  const rc = getRightConnCenter();
  if (lc && Math.hypot(cx - lc.x, cy - lc.y) <= CONN_R + 4) return 'left';
  if (rc && Math.hypot(cx - rc.x, cy - rc.y) <= CONN_R + 4) return 'right';
  return null;
}

// 选中组中深度最浅的节点（作为整组的"根"，用于右侧连接点）
function getGroupRootNode(): TreeNode | null {
  const nodes = cachedNodes.filter(n => selectedNodes.has(n.branch.id));
  if (nodes.length === 0) return null;
  return nodes.reduce((a, b) => (a.depth < b.depth ? a : b));
}

// ── 执行放置（单节点/选中组）────────────────────────────
async function executeDrop(target: DropTarget | TreeNode | null, mode: 'single' | 'groupLeft' | 'groupRight') {
  console.log('[executeDrop] 开始执行', { mode, target });
  if (mode === 'single') {
    const dragNode = singleDrag.node;
    if (!dragNode || !target) return;
    const t = target as DropTarget;
    const dragId = dragNode.branch.id;
    let newParentBranchId = '';
    let needUpdateChild: { childId: string; newParentId: string } | null = null;

    if (t.type === 'edge') {
      // 插入到边中间：dragNode 的 parent → edge.parentNode，edge.child 的 parent → dragNode
      newParentBranchId = t.parentNode.branch.id;
      needUpdateChild = { childId: t.childNode.branch.id, newParentId: dragId };
    } else if (t.type === 'node-left') {
      // 拖到节点左侧：成为目标父级（目标继承拖拽节点）
      newParentBranchId = '';
      needUpdateChild = { childId: t.targetNode.branch.id, newParentId: dragId };
    } else if (t.type === 'node-right') {
      // 拖到节点右侧：成为目标子级（拖拽节点继承目标）
      newParentBranchId = t.targetNode.branch.id;
    } else {
      // 变为根节点
      newParentBranchId = '';
    }

    // 检查循环依赖
    if (newParentBranchId === dragId) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }
    // 检查：目标节点不能是拖拽节点自己（这个在前面已经排除了，但再检查一次以防万一）
    if (needUpdateChild && needUpdateChild.childId === dragId) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }

    // 情况1: 拖拽节点继承某个节点 → 检查目标节点是否是拖拽节点的后代
    if (newParentBranchId && isDescendant(dragId, newParentBranchId)) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }

    // 情况2: 某个节点继承拖拽节点（拖拽到左侧）→ 检查拖拽节点是否是目标节点的后代
    if (needUpdateChild) {
      // 检查：如果拖拽节点当前是目标节点的后代，让目标继承拖拽会形成循环
      const isCircular = isDescendant(needUpdateChild.childId, dragId);
      console.log('[拖拽检测] 左侧拖拽', {
        dragId,
        targetId: needUpdateChild.childId,
        isCircular,
        dragNodeName: props.branches.find(b => b.id === dragId)?.name,
        targetNodeName: props.branches.find(b => b.id === needUpdateChild.childId)?.name,
      });
      if (isCircular) {
        message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
        return;
      }
      // 检查：如果拖拽节点和目标节点在同一个继承链中，重新排列也可能形成循环
      // 这个检测需要考虑更复杂的情况，但基本的安全检查是：不能让A继承B，同时B已经继承A
    }

    try {
      console.log('[拖拽执行] 开始更新', {
        dragId,
        newParentBranchId,
        needUpdateChild,
        dragNodeName: props.branches.find(b => b.id === dragId)?.name,
        targetNodeName: needUpdateChild ? props.branches.find(b => b.id === needUpdateChild.childId)?.name : 'none',
      });

      // 如果是左侧拖拽（需要两次更新），先断开目标节点的原有父关系
      if (needUpdateChild) {
        // 先把目标节点设为根节点，断开原有关系
        await updateBranchManagement(needUpdateChild.childId, { parentBranchId: '' });
        console.log('[拖拽执行] 断开目标节点原有关系完成');
      }

      // 更新拖拽节点的 parentBranchId
      await updateBranchManagement(dragId, { parentBranchId: newParentBranchId });
      console.log('[拖拽执行] 更新拖拽节点完成');

      // 如果需要，建立新的父子关系
      if (needUpdateChild) {
        await updateBranchManagement(needUpdateChild.childId, { parentBranchId: needUpdateChild.newParentId });
        console.log('[拖拽执行] 建立新父子关系完成');
      }

      message.success($t('deploy.packageDeployManagement.branchManagement.topologyDragSuccess'));
      emits('refresh');
    } catch {
      message.error($t('deploy.packageDeployManagement.branchManagement.topologyDragFailed'));
    }
  } else if (mode === 'groupLeft') {
    // 整组继承某个父节点
    const dropNode = target as TreeNode | null;
    if (!dropNode) return;
    const groupRoot = getGroupRootNode();
    if (!groupRoot) return;

    // 检查是否形成循环
    if (selectedNodes.has(dropNode.branch.id)) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }
    if (isDescendant(groupRoot.branch.id, dropNode.branch.id)) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }

    try {
      // 所有选中节点都改为继承 dropNode
      for (const id of selectedNodes) {
        await updateBranchManagement(id, { parentBranchId: dropNode.branch.id });
      }
      message.success($t('deploy.packageDeployManagement.branchManagement.topologyDragSuccess'));
      selectedNodes.clear();
      emits('refresh');
    } catch {
      message.error($t('deploy.packageDeployManagement.branchManagement.topologyDragFailed'));
    }
  } else if (mode === 'groupRight') {
    // 某个节点继承整组（整组的根节点作为父）
    const dropNode = target as TreeNode | null;
    if (!dropNode) return;
    const groupRoot = getGroupRootNode();
    if (!groupRoot) return;

    // 检查是否形成循环
    if (selectedNodes.has(dropNode.branch.id)) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }
    if (isDescendant(groupRoot.branch.id, dropNode.branch.id)) {
      message.warning($t('deploy.packageDeployManagement.branchManagement.topologyDragCannotSelf'));
      return;
    }

    try {
      // dropNode 继承 groupRoot
      await updateBranchManagement(dropNode.branch.id, { parentBranchId: groupRoot.branch.id });
      message.success($t('deploy.packageDeployManagement.branchManagement.topologyDragSuccess'));
      selectedNodes.clear();
      emits('refresh');
    } catch {
      message.error($t('deploy.packageDeployManagement.branchManagement.topologyDragFailed'));
    }
  }
}

// ── 绘制 ─────────────────────────────────────────────────────
function redraw() {
  const canvas = canvasRef.value;
  if (!canvas || contentW === 0) return;
  const dark = isDark();
  const dpr = window.devicePixelRatio || 1;
  const viewW = canvas.width / dpr, viewH = canvas.height / dpr;
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

  for (const r of roots) calcSubtreeHeight(r);
  let startY = PADDING;
  for (let i = 0; i < roots.length; i++) {
    assignPositions(roots[i]!, startY, 0);
    startY += roots[i]!.subtreeWidth + V_GAP * 2;
  }

  cachedNodes = [];
  for (const r of roots) collectNodes(r, cachedNodes);
  cachedEdges = [];
  for (const r of roots) collectEdges(r, cachedEdges);

  // 绘制连线（箭头从子指向父）
  function drawEdges(node: TreeNode) {
    for (const child of node.children) {
      const x0 = child.x, y0 = child.y + NODE_H / 2; // 子节点左侧
      const x1 = node.x + NODE_W, y1 = node.y + NODE_H / 2; // 父节点右侧
      const midX = (x0 + x1) / 2;

      const isHighlighted =
        singleDrag.active &&
        singleDrag.dropTarget?.type === 'edge' &&
        singleDrag.dropTarget.parentNode.branch.id === node.branch.id &&
        singleDrag.dropTarget.childNode.branch.id === child.branch.id;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(midX, y0, midX, y1, x1, y1);

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

      // 箭头画在父节点右侧，指向父（向左）
      const arrowSize = 7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - arrowSize, y1 - arrowSize * 0.5);
      ctx.lineTo(x1 - arrowSize, y1 + arrowSize * 0.5);
      ctx.closePath();
      ctx.fillStyle = isHighlighted ? '#f59e0b' : (dark ? '#4a6fa5' : '#93c5fd');
      ctx.fill();

      if (isHighlighted) {
        const labelX = (x0 + x1) / 2, labelY = (y0 + y1) / 2;
        const label = $t('deploy.packageDeployManagement.branchManagement.topologyDragInsert');
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const textW = ctx.measureText(label).width, pad = 6;
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

  let highlightNodeId: string | null = null;
  let highlightSide: 'left' | 'right' | null = null;
  if (singleDrag.active) {
    if (singleDrag.dropTarget?.type === 'node-left') {
      highlightNodeId = singleDrag.dropTarget.targetNode.branch.id;
      highlightSide = 'left';
    } else if (singleDrag.dropTarget?.type === 'node-right') {
      highlightNodeId = singleDrag.dropTarget.targetNode.branch.id;
      highlightSide = 'right';
    }
  }

  // 绘制节点
  function drawNode(node: TreeNode) {
    const isDragSource = singleDrag.active && singleDrag.node?.branch.id === node.branch.id;
    const isSelected = selectedNodes.has(node.branch.id);
    if (isDragSource) ctx.globalAlpha = 0.35;

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
    } else if (isSelected) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = isRoot ? (dark ? '#60a5fa' : '#93c5fd') : (dark ? '#3b82f6' : '#bfdbfe');
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

    if (isDragSource) ctx.globalAlpha = 1;

    for (const child of node.children) drawNode(child);
  }

  // 绘制节点高亮区域（左右侧提示）
  function drawNodeHighlight(node: TreeNode, ctx: CanvasRenderingContext2D, dark: boolean) {
    const isHighlight = node.branch.id === highlightNodeId;
    if (!isHighlight || !highlightSide) return;

    const { x, y } = node;
    ctx.save();
    if (highlightSide === 'left') {
      // 左侧高亮：成为父级
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(x - 30, y, 30, NODE_H);
      // 绘制箭头指向左侧
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('←', x - 15, y + NODE_H / 2);
    } else {
      // 右侧高亮：成为子级
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(x + NODE_W, y, 30, NODE_H);
      // 绘制箭头指向右侧
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8b5cf6';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('→', x + NODE_W + 15, y + NODE_H / 2);
    }
    ctx.restore();

    for (const child of node.children) drawNodeHighlight(child, ctx, dark);
  }

  for (const r of roots) drawNode(r);

  // 绘制左右高亮区域（拖拽悬停提示，在所有节点绘制完成后）
  for (const r of roots) {
    drawNodeHighlight(r, ctx, dark);
  }

  // 绘制选中组的连接点
  if (selectedNodes.size > 0 && !singleDrag.active && !groupDrag.active) {
    const lc = getLeftConnCenter();
    const rc = getRightConnCenter();
    if (lc) {
      ctx.beginPath();
      ctx.arc(lc.x, lc.y, CONN_R, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (rc) {
      ctx.beginPath();
      ctx.arc(rc.x, rc.y, CONN_R, 0, Math.PI * 2);
      ctx.fillStyle = '#8b5cf6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 绘制框选矩形
  if (selBox.active) {
    const x = Math.min(selBox.startX, selBox.endX);
    const y = Math.min(selBox.startY, selBox.endY);
    const w = Math.abs(selBox.endX - selBox.startX);
    const h = Math.abs(selBox.endY - selBox.startY);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  // 绘制单节点拖拽幽灵
  if (singleDrag.active && singleDrag.node) {
    const gx = singleDrag.ghostX - NODE_W / 2, gy = singleDrag.ghostY - NODE_H / 2;
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
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = truncateText(ctx, singleDrag.node.branch.name, NODE_W - 20);
    ctx.fillText(label, gx + NODE_W / 2, gy + NODE_H / 2);
    ctx.globalAlpha = 1;

    if (singleDrag.dropTarget) {
      let tip = '';
      if (singleDrag.dropTarget.type === 'root') {
        tip = $t('deploy.packageDeployManagement.branchManagement.topologyDragToRoot');
      } else if (singleDrag.dropTarget.type === 'node-left') {
        tip = $t('deploy.packageDeployManagement.branchManagement.topologyDragToParent', { name: singleDrag.dropTarget.targetNode.branch.name });
      } else if (singleDrag.dropTarget.type === 'node-right') {
        tip = $t('deploy.packageDeployManagement.branchManagement.topologyDragToChild', { name: singleDrag.dropTarget.targetNode.branch.name });
      }
      if (tip) {
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const tipW = ctx.measureText(tip).width;
        const tipX = gx + NODE_W / 2, tipY = gy + NODE_H + 8;
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

  // 绘制选中组连接点拖拽幽灵
  if (groupDrag.active && groupDrag.side) {
    const gx = groupDrag.ghostX, gy = groupDrag.ghostY;
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(gx, gy, CONN_R, 0, Math.PI * 2);
    ctx.fillStyle = groupDrag.side === 'left' ? '#10b981' : '#8b5cf6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;

    // 高亮悬停目标
    if (groupDrag.dropNode) {
      ctx.strokeStyle = groupDrag.side === 'left' ? '#10b981' : '#8b5cf6';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      roundRect(ctx, groupDrag.dropNode.x, groupDrag.dropNode.y, NODE_W, NODE_H, 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function initCanvas() {
  const canvas = canvasRef.value, container = containerRef.value;
  if (!canvas || !container) return;
  const roots = buildTree();
  if (roots.length === 0) return;

  for (const r of roots) calcSubtreeHeight(r);
  let totalHeight = PADDING * 2;
  for (let i = 0; i < roots.length; i++) {
    totalHeight += roots[i]!.subtreeWidth;
    if (i < roots.length - 1) totalHeight += V_GAP * 2;
  }

  let startY = PADDING;
  for (let i = 0; i < roots.length; i++) {
    assignPositions(roots[i]!, startY, 0);
    startY += roots[i]!.subtreeWidth + V_GAP * 2;
  }

  const allNodes: TreeNode[] = [];
  for (const r of roots) collectNodes(r, allNodes);
  const maxDepth = Math.max(...allNodes.map(n => n.depth));
  const totalWidth = PADDING * 2 + (maxDepth + 1) * (NODE_W + H_GAP) - H_GAP;

  contentW = totalWidth;

  const dpr = window.devicePixelRatio || 1;
  const viewW = container.clientWidth, viewH = container.clientHeight;
  canvas.width = viewW * dpr;
  canvas.height = viewH * dpr;
  canvas.style.width = `${viewW}px`;
  canvas.style.height = `${viewH}px`;

  const scaleX = viewW / totalWidth, scaleY = viewH / totalHeight;
  scale = Math.min(scaleX, scaleY, 1) * 0.9;

  offsetX = (viewW - totalWidth * scale) / 2;
  offsetY = (viewH - totalHeight * scale) / 2;

  redraw();
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(Math.max(scale * delta, 0.1), 5);
  offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
  offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
  scale = newScale;
  redraw();
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 2) {
    e.preventDefault();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartOffsetX = offsetX;
    panStartOffsetY = offsetY;
    return;
  }

  if (e.button === 0) {
    const { cx, cy } = screenToCanvas(e.clientX, e.clientY);

    // 1. 检测连接点点击（仅当选中时）
    if (selectedNodes.size > 0) {
      const conn = hitTestConnPoint(cx, cy);
      if (conn) {
        e.preventDefault();
        groupDrag.active = true;
        groupDrag.side = conn;
        groupDrag.ghostX = cx;
        groupDrag.ghostY = cy;
        groupDrag.dropNode = null;
        redraw();
        return;
      }
    }

    // 2. 检测节点点击
    const hitNode = hitTestNode(cx, cy);
    if (hitNode) {
      e.preventDefault();
      if (selectedNodes.size > 0 && !e.shiftKey) {
        // 如果有选中且未按 Shift，点击其他节点时清除选中
        selectedNodes.clear();
      }
      // 单节点拖拽
      singleDrag.active = true;
      singleDrag.node = hitNode;
      singleDrag.ghostX = cx;
      singleDrag.ghostY = cy;
      singleDrag.dropTarget = null;
      canvasRef.value!.style.cursor = 'grabbing';
      redraw();
      return;
    }

    // 3. 空白区域：开始框选（清除选中）
    e.preventDefault();
    selectedNodes.clear();
    selBox.active = true;
    selBox.startX = cx;
    selBox.startY = cy;
    selBox.endX = cx;
    selBox.endY = cy;
    redraw();
  }
}

function onMouseMove(e: MouseEvent) {
  // 右键平移
  if (isPanning) {
    offsetX = panStartOffsetX + (e.clientX - panStartX);
    offsetY = panStartOffsetY + (e.clientY - panStartY);
    redraw();
    return;
  }

  // 框选
  if (selBox.active) {
    const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
    selBox.endX = cx;
    selBox.endY = cy;
    redraw();
    return;
  }

  // 单节点拖拽
  if (singleDrag.active) {
    const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
    singleDrag.ghostX = cx;
    singleDrag.ghostY = cy;
    singleDrag.dropTarget = detectDropTarget(cx, cy);
    redraw();
    return;
  }

  // 选中组连接点拖拽
  if (groupDrag.active) {
    const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
    groupDrag.ghostX = cx;
    groupDrag.ghostY = cy;
    groupDrag.dropNode = hitTestNode(cx, cy);
    redraw();
    return;
  }

  // 悬停光标
  const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
  const hitNode = hitTestNode(cx, cy);
  const conn = hitTestConnPoint(cx, cy);
  const canvas = canvasRef.value;
  if (canvas) {
    if (conn) canvas.style.cursor = 'grab';
    else if (hitNode) canvas.style.cursor = 'grab';
    else canvas.style.cursor = 'default';
  }
}

function onMouseUp(e: MouseEvent) {
  if (e.button === 2) {
    isPanning = false;
    return;
  }

  if (e.button === 0) {
    // 框选结束
    if (selBox.active) {
      const x1 = Math.min(selBox.startX, selBox.endX);
      const y1 = Math.min(selBox.startY, selBox.endY);
      const x2 = Math.max(selBox.startX, selBox.endX);
      const y2 = Math.max(selBox.startY, selBox.endY);

      selectedNodes.clear();
      for (const node of cachedNodes) {
        if (node.x + NODE_W >= x1 && node.x <= x2 && node.y + NODE_H >= y1 && node.y <= y2) {
          selectedNodes.add(node.branch.id);
        }
      }
      selBox.active = false;
      redraw();
      return;
    }

    // 单节点拖拽结束
    if (singleDrag.active) {
      if (singleDrag.dropTarget) {
        executeDrop(singleDrag.dropTarget, 'single');
      }
      singleDrag.active = false;
      singleDrag.node = null;
      singleDrag.dropTarget = null;
      canvasRef.value!.style.cursor = 'default';
      redraw();
      return;
    }

    // 选中组连接点拖拽结束
    if (groupDrag.active && groupDrag.side) {
      if (groupDrag.dropNode) {
        executeDrop(groupDrag.dropNode, groupDrag.side === 'left' ? 'groupLeft' : 'groupRight');
      }
      groupDrag.active = false;
      groupDrag.side = null;
      groupDrag.dropNode = null;
      redraw();
      return;
    }
  }
}

function onContextMenu(e: MouseEvent) { e.preventDefault(); }

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

watch(() => props.open, async (val) => {
  if (val) {
    await nextTick();
    scale = 1; offsetX = 0; offsetY = 0;
    selectedNodes.clear();
    selBox.active = false;
    singleDrag.active = false;
    groupDrag.active = false;
    initCanvas();
    bindEvents();
  } else {
    unbindEvents();
  }
});

watch(() => props.branches, async () => {
  if (props.open) {
    await nextTick();
    selectedNodes.clear();
    initCanvas();
  }
});

onUnmounted(() => { unbindEvents(); });
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
        <span class="legend-item">
          <span class="legend-conn" style="background: #10b981" />
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyLeftConn') }}
        </span>
        <span class="legend-item">
          <span class="legend-conn" style="background: #8b5cf6" />
          {{ $t('deploy.packageDeployManagement.branchManagement.topologyRightConn') }}
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

.legend-conn {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-tip {
  color: #9ca3af;
  font-size: 11px;
}
</style>
