/** お子様の利用時間をこの端末に記録する（全体と機能ごと） */

const USAGE_KEY = "study-hash.usage";

type Usage = { date: string; minutes: number; apps: Record<string, number> };

function today() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function readUsage(): Usage {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}");
    if (raw?.date === today()) {
      return { date: raw.date, minutes: Number(raw.minutes ?? 0), apps: raw.apps ?? {} };
    }
  } catch {
    /* ignore */
  }
  return { date: today(), minutes: 0, apps: {} };
}

export function bumpUsage(appKey: string | null): Usage {
  const u = readUsage();
  u.minutes += 1;
  if (appKey) u.apps[appKey] = (u.apps[appKey] ?? 0) + 1;
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
  return u;
}

/** パスから機能キーを取り出す（/chat/123 -> chat） */
export function featureKeyFromPath(path: string) {
  const seg = path.split("/").filter(Boolean)[0];
  return seg ?? null;
}
