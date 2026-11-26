/**
 * 棋盘相对定位系统。
 *
 * 设计基准：916×412 CSS 像素（20:9，对应你手机 2400×1080 物理分辨率、约 2.6 的 DPR），
 * 十字中心为 (458, 206)。
 * 每个元素用「锚点 + 相对中心的偏移 + 设计尺寸」描述：
 *  - anchor: 该元素自身的哪个点对齐到计算出的位置
 *  - dx / dy: 相对十字中心的偏移（设计像素，右侧/下方为正）
 *  - w / h: 设计尺寸
 * 目标分辨率下：
 *  - 水平缩放 sx = 视口宽 / 916，竖直缩放 sy = 视口高 / 412
 *  - 偏移按各自方向缩放：x = 视口宽/2 + dx*sx，y = 视口高/2 + dy*sy
 *  - 尺寸按等比 min(sx, sy) 缩放，保证卡片/角标/文字不变形
 * 这样居中元素永远在中线上，绑在父元素角上的子元素由父元素算出的矩形再叠加相对偏移。
 */
export const DESIGN = { width: 916, height: 412 } as const;

export type AnchorX = "left" | "center" | "right";
export type AnchorY = "top" | "center" | "bottom";

export interface AnchorSpec {
  /** 水平锚点：元素自身哪个 x 边对齐到目标 x */
  ax: AnchorX;
  /** 竖直锚点 */
  ay: AnchorY;
  /** 相对十字中心的水平偏移（设计像素） */
  dx: number;
  /** 相对十字中心的竖直偏移（设计像素） */
  dy: number;
  /** 设计宽度 */
  w: number;
  /** 设计高度 */
  h: number;
  /** 子元素（绑定到父元素角上），偏移相对父元素左上角 */
  children?: Record<string, AnchorSpec>;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutContext {
  vw: number;
  vh: number;
  sx: number;
  sy: number;
  scale: number;
}

export function createContext(vw: number, vh: number): LayoutContext {
  const sx = vw / DESIGN.width;
  const sy = vh / DESIGN.height;
  return { vw, vh, sx, sy, scale: Math.min(sx, sy) };
}

/** 计算一个元素在目标分辨率下的矩形 */
export function place(spec: AnchorSpec, ctx: LayoutContext): Rect {
  const w = spec.w * ctx.scale;
  const h = spec.h * ctx.scale;
  const cx = ctx.vw / 2 + spec.dx * ctx.sx;
  const cy = ctx.vh / 2 + spec.dy * ctx.sy;
  const x =
    spec.ax === "left" ? cx : spec.ax === "right" ? cx - w : cx - w / 2;
  const y =
    spec.ay === "top" ? cy : spec.ay === "bottom" ? cy - h : cy - h / 2;
  return { x, y, w, h };
}

/** 计算绑定在父元素上的子元素（offsets 相对父元素左上角，按 scale 缩放） */
export function placeChild(
  parent: Rect,
  child: { ox: number; oy: number; w: number; h: number },
  ctx: LayoutContext,
): Rect {
  return {
    x: parent.x + child.ox * ctx.scale,
    y: parent.y + child.oy * ctx.scale,
    w: child.w * ctx.scale,
    h: child.h * ctx.scale,
  };
}

/** 以 CSS 变量形式写入棋盘根节点，供样式/组件使用 */
export function applyLayoutVars(
  ctx: LayoutContext,
  target: HTMLElement = document.documentElement,
) {
  target.style.setProperty("--gi-board-scale", String(ctx.scale));
  target.style.setProperty("--gi-board-sx", String(ctx.sx));
  target.style.setProperty("--gi-board-sy", String(ctx.sy));
  target.style.setProperty("--gi-vw", `${ctx.vw}px`);
  target.style.setProperty("--gi-vh", `${ctx.vh}px`);
}

/** 20:9 舞台在视口中的矩形（等比 contain 居中，十字中心即舞台中心） */
export function stageRect(ctx: LayoutContext): Rect {
  const stageW = Math.min(ctx.vw, ctx.vh * (20 / 9));
  const stageH = stageW * (9 / 20);
  return {
    x: (ctx.vw - stageW) / 2,
    y: (ctx.vh - stageH) / 2,
    w: stageW,
    h: stageH,
  };
}

/** 把 AnchorSpec 直接写到 DOM 元素上（相对定位，固定定位以视口为参照） */
export function applyAnchor(
  el: HTMLElement,
  spec: AnchorSpec,
  ctx: LayoutContext,
) {
  const r = place(spec, ctx);
  el.style.position = "fixed";
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
}

/** 对局 HUD 的锚点规格：舞台右上角内侧，尺寸按设计值等比缩放 */
export const HUD_ANCHOR: AnchorSpec = {
  ax: "right",
  ay: "top",
  dx: 430,
  dy: -186,
  w: 150,
  h: 34,
};

/** 调试用：把十字中心与舞台边框画出来，?debugLayout=1 打开 */
export function mountLayoutDebug(ctx: LayoutContext) {
  const id = "gi-layout-debug";
  document.getElementById(id)?.remove();
  const box = document.createElement("div");
  box.id = id;
  box.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999";
  const stage = stageRect(ctx);
  const frame = document.createElement("div");
  frame.style.cssText = `position:absolute;left:${stage.x}px;top:${stage.y}px;width:${stage.w}px;height:${stage.h}px;border:1px solid rgba(255,215,120,.8)`;
  const crossH = document.createElement("div");
  crossH.style.cssText = `position:absolute;left:0;right:0;top:50%;border-top:1px dashed rgba(120,220,255,.7)`;
  const crossV = document.createElement("div");
  crossV.style.cssText = `position:absolute;top:0;bottom:0;left:50%;border-left:1px dashed rgba(120,220,255,.7)`;
  box.append(frame, crossH, crossV);
  document.body.append(box);
}

/**
 * 录制当前棋盘内关键元素的矩形，换算成「相对舞台中心的百分比 + 尺寸百分比」。
 * 用于建立锚点数据库：后续按比例还原到其它分辨率时直接查表。
 */
export function dumpLayout(ctx: LayoutContext) {
  const stage = stageRect(ctx);
  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h / 2;
  // 棋盘内部是绝对定位（px），用结构选择器把各区域录成相对锚点
  const selectors: Record<string, string> = {
    boardRoot: ".gi-tcg-chessboard-new > div",
    characterSlot0: ".preserve-3d > div.absolute.w-21.h-48",
    characterSlot1: ".preserve-3d > div.absolute.w-21.h-48:nth-of-type(2)",
    oppSlot0: ".preserve-3d > div.absolute.top-0.left-0.h-36.w-21",
    card: ".card",
    character: "[data-gi-character]",
  };
  const out: Record<string, unknown> = {
    design: { ...DESIGN },
    viewport: { w: ctx.vw, h: ctx.vh },
    stage,
    center: { x: Math.round(cx), y: Math.round(cy) },
    elements: {},
  };
  const elements: Record<string, unknown> = {};
  for (const [name, selector] of Object.entries(selectors)) {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) {
      continue;
    }
    const r = el.getBoundingClientRect();
    elements[name] = {
      // 相对中心的偏移，换算成设计像素（±），方便直接写进 AnchorSpec
      dx: Math.round((r.x + r.width / 2 - cx) / ctx.sx),
      dy: Math.round((r.y + r.height / 2 - cy) / ctx.sy),
      w: Math.round(r.width / ctx.scale),
      h: Math.round(r.height / ctx.scale),
    };
  }
  out.elements = elements;
  (window as { __giLayout?: unknown }).__giLayout = out;
  console.info("[gi-layout]", JSON.stringify(out));
  return out;
}

