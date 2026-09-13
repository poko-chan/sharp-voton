import { addDaysStr, localDateStr } from "@/lib/date";

export const XLANG_FORMATS = [
  { key: "word-bank", label: "並び替え", icon: "Blocks" },
  { key: "choice", label: "選択式", icon: "ListChecks" },
  { key: "listening", label: "リスニング", icon: "Headphones" },
  { key: "speaking", label: "スピーキング", icon: "Mic2" },
  { key: "matching", label: "ペアマッチング", icon: "Brain" },
  { key: "free-input", label: "自由入力", icon: "Keyboard" },
] as const;

export const MAX_HEARTS = 5;
export const HEART_REFILL_MINUTES = 20;

export type XLangState = {
  xp: number;
  streak: number;
  lastStudyDate: string | null;
  crownLevel: number;
  difficulty: number;
  accuracy: number;
  reviewedCount: number;
  nextReviewDate: string;
  intervalDays: number;
  completedLessons: number;
  /** lessonId -> クラウン数(0-3) */
  lessonCrowns: Record<string, number>;
  hearts: number;
  heartsUpdatedAt: number;
  dailyGoal: number;
  dailyXp: number;
  dailyDate: string;
  gems: number;
  weakWords: string[];
};

const DEFAULT_STATE: XLangState = {
  xp: 0,
  streak: 0,
  lastStudyDate: null,
  crownLevel: 0,
  difficulty: 1,
  accuracy: 0,
  reviewedCount: 0,
  nextReviewDate: localDateStr(),
  intervalDays: 1,
  completedLessons: 0,
  lessonCrowns: {},
  hearts: MAX_HEARTS,
  heartsUpdatedAt: Date.now(),
  dailyGoal: 30,
  dailyXp: 0,
  dailyDate: localDateStr(),
  gems: 0,
  weakWords: [],
};

function storageKey(userId: string) {
  return `xlang.progress.${userId}`;
}

/** 時間経過でハートを回復し、日付が変わったら今日のXPをリセット */
export function refreshState(state: XLangState): XLangState {
  const next = { ...state };
  const today = localDateStr();
  if (next.dailyDate !== today) {
    next.dailyDate = today;
    next.dailyXp = 0;
  }
  if (next.hearts < MAX_HEARTS) {
    const mins = (Date.now() - next.heartsUpdatedAt) / 60000;
    const gained = Math.floor(mins / HEART_REFILL_MINUTES);
    if (gained > 0) {
      next.hearts = Math.min(MAX_HEARTS, next.hearts + gained);
      next.heartsUpdatedAt =
        next.hearts >= MAX_HEARTS
          ? Date.now()
          : next.heartsUpdatedAt + gained * HEART_REFILL_MINUTES * 60000;
    }
  }
  return next;
}

export function loadXLangState(userId: string): XLangState {
  try {
    const saved = window.localStorage.getItem(storageKey(userId));
    if (saved) return refreshState({ ...DEFAULT_STATE, ...JSON.parse(saved) });
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_STATE };
}

export function saveXLangState(userId: string, state: XLangState) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loseHeart(state: XLangState): XLangState {
  return {
    ...state,
    hearts: Math.max(0, state.hearts - 1),
    heartsUpdatedAt: state.hearts === MAX_HEARTS ? Date.now() : state.heartsUpdatedAt,
  };
}

export function refillHearts(state: XLangState): XLangState {
  return { ...state, hearts: MAX_HEARTS, heartsUpdatedAt: Date.now() };
}

/** レッスン完了時の進捗更新 */
export function finishLesson(
  state: XLangState,
  opts: { lessonId: string; correct: number; total: number; perfect: boolean },
): { state: XLangState; gainedXp: number; leveledUp: boolean } {
  const today = localDateStr();
  const studiedYesterday = state.lastStudyDate === addDaysStr(new Date(), -1);
  const sameDay = state.lastStudyDate === today;
  const rate = opts.total > 0 ? (opts.correct / opts.total) * 100 : 0;
  const gainedXp = 10 + Math.round(rate / 10) + (opts.perfect ? 5 : 0);
  const prevCrown = state.lessonCrowns[opts.lessonId] ?? 0;
  const nextCrown = rate >= 60 ? Math.min(3, prevCrown + 1) : prevCrown;
  const nextInterval =
    rate >= 80 ? Math.min(30, Math.max(1, Math.round(state.intervalDays * 2.2))) : 1;
  const nextAccuracy =
    Math.round(
      ((state.accuracy * state.reviewedCount + rate) / Math.max(1, state.reviewedCount + 1)) * 10,
    ) / 10;

  const next: XLangState = {
    ...state,
    xp: state.xp + gainedXp,
    dailyXp: (state.dailyDate === today ? state.dailyXp : 0) + gainedXp,
    dailyDate: today,
    gems: state.gems + (opts.perfect ? 3 : 1),
    streak: sameDay
      ? state.streak
      : studiedYesterday || !state.lastStudyDate
        ? state.streak + 1
        : 1,
    lastStudyDate: today,
    lessonCrowns: { ...state.lessonCrowns, [opts.lessonId]: nextCrown },
    crownLevel: Object.values({ ...state.lessonCrowns, [opts.lessonId]: nextCrown }).reduce(
      (a, b) => a + b,
      0,
    ),
    difficulty: Math.min(
      5,
      Math.max(1, rate >= 80 ? state.difficulty + 1 : rate < 55 ? state.difficulty - 1 : state.difficulty),
    ),
    accuracy: nextAccuracy,
    reviewedCount: state.reviewedCount + 1,
    nextReviewDate: addDaysStr(new Date(), nextInterval),
    intervalDays: nextInterval,
    completedLessons: state.completedLessons + (prevCrown === 0 ? 1 : 0),
  };
  return { state: next, gainedXp, leveledUp: nextCrown > prevCrown };
}

/** 従来API互換（簡易記録） */
export function completeXLangLesson(state: XLangState, isCorrect: boolean): XLangState {
  return finishLesson(state, {
    lessonId: "quick",
    correct: isCorrect ? 1 : 0,
    total: 1,
    perfect: isCorrect,
  }).state;
}

export function speak(text: string, rate = 0.95) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}
