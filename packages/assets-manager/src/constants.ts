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

import { IS_BETA } from "@gi-tcg/config";
import type { Language } from "./manager";

/** 本地打包模式：图片/数据从随包目录读，而不是远程 CDN */
export const LOCAL_ASSETS: boolean = (() => {
  const flag =
    (globalThis as { __LOCAL_ASSETS__?: boolean }).__LOCAL_ASSETS__ ??
    import.meta.env?.LOCAL_ASSETS ??
    // @ts-expect-error Node.js typing
    globalThis.process?.env?.LOCAL_ASSETS;
  return flag === true || flag === "true";
})();

export const DEFAULT_STATIC_DATA_API_BASE_URL: string =
  (globalThis as { __STATIC_DATA_BASE__?: string }).__STATIC_DATA_BASE__ ||
  import.meta.env?.DEFAULT_STATIC_DATA_API_BASE_URL ||
  // @ts-expect-error Node.js typing
  globalThis.process?.env.DEFAULT_STATIC_DATA_API_BASE_URL ||
  "https://static-data.piovium.org/";

const preferredLanguage =
  globalThis?.navigator?.languages?.[0] ??
  globalThis?.navigator?.language ??
  globalThis?.Intl?.DateTimeFormat()?.resolvedOptions()?.locale ??
  "en-US";
export const DEFAULT_LANGUAGE: Language = preferredLanguage.startsWith("zh")
  ? "CHS"
  : "EN";
export const DEFAULT_VERSION: typeof IS_BETA extends true ? "beta" : "latest" =
  (IS_BETA ? "beta" : "latest") as any;
