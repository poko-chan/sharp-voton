// User level system with diminishing returns + inactivity slowdown.
//
// 基本: hours = totalMinutes / 60
// effective = hours * inactivity factor
//   - 0-2日: 1.0
//   - 3日以上: 1日ごとに -8%、下限 0.3
// level = floor(effective^0.55) + 1   (1 始まり)
// 上位レベルほど 1 レベル必要な時間が指数的に増える → 自然に成長が遅くなる

export function inactivityFactor(daysSinceLast: number): number {
  if (!isFinite(daysSinceLast) || daysSinceLast <= 2) return 1;
  return Math.max(0.3, 1 - (daysSinceLast - 2) * 0.08);
}

export function levelFromMinutes(totalMinutes: number, daysSinceLast = 0): number {
  const hours = Math.max(0, totalMinutes) / 60;
  const eff = hours * inactivityFactor(daysSinceLast);
  return Math.floor(Math.pow(eff, 0.55)) + 1;
}

// レベル L に必要な「実効時間」(hours)
function hoursForLevel(level: number): number {
  return Math.pow(Math.max(0, level - 1), 1 / 0.55);
}

export type LevelInfo = {
  level: number;
  currentHours: number;
  nextLevelHours: number;
  prevLevelHours: number;
  progressPct: number; // 0-100
  remainingHours: number;
  inactivityFactor: number;
};

export function levelInfo(totalMinutes: number, daysSinceLast = 0): LevelInfo {
  const factor = inactivityFactor(daysSinceLast);
  const effHours = (Math.max(0, totalMinutes) / 60) * factor;
  const level = Math.floor(Math.pow(effHours, 0.55)) + 1;
  const prev = hoursForLevel(level);
  const next = hoursForLevel(level + 1);
  const span = next - prev || 1;
  const pct = Math.min(100, Math.max(0, ((effHours - prev) / span) * 100));
  return {
    level,
    currentHours: effHours,
    nextLevelHours: next,
    prevLevelHours: prev,
    progressPct: pct,
    remainingHours: Math.max(0, next - effHours),
    inactivityFactor: factor,
  };
}
