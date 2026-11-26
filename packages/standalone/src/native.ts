/**
 * 与安卓壳的桥接：
 * - 网页版：用浏览器下载/文件选择器；
 * - APK：走 AndroidHost.saveTextFile / 文件选择器，规避 WebView 不支持 blob 下载的问题。
 */

interface AndroidHostBridge {
  saveTextFile?: (name: string, text: string) => void;
  saveTextFileIn?: (category: string, name: string, text: string) => void;
  saveImageFile?: (name: string, base64: string) => void;
  saveImageFileIn?: (category: string, name: string, base64: string) => void;
  writeCacheFile?: (name: string, text: string) => boolean;
  listCacheFiles?: () => string;
  readCacheFile?: (name: string) => string | null;
  deleteCacheFile?: (name: string) => boolean;
  clearCacheFiles?: () => number;
  exportCacheFile?: (name: string) => boolean;
}

export interface CacheLogInfo {
  name: string;
  size: number;
  mtime: number;
}

const WEB_CACHE_KEY = "gi-tcg-lab-cache-logs-v1";

function webCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(WEB_CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** 写入缓存日志；返回 false 表示浏览器存档失败（已退回直接下载）。 */
export function writeCacheLog(name: string, text: string) {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.writeCacheFile) {
    return host.writeCacheFile(name, text) !== false;
  }
  const cache = webCache();
  cache[name] = text;
  const names = Object.keys(cache);
  for (const old of names.slice(0, Math.max(0, names.length - 5))) {
    delete cache[old];
  }
  try {
    localStorage.setItem(WEB_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    delete cache[name];
    saveTextFile(name, text);
    return false;
  }
}

export function listCacheLogs(): CacheLogInfo[] {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.listCacheFiles) {
    return host
      .listCacheFiles()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, size, mtime] = line.split("\t");
        return { name, size: Number(size) || 0, mtime: Number(mtime) || 0 };
      });
  }
  return Object.entries(webCache()).map(([name, text]) => ({
    name,
    size: new Blob([text]).size,
    mtime: 0,
  }));
}

export function readCacheLog(name: string): string | null {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.readCacheFile) {
    return host.readCacheFile(name);
  }
  return webCache()[name] ?? null;
}

export function deleteCacheLog(name: string) {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.deleteCacheFile) {
    host.deleteCacheFile(name);
    return;
  }
  const cache = webCache();
  delete cache[name];
  localStorage.setItem(WEB_CACHE_KEY, JSON.stringify(cache));
}

export function clearCacheLogs() {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.clearCacheFiles) {
    host.clearCacheFiles();
    return;
  }
  localStorage.removeItem(WEB_CACHE_KEY);
}

/** 把缓存目录里的日志复制到下载目录，返回是否成功。 */
export function exportCacheLog(name: string) {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.exportCacheFile) {
    return host.exportCacheFile(name);
  }
  const text = webCache()[name];
  if (text === undefined) {
    return false;
  }
  saveTextFile(name, text);
  return true;
}

/** 文本导出：APK 下按分类存到「下载/七圣召唤工具/<分类>/」，网页版退回普通下载 */
/** 图片导出（base64）：APK 下按分类存到「下载/七圣召唤工具/<分类>/」 */
export function saveImageFile(name: string, base64: string, category = "牌组图") {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.saveImageFileIn) {
    host.saveImageFileIn(category, name, base64);
    return true;
  }
  if (host?.saveImageFile) {
    host.saveImageFile(name, base64);
    return true;
  }
  return false;
}

export function saveTextFile(name: string, text: string, category = "其他") {
  const host = (globalThis as { AndroidHost?: AndroidHostBridge }).AndroidHost;
  if (host?.saveTextFileIn) {
    host.saveTextFileIn(category, name, text);
    return;
  }
  if (host?.saveTextFile) {
    host.saveTextFile(name, text);
    return;
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
