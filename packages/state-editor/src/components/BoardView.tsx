import { For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { CharacterState, GameState } from "@gi-tcg/core";
import { isShallowEqual } from "remeda";
import type { EditorSection } from "../types";
import { getPlayer } from "../state/common";
import { getDefinitionName } from "../state/catalog";
import { getImageUrl } from "../state/assets";
import { PHASE_LABELS } from "../constants";
import { DiceIcon } from "./DiceIcon";

export interface BoardViewProps {
  state: GameState;
  selected: EditorSection;
  onSelect: (section: EditorSection) => void;
}

const playerLabel = (who: 0 | 1) => (who === 0 ? "我方" : "对手");

type CardLike = { definition: { id: number; type: string } };

function Zone(props: {
  area: string;
  label: string;
  meta?: string;
  active?: boolean;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      class="gi-zone"
      data-area={props.area}
      data-active={props.active ? "true" : undefined}
      onClick={() => props.onClick()}
    >
      <span class="gi-zone-label">
        <span class="gi-zone-name">{props.label}</span>
        <Show when={props.meta}>
          <em>{props.meta}</em>
        </Show>
      </span>
      <span class="gi-zone-body">{props.children}</span>
    </button>
  );
}

function CharTile(props: {
  character: CharacterState | null;
  activeCharacter: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class="gi-char"
      data-selected={props.selected ? "true" : undefined}
      onClick={() => props.onClick()}
    >
      <Show
        when={props.character}
        fallback={<span class="gi-char-empty">空位</span>}
      >
        {(char) => (
          <>
            <span class="gi-char-art">
              <img
                src={getImageUrl(char().definition, "card")}
                alt=""
                loading="lazy"
              />
            </span>
            <span class="gi-char-info">
              <span class="gi-char-name">
                {getDefinitionName(char().definition)}
              </span>
              <span class="gi-char-stats">
                <span class="gi-hp">{char().variables.health}</span>
                <span class="gi-energy">
                  {char().variables.energy}/{char().variables.maxEnergy}
                </span>
              </span>
            </span>
            <Show when={props.activeCharacter}>
              <span class="gi-char-tag">出战</span>
            </Show>
          </>
        )}
      </Show>
    </button>
  );
}

function Thumbs(props: { items: readonly CardLike[]; limit?: number }) {
  const shown = () => props.items.slice(0, props.limit ?? 6);
  return (
    <span class="gi-thumbs">
      <For each={shown()}>
        {(item) => (
          <img
            class="gi-thumb"
            src={getImageUrl(item.definition, "card")}
            alt=""
            loading="lazy"
          />
        )}
      </For>
      <Show when={props.items.length === 0}>
        <span class="gi-empty">空</span>
      </Show>
      <Show when={props.items.length > shown().length}>
        <span class="gi-more">+{props.items.length - shown().length}</span>
      </Show>
    </span>
  );
}

function PlayerPanel(props: BoardViewProps & { who: 0 | 1 }) {
  const player = () => getPlayer(props.state, props.who);
  const isActive = (section: EditorSection) =>
    isShallowEqual(props.selected, section);

  return (
    <section class="gi-player" data-who={props.who}>
      <header class="gi-player-head">
        <span class="gi-player-name">
          {playerLabel(props.who)}
          <em>玩家 {props.who}</em>
        </span>
        <span class="gi-player-chips">
          <Show when={player().declaredEnd}>
            <span class="gi-chip">已结束</span>
          </Show>
          <Show when={player().hasDefeated}>
            <span class="gi-chip" data-tone="bad">
              有击倒
            </span>
          </Show>
          <Show when={!player().legendUsed}>
            <span class="gi-chip" data-tone="legend">
              秘传未用
            </span>
          </Show>
        </span>
        <button
          type="button"
          class="gi-dice"
          data-active={isActive({ kind: "dice", who: props.who }) ? "true" : undefined}
          onClick={() => props.onSelect({ kind: "dice", who: props.who })}
        >
          <span class="gi-dice-icons">
            <For each={player().dice.slice(0, 4)}>
              {(dice) => (
                <span class="gi-dice-icon">
                  <DiceIcon type={dice} />
                </span>
              )}
            </For>
          </span>
          <span class="gi-dice-count">{player().dice.length}</span>
          <span class="gi-dice-label">骰子</span>
        </button>
      </header>

      <div class="gi-player-grid">
        <div class="gi-zone gi-zone--chars" data-area="chars">
          <span class="gi-zone-label">
            <span class="gi-zone-name">角色</span>
          </span>
          <span class="gi-chars">
            <For each={[0, 1, 2] as const}>
              {(index) => (
                <CharTile
                  character={player().characters[index] ?? null}
                  activeCharacter={
                    player().activeCharacterId ===
                    player().characters[index]?.id
                  }
                  selected={isActive({
                    kind: "character",
                    who: props.who,
                    characterIndex: index,
                  })}
                  onClick={() =>
                    props.onSelect({
                      kind: "character",
                      who: props.who,
                      characterIndex: index,
                    })
                  }
                />
              )}
            </For>
          </span>
        </div>

        <Zone
          area="hands"
          label="手牌"
          meta={`${player().hands.length}/${props.state.config.maxHandsCount}`}
          active={isActive({ kind: "hands", who: props.who })}
          onClick={() => props.onSelect({ kind: "hands", who: props.who })}
        >
          <Thumbs items={player().hands} limit={8} />
        </Zone>

        <Zone
          area="supports"
          label="支援"
          meta={`${player().supports.length}/${props.state.config.maxSupportsCount}`}
          active={isActive({ kind: "supports", who: props.who })}
          onClick={() => props.onSelect({ kind: "supports", who: props.who })}
        >
          <Thumbs items={player().supports} limit={3} />
        </Zone>

        <Zone
          area="summons"
          label="召唤"
          meta={`${player().summons.length}/${props.state.config.maxSummonsCount}`}
          active={isActive({ kind: "summons", who: props.who })}
          onClick={() => props.onSelect({ kind: "summons", who: props.who })}
        >
          <Thumbs items={player().summons} limit={3} />
        </Zone>

        <Zone
          area="combat"
          label="出战状态"
          meta={`${player().combatStatuses.length}`}
          active={isActive({ kind: "combatStatuses", who: props.who })}
          onClick={() =>
            props.onSelect({ kind: "combatStatuses", who: props.who })
          }
        >
          <span class="gi-icons">
            <For each={player().combatStatuses.slice(0, 5)}>
              {(item) => (
                <img
                  class="gi-icon"
                  src={getImageUrl(item.definition, "icon")}
                  alt=""
                  loading="lazy"
                />
              )}
            </For>
            <Show when={player().combatStatuses.length === 0}>
              <span class="gi-empty">无</span>
            </Show>
          </span>
        </Zone>

        <Zone
          area="pile"
          label="牌库"
          meta={`${player().pile.length}/${props.state.config.maxPileCount}`}
          active={isActive({ kind: "pile", who: props.who })}
          onClick={() => props.onSelect({ kind: "pile", who: props.who })}
        >
          <span class="gi-pile">
            <span class="gi-bar">
              <span
                class="gi-bar-fill"
                style={{
                  width: `${Math.min((player().pile.length / props.state.config.maxPileCount) * 100, 100)}%`,
                }}
              />
            </span>
            <span class="gi-pile-note">剩余 {player().pile.length} 张</span>
          </span>
        </Zone>

        <Zone
          area="info"
          label="玩家信息"
          active={isActive({ kind: "playerInfo", who: props.who })}
          onClick={() => props.onSelect({ kind: "playerInfo", who: props.who })}
        >
          <span class="gi-info">
            <span class="gi-info-num">{player().roundSkillLog.size}</span>
            <span class="gi-info-label">技能记录</span>
          </span>
        </Zone>

        <Zone
          area="import"
          label="牌组导入"
          active={isActive({ kind: "deckImport", who: props.who })}
          onClick={() => props.onSelect({ kind: "deckImport", who: props.who })}
        >
          <span class="gi-import">
            <span class="gi-import-main">导入牌组码</span>
            <span class="gi-import-hint">一键铺满牌库</span>
          </span>
        </Zone>
      </div>
    </section>
  );
}

export function BoardView(props: BoardViewProps) {
  return (
    <div class="gi-board">
      <button
        type="button"
        class="gi-global"
        data-active={
          isShallowEqual(props.selected, { kind: "global" }) ? "true" : undefined
        }
        onClick={() => props.onSelect({ kind: "global" })}
      >
        <span class="gi-global-round">第 {props.state.roundNumber} 回合</span>
        <Show when={PHASE_LABELS[props.state.phase]}>
          <span class="gi-global-phase">{PHASE_LABELS[props.state.phase]}</span>
        </Show>
        <span class="gi-global-turn">
          轮到 {playerLabel(props.state.currentTurn as 0 | 1)} 行动
        </span>
        <span class="gi-global-go">全局设置 ›</span>
      </button>

      <PlayerPanel {...props} who={1} />
      <PlayerPanel {...props} who={0} />
    </div>
  );
}
