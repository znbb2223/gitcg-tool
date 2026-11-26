import { For, Show, createMemo } from "solid-js";
import type { AllCardsProps } from "./AllCards";
import { DeckCard } from "./Card";
import { useDeckBuilderContext } from "./DeckBuilder";

export function CurrentDeck(props: AllCardsProps) {
  const { showCard } = useDeckBuilderContext();

  // 行动牌按 id 聚合成「×N」，比铺 30 个格子更适合手机查看
  const cardGroups = createMemo(() => {
    const counts = new Map<number, number>();
    for (const id of props.deck.cards) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  });

  const removeCharacter = (id: number) => {
    props.onChangeDeck?.({
      ...props.deck,
      characters: props.deck.characters.filter((c) => c !== id),
    });
  };

  const removeActionCard = (id: number) => {
    const index = props.deck.cards.lastIndexOf(id);
    if (index < 0) {
      return;
    }
    const cards = props.deck.cards.slice();
    cards.splice(index, 1);
    props.onChangeDeck?.({ ...props.deck, cards });
  };

  return (
    <div class="gi-deck-board">
      <section class="gi-deck-row">
        <h3>
          角色
          <em>
            {props.deck.characters.length}/3
          </em>
        </h3>
        <div class="gi-deck-chars">
          <For each={props.deck.characters}>
            {(id) => (
              <div
                class="gi-deck-char"
                onClick={() => showCard("character", id)}
              >
                <DeckCard
                  class="gi-deck-card-img"
                  id={id}
                  type="character"
                  warn={(props.characters.get(id)?.version ?? 0) > props.version}
                />
                <button
                  type="button"
                  class="gi-deck-remove"
                  title="移除这个角色"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCharacter(id);
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </For>
          <For
            each={Array.from({
              length: Math.max(0, 3 - props.deck.characters.length),
            })}
          >
            {() => <div class="gi-deck-slot-empty" />}
          </For>
        </div>
      </section>

      <section class="gi-deck-row">
        <h3>
          行动牌
          <em>{props.deck.cards.length}/30</em>
        </h3>
        <Show
          when={cardGroups().length > 0}
          fallback={<p class="gi-deck-hint">还没有行动牌，在左边的卡池里点卡牌添加</p>}
        >
          <div class="gi-deck-cards">
            <For each={cardGroups()}>
              {([id, count]) => (
                <div
                  class="gi-deck-card"
                  onClick={() => showCard("actionCard", id)}
                >
                  <DeckCard
                    class="gi-deck-card-img"
                    id={id}
                    type="actionCard"
                    warn={(props.actionCards.get(id)?.version ?? 0) > props.version}
                  />
                  <Show when={count > 1}>
                    <span class="gi-deck-badge">×{count}</span>
                  </Show>
                  <button
                    type="button"
                    class="gi-deck-remove"
                    title="移除一张"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeActionCard(id);
                    }}
                  >
                    −
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </section>

      <p class="gi-deck-tip">点卡牌看详情，点角上的 × / − 移除</p>
    </div>
  );
}
