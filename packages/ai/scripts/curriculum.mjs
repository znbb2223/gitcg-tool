// 课程对照：同一批牌组下，真实模式 vs 明牌模式的胜率（搜索决策）
import { CURRENT_VERSION } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { runEvolution, summarizeLearning } from "../dist/index.js";

const data = getData(CURRENT_VERSION);
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
const games = Number(process.argv[2] ?? 4);

for (const information of ["fair", "perfect"]) {
  const started = Date.now();
  const learning = await runEvolution({
    data, deckData, games, mode: "learned",
    information, useSearch: true, searchBudgetMs: 100,
    seed: 1000,
  });
  console.log(
    `${information === "fair" ? "真实" : "明牌"}课程：${games} 局，${((Date.now() - started) / games / 1000).toFixed(1)}s/局，经验 ${learning.games} 局`,
  );
}
