import { findApp } from "@/lib/app-directory";

export type RecentItem = { to: string; label: string; at: number; count: number };

const KEY = "study.recentApps.v1";
const PIN_KEY = "study.pinnedApps.v1";
const MAX = 24;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export function getRecents(): RecentItem[] {
  return read<RecentItem[]>(KEY, []).sort((a, b) => b.at - a.at);
}

/** 画面を開いたことを端末内に記録する（サーバー通信なし） */
export function recordVisit(path: string) {
  const app = findApp(path);
  if (!app) return;
  const list = read<RecentItem[]>(KEY, []);
  const now = Date.now();
  const found = list.find((r) => r.to === app.to);
  if (found) {
    // 直近30秒の連続表示は数えない
    if (now - found.at < 30_000) return;
    found.at = now;
    found.count += 1;
    found.label = app.label;
  } else {
    list.push({ to: app.to, label: app.label, at: now, count: 1 });
  }
  write(KEY, list.sort((a, b) => b.at - a.at).slice(0, MAX));
  try {
    window.dispatchEvent(new CustomEvent("study:recent-updated"));
  } catch {
    /* noop */
  }
}

export function clearRecents() {
  write(KEY, []);
  try {
    window.dispatchEvent(new CustomEvent("study:recent-updated"));
  } catch {
    /* noop */
  }
}

export function getFrequent(limit = 6): RecentItem[] {
  return read<RecentItem[]>(KEY, [])
    .slice()
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, limit);
}

export function getPinned(): string[] {
  return read<string[]>(PIN_KEY, []);
}

export function togglePinned(to: string): string[] {
  const cur = getPinned();
  const next = cur.includes(to) ? cur.filter((p) => p !== to) : [...cur, to].slice(0, 8);
  write(PIN_KEY, next);
  try {
    window.dispatchEvent(new CustomEvent("study:recent-updated"));
  } catch {
    /* noop */
  }
  return next;
}
