// Copyright (C) 2025 Guyutongxue
// Copyright (C) 2026 Piovium Labs
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

import {
  children,
  createEffect,
  onCleanup,
  onSettled,
  untrack,
  type Setter,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { MINIMUM_HEIGHT, MINIMUM_WIDTH, setBoardSpread, unitInPx } from "../layout";
import { funnel } from "remeda";

export type Rotation = 0 | 90 | 180 | 270;
export interface TransformWrapperProps {
  /**
   * 控制棋盘缩放。当 ```hasOppChessboard=true``` 时，棋盘内容将缩小一定比例以容纳更多元素。
   */
  hasOppChessboard: boolean;
  class?: string;
  autoHeight?: boolean;
  rotation?: Rotation;
  isFullscreen?: boolean;
  children: JSX.Element;
  setTransformScale: Setter<number>;
  /** 整体内容缩放（相对容器），用于让棋盘元素在小屏上显得更小 */
  contentScale?: number;
  /**
   * 锚点偏移模式：元素位置按十字中心向四周等比偏移（尺寸仍等比不变形），
   * 由 layout.ts 的 setBoardSpread 实现；仅旋转 0（单人棋盘）有意义。
   */
  spread?: boolean;
}

const PRE_ROTATION_TRANSFORM = "translate(-50%, -50%)";
const POST_ROTATION_TRANSFORM = {
  0: "translate(50%, 50%)",
  90: "translate(50%, -50%)",
  180: "translate(-50%, -50%)",
  270: "translate(-50%, 50%)",
};
export const MERGE_CHESSBOARD_SCALE = 0.875;

export function TransformWrapper(props: TransformWrapperProps) {
  let transformWrapperEl!: HTMLDivElement;

  const onContainerResize = () => {
    const containerEl = transformWrapperEl.parentElement!;
    const containerWidth = containerEl.clientWidth;
    let containerHeight = containerEl.clientHeight;
    const autoHeight = untrack(() => props.autoHeight) ?? true;
    const rotate = untrack(() => props.rotation) ?? 0;
    const isFullscreen = untrack(() => props.isFullscreen) ?? false;
    const spreadEnabled = untrack(() => props.spread) ?? false;
    const mergeScale = untrack(() => props.hasOppChessboard) ? MERGE_CHESSBOARD_SCALE : 1;
    const contentScale = untrack(() => props.contentScale) ?? 1;
    const UNIT = unitInPx();
    let height: number;
    let width: number;
    let scale: number;
    const DEFAULT_HEIGHT_WIDTH_RATIO = MINIMUM_HEIGHT / MINIMUM_WIDTH;
    if (rotate % 180 === 0) {
      if (autoHeight && !isFullscreen && !spreadEnabled) {
        containerHeight = 0.9 * DEFAULT_HEIGHT_WIDTH_RATIO * containerWidth;
        containerEl.style.height = `${containerHeight}px`;
      }
      scale = Math.min(
        containerHeight / (UNIT * MINIMUM_HEIGHT),
        containerWidth / (UNIT * MINIMUM_WIDTH),
      ) * contentScale;
      height = containerHeight / (scale * mergeScale);
      width = containerWidth / (scale * mergeScale);
    } else {
      if (autoHeight && !isFullscreen) {
        containerHeight = containerWidth / DEFAULT_HEIGHT_WIDTH_RATIO;
        containerEl.style.height = `${containerHeight}px`;
      }
      scale = Math.min(
        containerHeight / (UNIT * MINIMUM_WIDTH),
        containerWidth / (UNIT * MINIMUM_HEIGHT),
      );
      height = containerWidth / (scale * mergeScale);
      width = containerHeight / (scale * mergeScale);
    }
    transformWrapperEl.style.setProperty(
      "--chessboard-merge-scale",
      `${mergeScale}`,
    );
    if (spreadEnabled) {
      // 锚点偏移：kx/ky = 容器与 20:9 设计基准（220×99）在各轴的比值，
      // 除以统一缩放后即各轴相对设计的拉伸倍率；unitPx 供贴边元素换算。
      const scaleX = containerWidth / (UNIT * MINIMUM_WIDTH);
      const scaleY = containerHeight / (UNIT * MINIMUM_HEIGHT);
      const uniformScale = Math.min(scaleX, scaleY);
      setBoardSpread(
        scaleX / uniformScale,
        scaleY / uniformScale,
        UNIT * scale * mergeScale,
      );
    } else {
      setBoardSpread(1, 1, UNIT * scale * mergeScale);
    }
    if (rotate === 0) {
      // 以自身左上角为原点，显式平移到容器中心，避免百分比 translate 与
      // 外部容器尺寸互相打架导致内容偏移/被裁。
      transformWrapperEl.style.transformOrigin = "0 0";
      transformWrapperEl.style.transform = `translate(${(containerWidth - width * scale * mergeScale) / 2}px, ${(containerHeight - height * scale * mergeScale) / 2}px) scale(${scale * mergeScale})`;
    } else {
      transformWrapperEl.style.transformOrigin = "";
      transformWrapperEl.style.transform = `${PRE_ROTATION_TRANSFORM} 
      scale(${scale * mergeScale}) rotate(${rotate}deg) 
      ${POST_ROTATION_TRANSFORM[rotate]}`;
    }
    transformWrapperEl.style.height = `${height}px`;
    transformWrapperEl.style.width = `${width}px`;
    untrack(() => props.setTransformScale)(scale * mergeScale);
  };

  const onContainerResizeDebouncer = funnel(onContainerResize, {
    minQuietPeriodMs: 200,
  });
  const containerResizeObserver = new ResizeObserver(
    onContainerResizeDebouncer.call,
  );
  onSettled(() => {
    onContainerResize();
    containerResizeObserver.observe(transformWrapperEl.parentElement!);
  });
  createEffect(
    () => [
      props.hasOppChessboard,
      props.autoHeight,
      props.rotation,
      props.isFullscreen,
      props.spread,
    ],
    () => {
      onContainerResizeDebouncer.call();
    },
  );
  onCleanup(() => {
    containerResizeObserver.disconnect();
  });

  const inner = children(() => props.children);
  return (
    <div
      class={["transform-origin-center", props.class]}
      ref={transformWrapperEl}
    >
      {inner()}
    </div>
  );
}
