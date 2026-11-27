// Copyright (C) 2026 Piovium Labs
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

export {
  AiPlayer,
  createAi,
  isPayable,
  type AiDifficulty,
  type AiOptions,
  type AiPlayerIO,
} from "./player";
export {
  ACTION_KINDS,
  candidateFeatures,
  policyScores,
  type CandidateFeatures,
  type PolicyWeights,
  type ScoredCandidate,
} from "./policy";
export {
  DEFAULT_AI_WEIGHTS,
  costWeight,
  pickAction,
  scoreAction,
  summarizePreview,
  type AiWeights,
  type PreviewSummary,
  type ScoredAction,
  type ScoreContext,
  type ShieldDataSource,
  type ShieldHit,
} from "./evaluate";
export {
  dmcScoreCandidates,
  pickDmcAction,
  type DmcChoice,
  type DmcOptions,
  type DmcWeights,
} from "./dmc";
export {
  actionKey,
  precomputeLine,
  takeCacheHitCount,
  recordPrecomputed,
  searchBestAction,
  type DeterminizeOptions,
  type SearchCandidateStat,
  type SearchOptions,
  type SearchResult,
} from "./search";
export {
  buildDeck,
  fitsDeck,
  mutateDeck,
  randomDeck,
  styleOfDeck,
  validateDeck,
  type DeckBuildOptions,
  type DeckValidation,
} from "./deck";
export { fastReply } from "./search";
export {
  GAME_VERSION,
  cardWeights,
  characterWeights,
  createLearning,
  deckKey,
  deckWinRate,
  mergeLearning,
  mergeLearningDedup,
  recordGame,
  summarizeDecks,
  summarizeLearning,
  type DeckRecord,
  type LearningData,
  type LearningEntry,
  type GameLogEntry,
  type VersionRecord,
} from "./learner";
export {
  playFastGame,
  runEvolution,
  type EvolutionGameRecord,
  type EvolutionMode,
  type EvolutionOptions,
  type EvolutionProgress,
  type FastGameResult,
} from "./selfplay";
export { ponderPosition, type PonderOptions, type PonderResult } from "./ponder";
export {
  createMemory,
  createMemoryAdapter,
  memoryKey,
  memorySize,
  type DecisionMemory,
  type DecisionMemoryData,
  type MemoryEntry,
} from "./memory";
export { DECK_LIBRARY, type LibraryDeck } from "./data/deck-library";
export { VALUE_NN } from "./data/value-nn";
export { EXPERIENCE_SEED } from "./data/experience-seed";

/** 牌组指纹：角色和卡牌各排序后拼接，和牌组库/训练分片用的是同一套 key */
export function deckKeyOf(deck: { characters: readonly number[]; cards: readonly number[] }): string {
  return `${[...deck.characters].sort((a, b) => a - b).join(",")}|${[...deck.cards]
    .sort((a, b) => a - b)
    .join(",")}`;
}
export {
  configureValue,
  createFeatureTable,
  featureKey,
  getValueOptions,
  handcraftedValueV1,
  handcraftedValueV2,
  mergeFeatureTables,
  nnValue,
  recordBucket,
  stateFeatures,
  tableValue,
  valueOf,
  FEATURE_NAMES,
  FEATURE_ORDER,
  stateFeatureMap,
  type FeatureBucket,
  type FeatureName,
  type FeatureTable,
  type FeatureVector,
  type NnLayer,
  type NnWeights,
  type ValueOptions,
} from "./value";
