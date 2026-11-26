// Copyright (C) 2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import type { DraggingCardInfo } from "./components/Chessboard";

export type Size = [height: number, width: number];
export type Pos = [x: number, y: number];

export function unitInPx() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) / 4;
}

export const PERSPECTIVE = 200;
export const ACTION_OUTLINED_Z = 8;
export const FOCUSING_HANDS_Z = 10;
export const DRAGGING_Z = 12;

export const MINIMUM_WIDTH = 220;
export const MINIMUM_HEIGHT = 99;

const GADGET_HEIGHT = 6;

export const CARD_HEIGHT = 36;
export const CARD_WIDTH = 21;

const CHARACTER_AREA_HEIGHT = CARD_HEIGHT + 3 * GADGET_HEIGHT;
const CHARACTER_AREA_WIDTH = CARD_WIDTH;
const CHARACTER_AREA_GAP = 6;

const TOTAL_CHARACTERS_MAX_WIDTH =
  4 * CHARACTER_AREA_WIDTH + 3 * CHARACTER_AREA_GAP;

const ENTITY_HEIGHT = 19;
const ENTITY_WIDTH = 16;
const ENTITY_GAP = 4.5;
const ENTITY_AREA_HEIGHT = 2 * ENTITY_HEIGHT + ENTITY_GAP;
const ENTITY_AREA_WIDTH = 2 * ENTITY_WIDTH + ENTITY_GAP;

const HAND_CARD_BLURRED_SHOW_HEIGHT = 15;
const HAND_CARD_BLURRED_SHOW_WIDTH = 10;
const OPP_HAND_CARD_RIGHT_OFFSET = 24;

const SKILL_BUTTON_WIDTH = 15;

const HAND_CARD_FOCUSED_GAP = 2;
const HAND_CARD_FOCUSED_SHOW_HEIGHT = 36;
const HAND_CARD_FOCUSED_SHOW_WIDTH_MIN = 15;
const HAND_CARD_FOCUSED_CENTER_X_OFFSET = 0;

const HAND_CARD_HOVERING_Y_OFFSET = 3;
const HAND_CARD_HOVERING_X_OFFSET = 2;

const HAND_CARD_FOCUSING_AREA_HEIGHT_WHEN_DRAGGING = CARD_HEIGHT + 10;

export const SHOWING_CARD_X_MARGIN = 60;

// 锚点模式：按十字中心向四周等比偏移。
// 规则（以 20:9 为基准）：
// - 角色行 / 实体：上下以正中心水平线对称、行间距固定 → 只做 X 方向 spread；
// - 手牌：到界面上下边的距离固定（20:9 值）+ 随容器变高的轻微补偿 → 不做 spread；
// - 牌堆：右缘到界面左边的距离固定为 20:9 经典模式的 102.9px（x 按 px/单位 反算）；
// - 居中元素（换牌展示、调谐区）：全方向 spread。
let boardSpread: Pos = [1, 1];
let boardUnitPx = 0;

export function setBoardSpread(kx: number, ky: number, unitPx: number) {
  boardSpread = [kx, ky];
  boardUnitPx = unitPx;
}

function applySpread([height, width]: Size, pos: Pos): Pos {
  const [kx, ky] = boardSpread;
  if (kx === 1 && ky === 1) {
    return pos;
  }
  const cx = width / 2;
  const cy = height / 2;
  return [cx + (pos[0] - cx) * kx, cy + (pos[1] - cy) * ky];
}

function applySpreadX([height, width]: Size, x: number): number {
  const [kx] = boardSpread;
  if (kx === 1) {
    return x;
  }
  return width / 2 + (x - width / 2) * kx;
}

// 20:9 专用回滚：棋盘盒子高度等于设计高 99 时，或宿主标记了 20:9 时
// （StandaloneParent 在 20:9 视口下置位），布局退回 0.11.121 的原始坐标。
const isClassic20x9 = (height: number) =>
  height <= MINIMUM_HEIGHT + 0.6 ||
  (globalThis as { __GI_CLASSIC_20X9__?: boolean }).__GI_CLASSIC_20X9__ === true;

