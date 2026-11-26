import {
  For,
  Match,
  Show,
  Switch,
  createContext,
  createMemo,
  createSignal,
  onSettled,
  omit,
  useContext,
  type Accessor,
  createStore,
  snapshot,
  untrack,
} from "solid-js";
import type { ComponentProps, JSX } from "@solidjs/web";
import type { GameState } from "@gi-tcg/core";
import { Surface } from "./Fields";
import { CharacterEditor } from "./CharacterEditor";
import { PileEditor, HandsEditor } from "./HandsPileEditor";
import { PlayerSectionEditor } from "./PlayerSectionEditor";
import type { Draft } from "immer";
import { ModalContextProvider } from "./Modal";
import { guard } from "../utils";
import { GlobalSection } from "./GlobalSection";
import type { EditorCatalog, EditorSection, UpdateGameState } from "../types";
import { createDefaultGameState } from "../state/factory";
import { buildEditorCatalog } from "../state/catalog";
import { validateGameState } from "../state/validator";
import { BoardView } from "./BoardView";

export interface GameStateEditorProps extends Omit<
  ComponentProps<"div">,
  "onSubmit"
> {
  initialValue?: GameState;
  onSubmit: (state: GameState) => void;
}

const whoLabel = (who: 0 | 1) => (who === 0 ? "我方" : "对手");

const sectionLabel = (section: EditorSection) => {
  switch (section.kind) {
    case "global":
      return "游戏全局";
    case "character":
      return `${whoLabel(section.who)} · 角色 ${section.characterIndex + 1}`;
    case "pile":
      return `${whoLabel(section.who)} · 牌库`;
    case "hands":
      return `${whoLabel(section.who)} · 手牌`;
    case "supports":
      return `${whoLabel(section.who)} · 支援区`;
    case "summons":
      return `${whoLabel(section.who)} · 召唤区`;
    case "combatStatuses":
      return `${whoLabel(section.who)} · 出战状态`;
    case "dice":
      return `${whoLabel(section.who)} · 骰子`;
    case "playerInfo":
      return `${whoLabel(section.who)} · 玩家信息`;
    case "deckImport":
      return `${whoLabel(section.who)} · 牌组导入`;
  }
};

export interface StateEditorContextValue {
  gameState: Accessor<GameState>;
  updateState: UpdateGameState;
  catalog: Accessor<EditorCatalog>;
  openModal: (modalCode: () => JSX.Element) => void;
}

const StateEditorContext = createContext<StateEditorContextValue>();

export const useStateEditorContext = () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return useContext(StateEditorContext)!;
};

export function GameStateEditor(props: GameStateEditorProps) {
  const rest = omit(props, "initialValue", "onSubmit", "children", "class");
  const initialState =
    untrack(() => props.initialValue) ?? createDefaultGameState();
  const [state, setState] = createStore(initialState);
  const catalog = createMemo(() => buildEditorCatalog(state));
  const [selectedSection, setSelectedSection] = createSignal<EditorSection>({
    kind: "global",
  });
  const [sheetExpanded, setSheetExpanded] = createSignal(false);
  const [modalStack, setModalStack] = createSignal<(() => JSX.Element)[]>([]);

  const errors = createMemo(() => validateGameState(state, catalog()));
  const [formValid, setFormValid] = createSignal(true);
  let formRef!: HTMLFormElement;

  const refreshFormValidity = () => {
    setFormValid(formRef.checkValidity());
  };

  onSettled(() => queueMicrotask(refreshFormValidity));

  const updateState: UpdateGameState = (updater) => {
    setState((draft) => {
      updater(draft as Draft<GameState>);
    });
    queueMicrotask(refreshFormValidity);
  };

  const openModal = (modalCode: () => JSX.Element) => {
    function Wrapper() {
      return (
        <ModalContextProvider
          value={{
            removeSelf: () => {
              setModalStack((stack) => stack.filter((m) => m !== Wrapper));
              queueMicrotask(refreshFormValidity);
            },
          }}
        >
          {modalCode()}
        </ModalContextProvider>
      );
    }
    setModalStack((stack) => [...stack, Wrapper]);
  };

  const selectSection = (section: EditorSection) => {
    setSelectedSection(section);
    setSheetExpanded(true);
  };

  const submit = () => {
    if (!formValid() || errors().length > 0) {
      return;
    }
    const nextState = snapshot(state);
    props.onSubmit(nextState);
  };

  return (
    <div {...rest} class={["gi-state-editor", props.class]}>
      <StateEditorContext
        value={{
          gameState: () => state,
          updateState,
          openModal,
          catalog,
        }}
      >
        <form
          ref={formRef}
          class="gi-editor-frame"
          onInput={refreshFormValidity}
          onChange={refreshFormValidity}
        >
          <header class="gi-editor-top">
            <div class="gi-editor-brand">
              <h1>摆盘器</h1>
              <span>对局状态编辑</span>
            </div>
            <div class="gi-editor-actions">
              <Show when={errors().length > 0 || !formValid()}>
                <span class="gi-badge" data-tone="warn">
                  {errors().length > 0
                    ? `${errors().length} 个状态问题`
                    : "表单未完成"}
                </span>
              </Show>
              {props.children}
              <button
                type="button"
                class="gi-primary"
                disabled={!formValid() || errors().length > 0}
                onClick={submit}
              >
                完成
              </button>
            </div>
          </header>

          <main class="gi-editor-main">
            <div class="gi-editor-board gi-editor-scroll">
              <BoardView
                state={state}
                selected={selectedSection()}
                onSelect={selectSection}
              />
            </div>

            <aside
              class="gi-editor-sheet"
              data-expanded={sheetExpanded() ? "true" : undefined}
            >
              <header class="gi-sheet-head">
                <div class="gi-sheet-title">
                  <span>正在编辑</span>
                  <h2>{sectionLabel(selectedSection())}</h2>
                </div>
                <button
                  type="button"
                  class="gi-sheet-toggle"
                  onClick={() => setSheetExpanded((value) => !value)}
                >
                  {sheetExpanded() ? "收起" : "展开"}
                </button>
              </header>
              <div class="gi-sheet-body gi-editor-scroll">
                <Switch>
                  <Match when={selectedSection().kind === "global"}>
                    <GlobalSection initialState={initialState} />
                  </Match>

                  <Match
                    when={guard(selectedSection, (s) => s.kind === "pile")}
                  >
                    {(sect) => <PileEditor state={state} who={sect().who} />}
                  </Match>
                  <Match
                    when={guard(selectedSection, (s) => s.kind === "hands")}
                  >
                    {(sect) => <HandsEditor state={state} who={sect().who} />}
                  </Match>

                  <Match
                    when={guard(selectedSection, (s) => s.kind === "character")}
                  >
                    {(sect) => (
                      <CharacterEditor
                        who={sect().who}
                        characterIndex={sect().characterIndex}
                        onSelectSection={setSelectedSection}
                      />
                    )}
                  </Match>

                  <Match when={guard(selectedSection, (s) => "who" in s)}>
                    {(sect) => (
                      <PlayerSectionEditor
                        state={state}
                        who={sect().who}
                        kind={sect().kind}
                      />
                    )}
                  </Match>
                </Switch>

                <Show when={errors().length > 0}>
                  <Surface title="状态校验" class="gi-validation">
                    <ul>
                      <For each={errors()}>{(error) => <li>{error}</li>}</For>
                    </ul>
                  </Surface>
                </Show>
              </div>
            </aside>
          </main>
        </form>
        <For each={modalStack()}>{(modal) => modal()}</For>
      </StateEditorContext>
    </div>
  );
}
