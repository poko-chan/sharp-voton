// AIチャットの「どう考えるか・何を見るか」の設定をまとめて管理する。
import {
  Brain, BookOpen, Target, CalendarDays, NotebookTabs, Database, ChartNoAxesColumnIncreasing,
} from "lucide-react";

export const SCOPE_DEFS = [
  { key: "study", label: "学習時間と教科", desc: "直近30日の学習時間、活動日数、よく勉強した教科", icon: ChartNoAxesColumnIncreasing },
  { key: "goals", label: "学習目標", desc: "進行中の目標、目標時間、現在の進み具合", icon: Target },
  { key: "weak", label: "苦手な内容", desc: "間違いが多い単元やトピック", icon: Brain },
  { key: "notes", label: "学習記録の内容", desc: "最近勉強した内容や自分で残したメモ", icon: NotebookTabs },
  { key: "exams", label: "試験とやること", desc: "これからの試験日程と未完了タスク", icon: CalendarDays },
  { key: "flashcards", label: "暗記カード", desc: "復習回数や忘れやすいカード", icon: BookOpen },
  { key: "markon", label: "Markon演習", desc: "最近取り組んだパックと挑戦回数", icon: Database },
] as const;

export type ScopeKey = (typeof SCOPE_DEFS)[number]["key"];
export const ALL_SCOPES = SCOPE_DEFS.map((s) => s.key) as ScopeKey[];

export type LookupMode = "auto" | "always" | "never";
export type Length = "short" | "normal" | "deep";
export type Tone = "friendly" | "calm" | "coach";

export type ChatPrefs = {
  /** 学習データを見るかどうか */
  lookup: LookupMode;
  /** 推論の回数（1=即答, 2=見直し, 3=じっくり検討） */
  passes: 1 | 2 | 3;
  /** 回答の長さ */
  length: Length;
  /** 口調 */
  tone: Tone;
  /** 答えを先に出す（オフだとヒント中心） */
  directAnswer: boolean;
  /** 思考プロセスを自動で開く */
  autoOpenThinking: boolean;
  /** 参照を許可する情報 */
  scopes: ScopeKey[];
};

export const DEFAULT_PREFS: ChatPrefs = {
  lookup: "auto",
  passes: 1,
  length: "normal",
  tone: "friendly",
  directAnswer: false,
  autoOpenThinking: true,
  scopes: ALL_SCOPES,
};

const LS = "ai.tutor.prefs.v2";

export function loadPrefs(): ChatPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(LS);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<ChatPrefs>;
    return {
      ...DEFAULT_PREFS,
      ...p,
      scopes: Array.isArray(p.scopes) ? ALL_SCOPES.filter((k) => p.scopes!.includes(k)) : ALL_SCOPES,
    };
  } catch { return DEFAULT_PREFS; }
}

export function savePrefs(p: ChatPrefs) {
  try { window.localStorage.setItem(LS, JSON.stringify(p)); } catch { /* noop */ }
}

/** 質問文から、どの学習データが必要かを推定する */
export function relevantScopes(text: string, allowed: ScopeKey[]): ScopeKey[] {
  const rules: Record<ScopeKey, RegExp> = {
    study: /(勉強時間|学習時間|勉強量|学習状況|最近|科目|教科|頑張|進捗|振り返)/,
    goals: /(目標|ゴール|達成|進捗|計画|プラン)/,
    weak: /(苦手|弱点|間違|ミス|復習|伸ば)/,
    notes: /(学習記録|勉強記録|メモ|最近|振り返)/,
    exams: /(試験|テスト|受験|課題|タスク|予定|期限|勉強計画)/,
    flashcards: /(暗記|カード|覚え|単語|復習)/,
    markon: /(Markon|マクロン|演習|パック|正答|成績)/i,
  };
  const personal = /(私|自分|ぼく|僕|わたし|おすすめ|何をすべき|どう勉強|アドバイス)/.test(text);
  return allowed.filter((key) => rules[key].test(text) || (personal && ["study", "goals", "weak"].includes(key)));
}

export const LENGTH_RULE: Record<Length, string> = {
  short: "全体で150字以内。要点だけを短く。箇条書き中心。",
  normal: "300〜600字。結論→理由→次の一歩の順に。",
  deep: "600〜1200字。前提の整理、具体例、つまずきやすい点まで丁寧に。",
};

export const TONE_RULE: Record<Tone, string> = {
  friendly: "親しみやすく、やさしい言葉づかい。",
  calm: "落ち着いた、事実重視の説明口調。感情表現は控えめに。",
  coach: "コーチのように前向きに背中を押す。行動を1つ提案する。",
};
