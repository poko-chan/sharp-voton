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

export type LookupMode = "on" | "off";
export type WebMode = "auto" | "on";
export type Quality = "flash" | "think" | "pro";
export type Length = "short" | "normal" | "deep";
export type Tone = "friendly" | "calm" | "coach";

export const QUALITY_DEFS = [
  { key: "flash", label: "Flash", desc: "すぐ答える。日常の質問向け。" },
  { key: "think", label: "Think", desc: "考えてから答える。説明・相談向け。" },
  { key: "pro", label: "Pro", desc: "深く考えて検証。難問・長文向け。" },
] as const;

export type ChatPrefs = {
  /** 学習データを見るかどうか（オン／オフ） */
  lookup: LookupMode;
  /** Web検索（on=常に検索 / auto=AIが必要と判断したときだけ） */
  web: WebMode;
  /** 回答の品質モード */
  quality: Quality;
  /** 回答の長さ */
  length: Length;
  /** 口調 */
  tone: Tone;
  /** 答えを先に出す（オフだとヒント中心） */
  directAnswer: boolean;
  /** 思考プロセスを自動で開く */
  autoOpenThinking: boolean;
  /** 出典リンクを回答の下に付ける */
  showSources: boolean;
  /** 参照を許可する情報 */
  scopes: ScopeKey[];
};

export const DEFAULT_PREFS: ChatPrefs = {
  lookup: "on",
  web: "auto",
  quality: "think",
  length: "normal",
  tone: "friendly",
  directAnswer: false,
  autoOpenThinking: true,
  showSources: true,
  scopes: ALL_SCOPES,
};


const LS = "ai.tutor.prefs.v3";

export function loadPrefs(): ChatPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(LS);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<ChatPrefs>;
    return {
      ...DEFAULT_PREFS,
      ...p,
      lookup: p.lookup === "off" ? "off" : "on",
      web: p.web === "on" ? "on" : "auto",
      quality: p.quality === "flash" || p.quality === "pro" ? p.quality : "think",
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

/** 事実確認のためにWeb検索したほうがよい質問かを判定する */
export function needsWebSearch(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  // 自分のデータ・記録・計画の話は検索しない
  if (/(記録して|登録して|目標を|勉強計画|振り返|私の|自分の|ぼくの|僕の)/.test(t) && !/(とは|意味|調べ|最新|ニュース|違い)/.test(t)) return false;
  // 計算・添削など、その場で解ける依頼は検索しない
  if (/(計算して|解いて|添削|翻訳して|要約して|作文|例文を作)/.test(t)) return false;
  return (
    /(とは|意味|由来|違い|なぜ|誰|いつ|どこ|年号|出典|根拠|最新|今年|去年|ニュース|統計|データ|入試|倍率|日程|要項|定義|公式|法律|制度|ランキング|価格|相場|調べて|検索|事実|正しい|本当)/.test(t) ||
    (/[A-Za-z]{4,}/.test(t) && /(について|解説|教えて)/.test(t))
  );
}

const STOP_WORDS =
  /(教えて|説明して|解説して|調べて|検索して|知りたい|ください|下さい|お願いします|ですか|でしょうか|かな|なんですか|について|に関して|とは何|くわしく|詳しく|簡単に|わかりやすく|[。、？?！!]|^ねえ|^ちょっと)/g;

/** 検索クエリを質問文から作る（余計な依頼語を削り、キーワード中心にする） */
export function buildSearchQuery(text: string): string {
  const cleaned = text
    .replace(/\r?\n+/g, " ")
    .replace(STOP_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
  const q = cleaned.length >= 2 ? cleaned : text.trim();
  return q.slice(0, 120);
}

