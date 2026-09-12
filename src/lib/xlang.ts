import { addDaysStr, localDateStr } from "@/lib/date";

export const XLANG_FORMATS = [
  { key: "word-bank", label: "並び替え", icon: "Blocks" },
  { key: "choice", label: "選択式", icon: "ListChecks" },
  { key: "listening", label: "リスニング", icon: "Headphones" },
  { key: "speaking", label: "スピーキング", icon: "Mic2" },
  { key: "matching", label: "ペアマッチング", icon: "Brain" },
  { key: "free-input", label: "自由入力", icon: "Keyboard" },
] as const;

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
};

function storageKey(userId: string) {
  return `xlang.progress.${userId}`;
}

export function loadXLangState(userId: string): XLangState {
  try {
    const saved = window.localStorage.getItem(storageKey(userId));
    if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
  } catch {
  }
  return DEFAULT_STATE;
}

export function saveXLangState(userId: string, state: XLangState) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
  }
}

export function completeXLangLesson(state: XLangState, isCorrect: boolean): XLangState {
  const today = localDateStr();
  const studiedYesterday = state.lastStudyDate === addDaysStr(new Date(), -1);
  const sameDay = state.lastStudyDate === today;
  const nextInterval = isCorrect
    ? Math.min(30, Math.max(1, Math.round(state.intervalDays * 2.2)))
    : 1;
  const nextAccuracy = Math.round(
    ((state.accuracy * state.reviewedCount + (isCorrect ? 100 : 0)) /
      Math.max(1, state.reviewedCount + 1)) * 10,
  ) / 10;

  return {
    ...state,
    xp: state.xp + (isCorrect ? 20 : 8),
    streak: sameDay ? state.streak : studiedYesterday || !state.lastStudyDate ? state.streak + 1 : 1,
    lastStudyDate: today,
    crownLevel: Math.min(5, Math.floor((state.completedLessons + 1) / 3)),
    difficulty: Math.min(5, Math.max(1, nextAccuracy >= 80 ? state.difficulty + 1 : nextAccuracy < 55 ? state.difficulty - 1 : state.difficulty)),
    accuracy: nextAccuracy,
    reviewedCount: state.reviewedCount + 1,
    nextReviewDate: addDaysStr(new Date(), nextInterval),
    intervalDays: nextInterval,
    completedLessons: state.completedLessons + 1,
  };
}
