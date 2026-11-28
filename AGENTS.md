## 本项目快速上手（fork：七圣召唤工具 · 离线版）

- **是什么**：基于上游 gi-tcg 的离线/手游化封装 + 安卓壳 + 牌组码工具 + AI 训练器；文档索引见 `docs/README.md`。
- **素材不入库**：先按 `docs/ASSETS.zh.md` 抓 `packages/standalone/public/assets-local` 与 `public/data`，否则页面是空壳（这不是构建失败）。
- **构建**：`sh build-oneclick.sh`（一条龙出 APK）；手动构建用
  `pnpm install --config.package-import-method=copy && pnpm --filter "@gi-tcg/standalone..." build`
  （按依赖拓扑构建，只手动跑 4 个 filter 会漏 `@gi-tcg/typings`）。产物在 `packages/standalone/dist`。
- **手机/arm64**：装依赖前设 `PUPPETEER_SKIP_DOWNLOAD=1`；MT 内置终端无 Node/JDK，需 Termux/proot。
- **本地验收**：`cd packages/standalone/dist && python3 -m http.server 8899`，打开 `hub.html`；截图 / DOM 尺寸 / 像素验收规范见 `docs/TESTING.zh.md`。
- **安卓壳**：`android/README.md` + `docs/BUILD.zh.md` 第 4 节；签名 keystore 必须固定，换签名只能卸载重装。
- **关键地图**：`packages/core`（引擎）/ `packages/ai`（AI）/ `packages/standalone`（应用）/ `android/`（壳）/ `tools/deckcode`（牌组码）/ `docs/`（文档）。
- **硬约束**：APK 零权限、不联网、origin 固定 `http://127.0.0.1:8765`；卡牌数据当前 7.2.0 且短期不更新，升级见 `docs/MAINTENANCE.zh.md`。
- **提交前**：`pnpm -r check`、`pnpm test`；改文档后检查代码块围栏成对。

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, `style`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `data`, `web-ui-core`, or `server`. Multiple scopes can be specified using comma, e.g. `core, data`.

Examples: `fix(web-ui-core): simplify declare end button styling`, `docs: update contributing guide`, `chore(typings): regenerate types`.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Validate unknown values once at the boundary that owns them. Pass typed values inward instead of repeating `typeof value === "object"` and property-existence checks. Do not defensively revalidate values already guaranteed by a schema, constructor, or internal type.
- Do not extract single-use helpers preemptively. Inline the logic at the call site unless the helper is reused, hides a genuinely complex boundary, or has a clear independent name that improves the caller.
- Before adding complexity for a speculative or vanishingly unlikely race or security edge case, explain the concrete failure mode, likelihood, and complexity cost to the user and get their buy-in. Do not silently expand scope for theoretical robustness.
- Avoid `try`/`catch` where possible
- Avoid unnecessary `any`; only write `as any` if the typing is correct but failed due to TypeScript's limitations.
- Prefer native APIs in new or modified code when possible, e.g. use `glob` from `node:fs` instead of 3rd-party `glob`. Existing third-party usage does not require unrelated migration.
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- Prefer scoped constant rather than global identifier, e.g. `typeof foo === "undefined"` instead of `foo === undefined`, `Number.POSITIVE_INFINITY` instead of `Infinity`.
- Always use block statement inside `if`'s branch and loop's body, even though it only contains single statement.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await readFile(path.join(dir, "journal.json"));

// Bad
const journalPath = path.join(dir, "journal.json");
const journal = await readFile(journalPath);
```

### Imports

- Never use type-position `import("...")` references such as `Required<import("@gi-tcg/core").GameData>`.
- Never use indexed type such as `Foo["bar"][number]` unless that type does not have an accessible name from the use point.

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment for simple condition.

```ts
// Good
const foo = condition ? 1 : 2;

// Bad
let foo
if (condition) {
  foo = 1;
} else {
  foo = 2;
}
```

### Complex Logic

When a function has several validation branches or supporting details, make the main function read as the happy path and move supporting details into small helpers below it.

```ts
// Good
export function loadThing(input: unknown) {
  const config = requireConfig(input);
  const metadata = readMetadata(input);
  return createThing({ config, metadata });
}

function requireConfig(input: unknown) {
  ...
}
```

- Keep helpers close to the code they support, below the main export when that improves readability.
- Do not over-abstract simple expressions into many single-use helpers; extract only when it names a real concept like `requireConfig` or `readMetadata`.
- Add comments for non-obvious constraints and surprising behavior, not for obvious assignments or control flow.

## Testing

- Avoid mocks as much as possible, you shouldn't be using globalThis.\* at all unless it's the only option.
- Test actual implementation, do not duplicate logic into tests.
- Run `pnpm test` from the repository root to run tests across packages, or from a package directory such as `packages/core` for focused tests.
- Tests of card's implementation should be written under `packages/test/__tests__`, and should be implemented in asserting exact, observable behavior (game state), instead of internal logs.
- Do not introduce tests for a package with zero test coverage without the user's explicit allowance.

## Checks

- Before finishing a Solid.js change, verify that the code has no reactivity warnings or errors by running a configured ESLint check inside the affected package.
- During focused iteration, run `pnpm check` from the affected package directory if it defines a `check` script (for example, `packages/core`). Never run `tsc` directly.
- Run `pnpm -r check` from the repository root to run a repository-wide check. A full `pnpm build` might be required: missing or stale package builds can cause mismatched types. Packages without a `check` script are skipped, so this is not full lint and type-check coverage.

## Documentations

- Do not add documentations for new features except that user ask you to do so.
