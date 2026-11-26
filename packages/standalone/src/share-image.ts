// 牌组分享图（实验室同款样式），供 lab 与牌组库共用
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { saveImageFile } from "./native";

export interface ShareImageDeck {
  characters: number[];
  cards: number[];
}

export interface ShareImageOptions {
  /** 「版本 7.2.0」下面的副标题，如"胜率 53.9% · 15 局" */
  note?: string;
  /** 牌组码：单独占一行（不写"牌组码"字样），太长自动折行 */
  code?: string;
}

const S = 2;

const imageUrl = (id: number) =>
  DEFAULT_ASSETS_MANAGER.getImageUrlSync(id, { type: "cardFace", thumbnail: false });

export const loadShareImage = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

function roundRectPath(
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const targetRatio = w / h;
  const srcRatio = img.width / img.height;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (srcRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawCardImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = "#e2c68b";
  ctx.fill();
  ctx.clip();
  if (img) {
    const scale = 1.04;
    const dw = w * scale;
    const dh = h * scale;
    drawCover(ctx, img, x - (dw - w) / 2, y - (dh - h) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#ddd2b8";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = "#c8a86a";
  ctx.lineWidth = 4;
  roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(4, radius - 2));
  ctx.stroke();
}

/** 画一张与实验室一致的牌组分享图 */
export async function renderDeckShareImage(
  deck: ShareImageDeck,
  options: ShareImageOptions = {},
): Promise<HTMLCanvasElement> {
  const M = 60;
  const W = 1080;
  // 头部：版本号单独一行，胜率/局数换行显示，太长就折行
  const wrapText = (text: string, perLine: number) => {
    const parts = text.split("·").map((part) => part.trim()).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const part of parts) {
      const piece = current ? `${current} · ${part}` : part;
      if (piece.length > perLine && current) {
        lines.push(current);
        current = part;
      } else {
        current = piece;
      }
    }
    if (current) {
      lines.push(current);
    }
    return lines.length > 0 ? lines : [text];
  };
  // 牌组码固定长度、画布宽度固定：整串压成一行，字号按宽度自适应
  const rawCode = (options.code ?? "").trim();
  const codeLines: string[] = rawCode ? [rawCode] : [];
  const codeFontSize = rawCode
    ? Math.max(14, Math.min(26, Math.floor((W - M * 2) / Math.max(1, rawCode.length * 0.6))))
    : 24;
  // 按文字的「视觉边缘」排布：牌组码底边 y=245，版本-牌组码间距 15，标题-版本间距 20
  const measure = document.createElement("canvas").getContext("2d")!;
  const metricsOf = (text: string, font: string) => {
    measure.font = font;
    const m = measure.measureText(text);
    return {
      ascent: m.actualBoundingBoxAscent || 0,
      descent: m.actualBoundingBoxDescent || 0,
    };
  };
  const codeFont = `${codeFontSize}px ui-monospace, Menlo, Consolas, monospace`;
  const versionFont = "30px system-ui, sans-serif";
  const titleFont = "bold 54px system-ui, sans-serif";
  const codeMetrics = metricsOf(rawCode || "A", codeFont);
  const versionMetrics = metricsOf("版本 7.2.0", versionFont);
  const titleMetrics = metricsOf("七圣召唤 · 牌组图", titleFont);
  const codeStartY = 265 - codeMetrics.descent; // 牌组码底边 245
  // 实测渲染边缘会多出约 4px（字形抗锯齿/度量偏差），这里补偿
  const versionY = codeStartY - codeMetrics.ascent - 11 - versionMetrics.descent;
  const titleY = versionY - versionMetrics.ascent - 16 - titleMetrics.descent;
  const codeLineH = 30;
  // 与牌组码再靠近 20px
  const dividerY = 265 + 4;
  const sectionTitleY = dividerY + 64;
  const headerH = sectionTitleY + 32;
  const charCardW = 280;
  const charCardH = Math.round((charCardW * 36) / 21);
  const charsH = charCardH + 30;
  const gridTitleH = 60;
  const colGap = 22;
  const rowGap = 22;
  const gridW = W - M * 2;
  // 5 张牌横向铺满内容区：左右留白以右侧为准后完全相等
  const cardW = Math.floor((gridW - colGap * 4) / 5);
  const cardH = Math.round((cardW * 36) / 21);
  const rows = Math.max(1, Math.ceil(deck.cards.length / 5));
  const gridH = rows * cardH + (rows - 1) * rowGap;
  const gridTop = headerH + charsH;
  const gridBottom = gridTop + 66 + gridH;
  // 底部：卡牌 → 生成信息 52px，生成信息 → 边框 24px
  const footerY = gridBottom + 52;
  const H = footerY + 44;

  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(S, S);
  ctx.fillStyle = "#f7f2e6";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#d8c9a6";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  ctx.fillStyle = "#3b3226";
  ctx.textAlign = "left";
  ctx.font = titleFont;
  ctx.fillText("七圣召唤 · 牌组图", M, titleY);
  ctx.font = versionFont;
  ctx.fillStyle = "#7a6a50";
  ctx.fillText("版本 7.2.0", M, versionY);
  ctx.font = `${codeFontSize}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillStyle = "#8a7658";
  codeLines.forEach((line, index) => {
    ctx.fillText(line, M, codeStartY + index * codeLineH);
  });
  ctx.fillStyle = "#4a3f2e";
  ctx.fillRect(M, dividerY, W - M * 2, 2);

  ctx.fillStyle = "#3b3226";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText("出战角色牌", M, sectionTitleY);
  // 三张角色牌横向铺满行动牌网格的宽度：最右一张的右边缘与网格右边缘对齐
  const chars = deck.characters.slice(0, 3);
  const charGap =
    chars.length > 1 ? Math.max(30, (gridW - chars.length * charCardW) / (chars.length - 1)) : 0;
  let x = M;
  for (const id of chars) {
    const img = await loadShareImage(imageUrl(id));
    drawCardImage(ctx, img, x, headerH, charCardW, charCardH, 26);
    x += charCardW + charGap;
  }

  ctx.fillStyle = "#3b3226";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText("出战行动牌", M, gridTop + 44);

  let cx = M;
  let cy = gridTop + 66;
  for (const [index, id] of deck.cards.entries()) {
    if (index > 0 && index % 5 === 0) {
      cx = M;
      cy += cardH + rowGap;
    }
    const img = await loadShareImage(imageUrl(id));
    drawCardImage(ctx, img, cx, cy, cardW, cardH, 14);
    cx += cardW + colGap;
  }

  ctx.fillStyle = "#8a7a5e";
  ctx.font = "26px system-ui, sans-serif";
  // 与最后一行卡牌的间距缩小到现在的一半
  ctx.fillText("由七圣召唤工具生成 · DSH-Go", M, footerY);

  return canvas;
}

const QUALITY_KEY = "gitcg.shareQuality";

/** 牌组图画质开关：true = 无损 PNG；false = 压缩 JPG（1MB 以内），默认关闭 */
export function getShareLossless(): boolean {
  return globalThis.localStorage?.getItem(QUALITY_KEY) === "lossless";
}

export function setShareLossless(lossless: boolean) {
  globalThis.localStorage?.setItem(QUALITY_KEY, lossless ? "lossless" : "compact");
}

/**
 * 两种固定输出（不做降档尝试）：
 * - 默认：缩到 65% 再 JPEG q0.82，2160×5716 → 1404×3715，约 0.85MB
 * - 无损：原尺寸 PNG，约 10.5MB（最早那版实现）
 */
export function encodeShareImage(canvas: HTMLCanvasElement): string {
  if (getShareLossless()) {
    return canvas.toDataURL("image/png");
  }
  const scaled = document.createElement("canvas");
  scaled.width = Math.round(canvas.width * 0.65);
  scaled.height = Math.round(canvas.height * 0.65);
  const ctx = scaled.getContext("2d");
  if (!ctx) {
    return canvas.toDataURL("image/jpeg", 0.82);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  return scaled.toDataURL("image/jpeg", 0.82);
}

/** dataURL 对应的文件扩展名 */
export function shareImageExt(dataUrl: string) {
  return dataUrl.startsWith("data:image/png") ? "png" : "jpg";
}

/** 保存分享图：优先走安卓壳，其次浏览器下载 */

export function saveShareImage(canvas: HTMLCanvasElement, fileName: string) {
  const dataUrl = encodeShareImage(canvas);
  const name = `${fileName.replace(/\.(png|jpe?g|webp)$/i, "")}.${shareImageExt(dataUrl)}`;
  const base64 = dataUrl.split(",")[1];
  if (saveImageFile(name, base64, "牌组图")) {
    return "saved";
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name;
  link.click();
  return "downloaded";
}