/**
 * 全量扫描：遍历棋盘内所有绝对定位元素，生成「相对十字中心 + 设计尺寸」的锚点表。
 * 用于批量建立数据库，而不是只挑几个关键区域。
 */
export function dumpAllAnchors(ctx: LayoutContext) {
  const stage = stageRect(ctx);
  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h / 2;
  const root = document.querySelector<HTMLElement>(".gi-tcg-chessboard-new");
  if (!root) {
    return { elements: [] };
  }
  const elements: Array<Record<string, unknown>> = [];
  const visit = (el: HTMLElement, depth: number) => {
    if (depth > 6) {
      return;
    }
    for (const child of Array.from(el.children)) {
      const node = child as HTMLElement;
      const style = getComputedStyle(node);
      if (style.position === "absolute" || style.position === "fixed") {
        const r = node.getBoundingClientRect();
        if (r.width > 4 && r.height > 4) {
          elements.push({
            cls: (node.className || "").toString().slice(0, 80),
            dx: Math.round((r.x + r.width / 2 - cx) / ctx.sx),
            dy: Math.round((r.y + r.height / 2 - cy) / ctx.sy),
            w: Math.round(r.width / ctx.scale),
            h: Math.round(r.height / ctx.scale),
          });
        }
      }
      visit(node, depth + 1);
    }
  };
  visit(root, 0);
  const out = { design: { ...DESIGN }, center: { x: Math.round(cx), y: Math.round(cy) }, elements };
  (window as { __giAnchorsAll?: unknown }).__giAnchorsAll = out;
  return out;
}

/**
 * 供棋盘内部布局使用的「虚拟尺寸」。
 *
 * web-ui-core 的 layout.ts（getCharacterAreaPos 等）已经是以容器 size 为输入的函数，
 * 因此不必逐元素改绝对坐标：只要把「虚拟宽高」按目标比例换算后喂给它，
 * 角色区、手牌、骰子面板就会按同一套函数重新排布。
 *
 * 规则：高度用设计高 412 缩放后的值（等比），宽度按目标宽高比拉伸，
 * 这样 21:9 会横向拉开、16:9 会收窄，而卡片/角标尺寸仍由 unitInPx 等比缩放。
 */
export function virtualBoardSize(ctx: LayoutContext) {
  const height = DESIGN.height * ctx.scale;
  const width = ctx.vw / Math.max(ctx.scale, 0.0001);
  return { height, width };
}
