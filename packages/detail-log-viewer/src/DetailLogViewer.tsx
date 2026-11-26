// Copyright (C) 2024-2025 Guyutongxue
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

import type { DetailLogEntry, DetailLogType } from "@gi-tcg/core";
import { For, Show, createEffect, createSignal } from "solid-js";
import styles from "./style.css?inline";
import { getNameSync } from "@gi-tcg/assets-manager";

export interface DetailLogEntryProps {
  log: DetailLogEntry;
  topIndex?: number;
  onSeek?: (index: number) => void;
}

export function DetailLogEntry(props: DetailLogEntryProps) {
  const [open, setOpen] = createSignal(false);
  const toggleOpen = () => setOpen(!open());
  const color = () => {
    switch (props.log.type) {
      case "event":
        return "darkgreen";
      case "skill":
        return "darkred";
      case "primitive":
        return "black";
      case "mutation":
        return "lightblue";
      case "phase":
        return "rebeccapurple";
      default:
        return "gray";
    }
  };

  const translateLog = (value: string) => {
    const PHASE_NAMES: Record<string, string> = {
      initHands: "开局换牌",
      initActives: "选择出战",
      roll: "投掷",
      action: "行动",
      end: "结束",
      gameEnd: "对局结束",
    };
    const FLAG_NAMES: Record<string, string> = {
      declaredEnd: "宣布结束",
    };
    let out = value;
    out = out.replace(
      /In (\w+) phase \(round (\d+)(?:, turn (\d+))?\):/g,
      (_, phase: string, round: string, turn?: string) => {
        const name = PHASE_NAMES[phase] ?? phase;
        const turnText = turn !== undefined ? ` · 第 ${turn} 行动` : "";
        return `第 ${round} 回合 · ${name}阶段${turnText}：`;
      },
    );
    out = out.replace(
      /Change phase to (\w+)/g,
      (_, phase: string) => `切换到${PHASE_NAMES[phase] ?? phase}阶段`,
    );
    out = out.replace(
      /Set player (\d) flag (\w+) to (true|false)/g,
      (_, who: string, flag: string, val: string) =>
        `玩家${Number(who) + 1} 的「${FLAG_NAMES[flag] ?? flag}」设为${val === "true" ? "是" : "否"}`,
    );
    out = out.replace(/Handling event (\w+) \(\)/g, (_, ev: string) => `处理事件 ${ev}`);
    out = out.replace(/Set player (\d) (\w+) to (\w+)/g, (_, who: string, key: string, val: string) => `玩家${Number(who) + 1} 的 ${key} 设为 ${val}`);
    // 抽牌 / 换人这类高频动作写成人话
    const cardName = (id: number) => getNameSync?.("CHS", id) ?? `#${id}`;
    out = out.replace(
      /Move entity \[(\w+):(\d+)\]\([^)]*\) to hands of player (\d) \(index: end\) because draw/g,
      (_, _type: string, id: string, who: string) =>
        `玩家${Number(who) + 1} 抽到「${cardName(Number(id))}」`,
    );
    out = out.replace(
      /Handling event onHandCardInserted \(player (\d) draw card \[(\w+):(\d+)\][^)]*\):/g,
      (_, who: string, _type: string, id: string) =>
        `玩家${Number(who) + 1} 抽到「${cardName(Number(id))}」`,
    );
    out = out.replace(
      /Switch active of player (\d) to \[character:(\d+)\][^)]*\)?/g,
      (_, who: string, id: string) =>
        `玩家${Number(who) + 1} 切换到「${cardName(Number(id))}」`,
    );
    out = out.replace(
      /Switch active from \(null\) to \[character:(\d+)\][^)]*\)?/g,
      (_, id: string) => `登场「${cardName(Number(id))}」`,
    );
    out = out.replace(
      /Set player (\d) plunging status to (\d+)/g,
      (_, who: string, val: string) => `玩家${Number(who) + 1} 下落攻击状态 = ${val}`,
    );
    out = out.replace(
      /Handling event (on\w+)/g,
      (_, ev: string) => `触发 ${ev}`,
    );
    out = out.replace(/Move entity /g, "移动实体 ");
    out = out.replace(/Damage /g, "伤害 ");
    out = out.replace(/Create /g, "创建 ");
    out = out.replace(/Remove /g, "移除 ");
    out = out.replace(/Transfer /g, "转移 ");
    return out;
  };

  const text = () => {
    const reg = /\[(\w+?):([\d.]+?)\]/g;
    return translateLog(props.log.value).replaceAll(reg, (origStr, type, idStr): string => {
      const id = Number(idStr);
      switch (type) {
        case "dice":
          return (
            ["无色", "冰", "水", "火", "雷", "风", "岩", "草", "万能", "充能"][
              id
            ] ?? origStr
          );
        case "aura":
          if (id > 16) return "冰草";
          else
            return (
              ["空", "冰", "水", "火", "雷", "风", "岩", "草"][id] ?? origStr
            );
        case "damage":
          return (
            [
              "物理",
              "冰",
              "水",
              "火",
              "雷",
              "风",
              "岩",
              "草",
              "穿透",
              "治疗",
              "复活治疗",
            ][id] ?? origStr
          );
        default: {
          const rid = Math.floor(id);
          let result = getNameSync?.("CHS", rid);
          if (result) {
            if (rid !== id) {
              result += "的响应技能";
            }
            return result;
          } else {
            return origStr;
          }
        }
      }
    });
  };
  return (
    <div class="detail-log">
      <div class="detail-log__parent">
        <Show
          when={props.log.children?.length}
          fallback={<div class="detail-log__toggle-placeholder" />}
        >
          <button class="detail-log__toggle-button" onClick={toggleOpen}>
            {open() ? "-" : "+"}
          </button>
        </Show>
        <span
          class="detail-log__text"
          style={{ color: color(), cursor: props.onSeek ? "pointer" : undefined }}
          onClick={() => {
            if (props.onSeek && props.topIndex !== undefined) {
              props.onSeek(props.topIndex);
            }
          }}
        >
          {text()}
        </span>
      </div>
      <div class="detail-log__children">
        <Show when={open()}>
          <For each={props.log.children}>
            {(child) => (
              <DetailLogEntry
                log={child}
                topIndex={props.topIndex}
                onSeek={props.onSeek}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

export function DetailLogViewer(props: DetailLogViewer.Props) {
  return (
    <div>
      <style>{styles}</style>
      <For each={props.logs}>
        {(log, index) => (
          <DetailLogEntry
            log={log}
            topIndex={index()}
            onSeek={props.onSeek}
          />
        )}
      </For>
    </div>
  );
}

export declare namespace DetailLogViewer {
  export interface Props {
    logs: readonly DetailLogEntry[];
    names?: (id: number) => string;
    /** 点击某条日志时跳到对应回放帧 */
    onSeek?: (index: number) => void;
  }
}
