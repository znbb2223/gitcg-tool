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

import type { DetailLogger, IDetailLogger } from "./log";

export interface AsyncContext<T> {
  run: <R>(value: T, fn: () => Promise<R>) => Promise<R>;
  get: () => T | undefined;
}

export interface GiTcgAsyncContextValue {
  previewLogger?: DetailLogger;
  gameLogger: DetailLogger;
}

export type GiTcgAsyncContext = AsyncContext<GiTcgAsyncContextValue>;

let activeContext: GiTcgAsyncContext = createNoopAsyncContext();

export const runWithAsyncContext = <R>(
  value: GiTcgAsyncContextValue,
  fn: () => Promise<R>,
): Promise<R> => {
  return activeContext.run(value, fn);
};

export const getAsyncContextValue = (): GiTcgAsyncContextValue | undefined => {
  return activeContext.get();
};

function createNoopAsyncContext(): GiTcgAsyncContext {
  return {
    run<R>(value: GiTcgAsyncContextValue, fn: () => Promise<R>): Promise<R> {
      return fn();
    },
    get() {
      return;
    },
  };
}

async function createNodeAsyncContext(): Promise<GiTcgAsyncContext> {
  // @ts-expect-error No typings for node since we are env-agnostic
  const { AsyncLocalStorage } = (
    globalThis as { process?: { getBuiltinModule: (id: string) => unknown } }
  ).process!.getBuiltinModule("node:async_hooks") as {
    AsyncLocalStorage: new () => {
      run: <R>(value: GiTcgAsyncContextValue, fn: () => Promise<R>) => Promise<R>;
      getStore: () => GiTcgAsyncContextValue | undefined;
    };
  };
  const asyncLocalStorage = new AsyncLocalStorage();
  return {
    run<R>(value: GiTcgAsyncContextValue, fn: () => Promise<R>): Promise<R> {
      return asyncLocalStorage.run(value, fn);
    },
    get() {
      return asyncLocalStorage.getStore();
    },
  };
}

function createBrowserAsyncContext(): GiTcgAsyncContext {
  // 浏览器/WebView 里不依赖外部 CDN：用当前异步上下文的简单栈，
  // 保证离线 APK 也能启动（错误日志会少一点上下文，但游戏逻辑不受影响）。
  let current: GiTcgAsyncContextValue | undefined;
  return {
    run<R>(value: GiTcgAsyncContextValue, fn: () => Promise<R>): Promise<R> {
      const previous = current;
      current = value;
      return fn().finally(() => {
        current = previous;
      });
    },
    get() {
      return current;
    },
  };
}

async function enableAsyncContext(): Promise<void> {
  // @ts-expect-error No `window`'s typings
  if (typeof window !== "undefined") {
    activeContext = createBrowserAsyncContext();
    // @ts-expect-error No `process`'s typings
  } else if (typeof process !== "undefined") {
    activeContext = await createNodeAsyncContext();
  }
}

function disableAsyncContext(): void {
  activeContext = createNoopAsyncContext();
}

export async function setAsyncContext(value?: boolean | GiTcgAsyncContext) {
  if (!value) {
    disableAsyncContext();
  } else if (value === true) {
    await enableAsyncContext().catch((e) => {
      console?.warn?.(
        "Failed to enable async context, falling back to noop context",
        e,
      );
      disableAsyncContext();
    });
  } else {
    activeContext = value;
  }
}