export function getCharacterAreaPos(
  [height, width]: Size,
  opp: boolean,
  totalCount: number,
  index: number,
  isActive: boolean,
): Pos {
  const halfHeight = height / 2;
  const halfChessboardHeight = MINIMUM_HEIGHT / 2;
  const gapAroundCharacterArea = Math.max(
    -6,
    (halfChessboardHeight -
      CHARACTER_AREA_HEIGHT -
      HAND_CARD_BLURRED_SHOW_HEIGHT) /
      2 +
      1,
  );
  let characterAreaY = opp
    ? halfHeight - gapAroundCharacterArea - CHARACTER_AREA_HEIGHT
    : halfHeight + gapAroundCharacterArea;

  if (isActive === opp) {
    characterAreaY += GADGET_HEIGHT;
  }

  const halfWidth = width / 2;
  const totalCharacterAreaWidth =
    totalCount * CHARACTER_AREA_WIDTH + (totalCount - 1) * CHARACTER_AREA_GAP;
  const totalCharacterAreaX = halfWidth - totalCharacterAreaWidth / 2;
  const characterAreaX =
    totalCharacterAreaX + index * (CHARACTER_AREA_WIDTH + CHARACTER_AREA_GAP);
  // 行位置：上下以正中心对称、间距固定（20:9 基准），只做 X 偏移
  return [applySpreadX([height, width], characterAreaX), characterAreaY];
}

export function getEntityPos(
  [height, width]: Size,
  opp: boolean,
  type: "summon" | "support",
  index: number,
) {
  if (index >= 4) {
    return [999, 999];
  }
  const halfHeight = height / 2;
  const halfWidth = width / 2;
  const halfChessboardHeight = MINIMUM_HEIGHT / 2;
  const gapAroundEntityArea =
    (halfChessboardHeight -
      ENTITY_AREA_HEIGHT -
      HAND_CARD_BLURRED_SHOW_HEIGHT) /
    2;
  const entityAreaY = opp
    ? halfHeight - gapAroundEntityArea - ENTITY_AREA_HEIGHT
    : halfHeight + gapAroundEntityArea;
  const entityAreaX =
    type === "summon"
      ? halfWidth + TOTAL_CHARACTERS_MAX_WIDTH / 2
      : halfWidth - TOTAL_CHARACTERS_MAX_WIDTH / 2 - ENTITY_AREA_WIDTH;
  const x = entityAreaX + (index % 2) * (ENTITY_WIDTH + ENTITY_GAP);
  const y = entityAreaY + Math.floor(index / 2) * (ENTITY_HEIGHT + ENTITY_GAP);
  // 实体区已关于中心对称，只做 X 偏移
  return [applySpreadX([height, width], x), y];
}

export function getHandCardBlurredPos(
  [height, width]: Size,
  opp: boolean,
  showHands: boolean,
  totalCount: number,
  index: number,
  skillCount: number,
): Pos {
  if (isClassic20x9(height)) {
    // 0.11.121 原始布局（20:9 专用）
    if (opp) {
      let y =
        (height - MINIMUM_HEIGHT) / 2 +
        HAND_CARD_BLURRED_SHOW_HEIGHT -
        CARD_HEIGHT -
        8;
      if (!showHands) {
        y = HAND_CARD_BLURRED_SHOW_HEIGHT - CARD_HEIGHT - 2 - CARD_HEIGHT / 2;
      }
      const areaX =
        (width - MINIMUM_WIDTH) / 2 +
        MINIMUM_WIDTH -
        OPP_HAND_CARD_RIGHT_OFFSET -
        totalCount * HAND_CARD_BLURRED_SHOW_WIDTH;
      const x = areaX + index * HAND_CARD_BLURRED_SHOW_WIDTH;
      return [x, y];
    }
    let y =
      (height - MINIMUM_HEIGHT) / 2 +
      MINIMUM_HEIGHT -
      HAND_CARD_BLURRED_SHOW_HEIGHT +
      10;
    if (!showHands) {
      y = height - HAND_CARD_BLURRED_SHOW_HEIGHT + 3 + CARD_HEIGHT / 2;
    }
    const halfWidth = width / 2;
    const totalHandCardWidth =
      (totalCount - 1) * HAND_CARD_BLURRED_SHOW_WIDTH + CARD_WIDTH;
    let areaX = halfWidth - totalHandCardWidth / 2;
    const skillButtonGroupWidth = skillCount * SKILL_BUTTON_WIDTH + 2;
    if (
      areaX + totalHandCardWidth >
      (width - MINIMUM_WIDTH) / 2 + MINIMUM_WIDTH - skillButtonGroupWidth
    ) {
      areaX =
        (width - MINIMUM_WIDTH) / 2 +
        MINIMUM_WIDTH -
        skillButtonGroupWidth -
        totalHandCardWidth;
    }
    const x = areaX + index * HAND_CARD_BLURRED_SHOW_WIDTH;
    return [x, y];
  }
  if (opp) {
    // 对面手牌：底边到屏幕上边的距离 = 20:9 经典模式的 44.8px，
    // 视觉底边 = 锚点 + 34 单位 → 锚点 = 44.8/unitPx − 34
    const strip = boardUnitPx > 0 ? 44.8 / boardUnitPx : 12.3;
    let y = strip - 34;
    if (!showHands) {
      y = HAND_CARD_BLURRED_SHOW_HEIGHT - CARD_HEIGHT - 2 - CARD_HEIGHT / 2;
    }
    const areaX =
      (width - MINIMUM_WIDTH) / 2 +
      MINIMUM_WIDTH -
      OPP_HAND_CARD_RIGHT_OFFSET -
      totalCount * HAND_CARD_BLURRED_SHOW_WIDTH;
    const x = areaX + index * HAND_CARD_BLURRED_SHOW_WIDTH;
    return [applySpreadX([height, width], x), y];
  } else {
    // 己方手牌：顶边到屏幕下边的距离 = 20:9 经典模式的 37.2px，
    // 视觉顶边 = 锚点 + 2 单位 → 锚点 = h − 2 − 37.2/unitPx
    const strip = boardUnitPx > 0 ? 37.2 / boardUnitPx : 10.3;
    let y = height - 2 - strip;
    if (!showHands) {
      y = height - HAND_CARD_BLURRED_SHOW_HEIGHT + 3 + CARD_HEIGHT / 2;
    }
    const halfWidth = width / 2;
    const totalHandCardWidth =
      (totalCount - 1) * HAND_CARD_BLURRED_SHOW_WIDTH + CARD_WIDTH;
    let areaX = halfWidth - totalHandCardWidth / 2;
    const skillButtonGroupWidth = skillCount * SKILL_BUTTON_WIDTH + 2;
    if (
      areaX + totalHandCardWidth >
      (width - MINIMUM_WIDTH) / 2 + MINIMUM_WIDTH - skillButtonGroupWidth
    ) {
      areaX =
        (width - MINIMUM_WIDTH) / 2 +
        MINIMUM_WIDTH -
        skillButtonGroupWidth -
        totalHandCardWidth;
    }
    const x = areaX + index * HAND_CARD_BLURRED_SHOW_WIDTH;
    return [applySpreadX([height, width], x), y];
  }
}

