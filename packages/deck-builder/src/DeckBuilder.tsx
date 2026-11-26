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
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import {
  Errored,
  Loading,
  createContext,
  omit,
  useContext,
  createSignal,
  createMemo,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { AllCards } from "./AllCards";
import { CurrentDeck } from "./CurrentDeck";
import type { Deck } from "@gi-tcg/typings";
import { createCardDataViewer } from "@gi-tcg/card-data-viewer";
import {
  DEFAULT_ASSETS_MANAGER,
  type AssetsManager,
} from "@gi-tcg/assets-manager";
import { translations, type Locale } from "./i18n";
import type { I18nKey } from "./locales";
import {
  resolveTemplate,
  translator as createTranslator,
} from "@solid-primitives/i18n";

export interface DeckBuilderProps extends JSX.HTMLAttributes<HTMLDivElement> {
  assetsManager?: AssetsManager;
  deck?: Deck;
  version?: string;
  onChangeDeck?: (deck: Deck) => void;
  locale?: Locale;
}

interface DeckBuilderContextValue {
  assetsManager: () => AssetsManager;
  locale: () => Locale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  showCard: (type: "actionCard" | "character", id: number) => void;
}

const DeckBuilderContext = createContext<DeckBuilderContextValue>();

export const useDeckBuilderContext = () => useContext(DeckBuilderContext)!;

const EMPTY_DECK: Deck = {
  characters: [],
  cards: [],
};

export function DeckBuilder(props: DeckBuilderProps) {
  const rest = omit(props, "assetsManager", "locale", "class");
  const assetsManager = createMemo(
    () => props.assetsManager ?? DEFAULT_ASSETS_MANAGER,
  );
  const locale = createMemo(() => props.locale ?? "zh-CN");
  const t = createTranslator(() => translations[locale()], resolveTemplate);

  const deckData = createMemo(() => assetsManager().getDeckData());

  const { CardDataViewer, showCard, showCharacter, hide } =
    createCardDataViewer({
      assetsManager,
      locale,
    });

  // 详情弹窗是整屏遮罩：只有真正显示了才拦截触摸，否则卡池点不动
  const [viewerShown, setViewerShown] = createSignal(false);
  let viewerRoot: HTMLDivElement | undefined;
  const closeViewer = () => {
    hide();
    setViewerShown(false);
  };
  // 点词条会把「规则解释」追加成第二个面板，手机上要把它滚进视野，否则看着像没反应。
  // 词条自己的点击带 stopPropagation，冒泡阶段收不到，所以在捕获阶段挂监听。
  const handleViewerClick = (e: Event) => {
    if ((e.target as HTMLElement | null)?.closest(".description-underline")) {
      revealRulePanel();
    }
  };
  const revealRulePanel = () => {
    requestAnimationFrame(() => {
      const scroller = viewerRoot?.querySelector<HTMLElement>(
        ".gi-tcg-card-data-viewer",
      );
      const panels = scroller?.querySelectorAll<HTMLElement>(":scope > .card-panel");
      if (!scroller || !panels || panels.length < 2) {
        return;
      }
      const last = panels[panels.length - 1];
      scroller.scrollTop +=
        last.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
    });
  };

  const allVersions = () => deckData().allVersions;
  const versionSpecified = () =>
    !!props.version && allVersions().includes(props.version);

  const [version, setVersion] = createSignal(() => {
    const versions = allVersions();
    return versionSpecified()
      ? versions.indexOf(props.version!)
      : Math.max(versions.length - 1, 0);
  });

  // 手机上「当前牌组」是底部抽屉，桌面端是右侧栏
  const [deckOpen, setDeckOpen] = createSignal(false);
  const characterCount = () => props.deck?.characters.length ?? 0;
  const cardCount = () => props.deck?.cards.length ?? 0;

  return (
    <DeckBuilderContext
      value={{
        assetsManager,
        locale,
        t,
        showCard: (type, id) => {
          if (type === "actionCard") {
            showCard(id);
          } else {
            showCharacter(id);
          }
          setViewerShown(true);
        },
      }}
    >
      <div class={["gi-tcg-deck-builder gi-deck @container", props.class]}>
        <div class="gi-deck-pool" {...rest} onClick={closeViewer}>
          <Errored fallback={<div class="gi-deck-loading">{t("loadCardsFailed")}</div>}>
            <Loading
              on={assetsManager()}
              fallback={<div class="gi-deck-loading">{t("loadingCards")}</div>}
            >
              <AllCards
                version={version()}
                versionSpecified={versionSpecified()}
                deck={props.deck ?? EMPTY_DECK}
                onChangeDeck={props.onChangeDeck}
                onSetVersion={setVersion}
                {...deckData()}
              />
            </Loading>
          </Errored>
        </div>

        <aside class="gi-deck-side" data-open={deckOpen() ? "true" : undefined}>
          <button
            type="button"
            class="gi-deck-handle"
            onClick={() => setDeckOpen((value) => !value)}
          >
            <span class="gi-deck-handle-title">当前牌组</span>
            <span
              class="gi-deck-stat"
              data-ok={characterCount() === 3 ? "true" : undefined}
            >
              角色 {characterCount()}/3
            </span>
            <span
              class="gi-deck-stat"
              data-ok={cardCount() === 30 ? "true" : undefined}
            >
              行动牌 {cardCount()}/30
            </span>
            <span class="gi-deck-handle-action">
              {deckOpen() ? "收起" : "查看"}
            </span>
          </button>
          <div class="gi-deck-body">
            <CurrentDeck
              version={version()}
              deck={props.deck ?? EMPTY_DECK}
              onChangeDeck={props.onChangeDeck}
              {...deckData()}
            />
          </div>
        </aside>

        <div
          class="gi-card-viewer"
          data-shown={viewerShown() ? "true" : undefined}
          ref={(el) => {
            viewerRoot = el;
            el.addEventListener("click", handleViewerClick, true);
          }}
          onClick={(e) => {
            // 点面板内部不关；点遮罩空白处（含右上角 ×）关闭
            if (!(e.target as HTMLElement).closest(".card-panel")) {
              closeViewer();
            }
          }}
        >
          <div class="gi-card-viewer-box">
            <CardDataViewer />
            <button
              type="button"
              class="gi-card-viewer-close"
              title="关闭"
              onClick={(e) => {
                e.stopPropagation();
                closeViewer();
              }}
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </DeckBuilderContext>
  );
}
