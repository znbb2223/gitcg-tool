import { For, Show } from "solid-js";
import {
  BooleanField,
  NumberField,
  SectionTitle,
  SelectField,
  Surface,
} from "./Fields";
import { useStateEditorContext } from "./GameStateEditor";
import { PHASE_LABELS } from "../constants";
import type {
  GameState,
  InsufficientDiceBehavior,
  PhaseType,
} from "@gi-tcg/core";
import { ExtensionModal } from "./ExtensionModal";
import { ListItem, type ListItemButton } from "./ListItem";

export interface GlobalSectionProps {
  initialState: GameState;
}

/** 扩展状态压成一行摘要，方便一眼看出当前计数 */
function summarizeExtensionState(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return String(value);
  }
  const text = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      if (Array.isArray(item)) {
        return `${key} [${item.map((v) => String(v)).join("/")}]`;
      }
      return `${key} ${String(item)}`;
    })
    .join(" · ");
  return text.length > 64 ? `${text.slice(0, 62)}…` : text;
}

export function GlobalSection(props: GlobalSectionProps) {
  const { gameState: state, updateState, openModal } = useStateEditorContext();
  return (
    <Surface title="游戏全局设置">
      <div class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="随机种子"
            value={state().config.randomSeed}
            onChange={(value) =>
              updateState((draft) => {
                draft.config.randomSeed = value;
                draft.iterators.random = value;
              })
            }
          />
          <SelectField
            label="阶段"
            value={state().phase}
            options={Object.entries(PHASE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(value) =>
              updateState((draft) => {
                draft.phase = value as PhaseType;
              })
            }
          />
          <NumberField
            label="回合数"
            value={state().roundNumber}
            min={1}
            max={state().config.maxRoundsCount - 1}
            onChange={(value) =>
              updateState((draft) => {
                draft.roundNumber = value;
              })
            }
          />
          <SelectField
            label="当前行动方"
            value={state().currentTurn}
            options={[
              { value: 0, label: "玩家 0" },
              { value: 1, label: "玩家 1" },
            ]}
            onChange={(value) =>
              updateState((draft) => {
                draft.currentTurn = Number(value) as 0 | 1;
              })
            }
          />
        </div>

        <div class="rounded-3xl border border-white/10 bg-slate-950/20 p-4">
          <SectionTitle title="结算配置" />
          <div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="骰子意外消耗"
              value={state().config.unexpectedInsufficientDice}
              options={[
                { value: "throw", label: "报错并退出对局" },
                { value: "skipConsume", label: "跳过消耗，继续行动" },
                { value: "skipAction", label: "跳过消耗和行动" },
              ]}
              onChange={(value) =>
                updateState((draft) => {
                  draft.config.unexpectedInsufficientDice =
                    value as InsufficientDiceBehavior;
                })
              }
            />
            <BooleanField
              label="启用房主相关结算"
              value={state().config.hostRelatedExecution}
              onChange={(value) =>
                updateState((draft) => {
                  draft.config.hostRelatedExecution = value;
                })
              }
            />
            <Show when={state().config.hostRelatedExecution}>
              <SelectField
                label="房主"
                value={state().config.hostWho}
                options={[
                  { value: 0, label: "玩家 0" },
                  { value: 1, label: "玩家 1" },
                ]}
                onChange={(value) =>
                  updateState((draft) => {
                    draft.config.hostWho = Number(value) as 0 | 1;
                  })
                }
              />
            </Show>
          </div>
        </div>

        <div class="rounded-3xl border border-white/10 bg-slate-950/20 p-4">
          <SectionTitle title="固定信息" />
          <div class="mt-3 space-y-2 text-sm text-slate-200">
            <p>
              数据版本：
              {state().data === props.initialState.data
                ? "最新官方数据"
                : "传入初始值"}
            </p>
            <p>下一个状态 ID：{state().iterators.id}</p>
          </div>
        </div>

        <div class="rounded-3xl border border-white/10 bg-slate-950/20 p-4">
          <SectionTitle
            title="隐藏计数（扩展）"
            description="规则引擎给部分卡牌留的“记忆槽”，记录本局发生过的事（打出过哪些行动牌、弃置了多少支援…）。不是卡牌、不能增删，一般不用改；只有要复现某张牌的触发条件时才需要编辑。"
          />
          <div class="mt-3 space-y-2">
            <For each={state().extensions}>
              {(extension, index) => {
                const name =
                  extension.definition.description?.trim() ||
                  `扩展 #${extension.definition.id}`;
                const buttons: ListItemButton[] = [
                  {
                    content: "编辑",
                    variant: "primary",
                    col: 0,
                    onClick: () => {
                      openModal(() => <ExtensionModal index={index()} />);
                    },
                  },
                ];
                return (
                  <ListItem
                    title={name}
                    description={`#${extension.definition.id} · 当前 ${summarizeExtensionState(
                      extension.state,
                    )}`}
                    buttonColumns={1}
                    buttons={buttons}
                  />
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </Surface>
  );
}