export function getOppHandCardFocusedPos(
  [height, width]: Size,
  totalCount: number,
  index: number,
  hoveringIndex: number | null,
): Pos {
  // 对面聚焦手牌：贴顶边，只做 X 偏移
  const y = index === hoveringIndex ? HAND_CARD_HOVERING_Y_OFFSET : 0;
  const halfWidth = width / 2;
  const cardAreaCenter = halfWidth + HAND_CARD_FOCUSED_CENTER_X_OFFSET;
  const cardAreaMaxWidth = 9 * HAND_CARD_FOCUSED_SHOW_WIDTH_MIN + CARD_WIDTH;
  const realGap = Math.min(
    (cardAreaMaxWidth - CARD_WIDTH) / (totalCount - 1),
    CARD_WIDTH + HAND_CARD_FOCUSED_GAP,
  );
  const cardAreaWidth = realGap * (totalCount - 1) + CARD_WIDTH;
  const cardAreaX = cardAreaCenter - cardAreaWidth / 2;
  let x = cardAreaX + index * realGap;
  if (hoveringIndex === null) {
    return [applySpreadX([height, width], x), y];
  }
  if (index < hoveringIndex) {
    x -= HAND_CARD_HOVERING_X_OFFSET;
  } else if (index > hoveringIndex) {
    x += HAND_CARD_HOVERING_X_OFFSET;
  }
  return [applySpreadX([height, width], x), y];
}

export function getPilePos([height, width]: Size, opp: boolean): Pos {
  const base = (height - MINIMUM_HEIGHT) / 2;
  if (isClassic20x9(height)) {
    // 0.11.121 原始布局（20:9 专用）
    const y = opp
      ? base + MINIMUM_HEIGHT * 0.393
      : base + MINIMUM_HEIGHT * 1.1;
    const x = (width - MINIMUM_WIDTH) / 2 + 24;
    return [x, y];
  }
  // 牌堆：视觉块右缘到界面左边的距离固定 = 20:9 经典模式的 102.9px。
  // 视觉右缘 = 0.8×x×unitPx − 1.75（0.8 为渲染链投影系数），
  // 反解得 x = (102.9+1.75)/(0.8×unitPx) = 130.8/unitPx。
  // 上下镜像：下锚点 base+114.9、上锚点 0.75h-44.4（箱坐标），
  // 两块关于正中心水平线严格镜像，中间竖直距离较 20:9 拉开 6 单位。
  const y = opp ? 0.75 * height - 44.4 : base + MINIMUM_HEIGHT * 1.1 + 6;
  const x = boardUnitPx > 0 ? 130.8 / boardUnitPx : 36;
  return [x, y];
}

export function getHandCardFocusedPos(
  [height, width]: Size,
  totalCount: number,
  index: number,
  hoveringIndex: number | null,
): Pos {
  // 己方聚焦手牌：贴底边（距底 15 单位），只做 X 偏移
  const yBase = height - HAND_CARD_FOCUSED_SHOW_HEIGHT;
  const y = yBase - (index === hoveringIndex ? HAND_CARD_HOVERING_Y_OFFSET : 0);
  const halfWidth = width / 2;
  const cardAreaCenter = halfWidth + HAND_CARD_FOCUSED_CENTER_X_OFFSET;
  const cardAreaMaxWidth = 9 * HAND_CARD_FOCUSED_SHOW_WIDTH_MIN + CARD_WIDTH;
  const realGap = Math.min(
    (cardAreaMaxWidth - CARD_WIDTH) / (totalCount - 1),
    CARD_WIDTH + HAND_CARD_FOCUSED_GAP,
  );
  const cardAreaWidth = realGap * (totalCount - 1) + CARD_WIDTH;
  const cardAreaX = cardAreaCenter - cardAreaWidth / 2;
  let x = cardAreaX + index * realGap;
  if (hoveringIndex === null) {
    return [applySpreadX([height, width], x), y];
  }
  if (index < hoveringIndex) {
    x -= HAND_CARD_HOVERING_X_OFFSET;
  } else if (index > hoveringIndex) {
    x += HAND_CARD_HOVERING_X_OFFSET;
  }
  return [applySpreadX([height, width], x), y];
}

export function shouldFocusHandWhenDragging(
  [height, width]: Size,
  currentY: number,
) {
  return (
    currentY >=
    (height - MINIMUM_HEIGHT) / 2 +
      MINIMUM_HEIGHT -
      HAND_CARD_FOCUSING_AREA_HEIGHT_WHEN_DRAGGING
  );
}

export function getShowingCardPos(
  [height, width]: Size,
  totalCount: number,
  index: number,
): Pos {
  const y = height / 2 - CARD_HEIGHT / 2;
  const gapX =
    (MINIMUM_WIDTH - SHOWING_CARD_X_MARGIN - totalCount * CARD_WIDTH) /
    (totalCount + 1);
  const xStart = (width - MINIMUM_WIDTH + SHOWING_CARD_X_MARGIN) / 2 + gapX;
  const x = xStart + index * (CARD_WIDTH + gapX);
  return applySpread([height, width], [x, y]);
}

export function getPileHintPos(size: Size, opp: boolean) {
  const [height] = size;
  const [x] = getPilePos(size, opp);
  const base = (height - MINIMUM_HEIGHT) / 2;
  // 骰子数固定在牌堆与圆盘之间
  // 调试器实测偏移（视口 853x384）：上牌堆数量 (-4px, +10px)，下牌堆数量 (-4px, +75px)
  return {
    x: x - 10.5 - 1,
    y:
      base +
      (opp ? MINIMUM_HEIGHT * 0.21 : MINIMUM_HEIGHT * 0.61) -
      5.7 +
      (opp ? 2.6 : 19.3),
  };
}

export function getHandHintPos(
  size: Size,
  opp: boolean,
  value: number,
  focused: boolean,
) {
  if (opp) {
    if (focused) {
      const [x, y] = getOppHandCardFocusedPos(size, value, value - 1, null);
      return {
        x: x + CARD_WIDTH - 9,
        y: y + CARD_HEIGHT + 1,
      };
    }
    const [x, y] = getHandCardBlurredPos(size, true, true, value, value - 1, 0);
    return {
      x: x - 9,
      y: y + CARD_HEIGHT + 1,
    };
  } else {
    const [x, y] = getHandCardFocusedPos(size, value, value - 1, null);
    return {
      x: x + CARD_WIDTH - 9,
      y: y - 10,
    };
  }
}

export const TUNNING_AREA_INSET = 25;

export function getTuningAreaPos(
  [height, width]: Size,
  draggingHand: DraggingCardInfo | null,
) {
  const tangent = MINIMUM_WIDTH / 2 / PERSPECTIVE;
  let x = (width - MINIMUM_WIDTH) / 2 + MINIMUM_WIDTH - DRAGGING_Z * tangent;
  if (draggingHand?.status === "moving" && draggingHand.tuneStep) {
    x -= TUNNING_AREA_INSET;
  }
  return applySpread([height, width], [x, 0]);
}
