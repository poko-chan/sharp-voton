// 端末内 AI（小さいモデル）でも賢く答えさせるための共通ロジック。
//  - 用途ごとの生成パラメータ（プリセット）
//  - 会話履歴の「文字数予算」管理（小さいモデルは長い文脈で崩れるため）
//  - JSON 出力の自動修復リトライ
//  - 複数回サンプリングして中央値を取る「自己一貫性」採点

export type AiTask =
  | "chat"       // 会話・説明
  | "reasoning"  // 段取り・分析
  | "grading"    // 採点（ぶれさせない）
  | "json"       // 構造化出力
  | "creative";  // 発想・言い換え

export type GenParams = {
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
};

export const TASK_PRESETS: Record<AiTask, GenParams> = {
  chat:      { temperature: 0.55, topP: 0.9,  maxTokens: 1400, frequencyPenalty: 0.5, presencePenalty: 0.3 },
  reasoning: { temperature: 0.3,  topP: 0.85, maxTokens: 900,  frequencyPenalty: 0.6, presencePenalty: 0.3 },
  grading:   { temperature: 0.15, topP: 0.8,  maxTokens: 700,  frequencyPenalty: 0.4, presencePenalty: 0.2 },
  json:      { temperature: 0.1,  topP: 0.8,  maxTokens: 700,  frequencyPenalty: 0.2, presencePenalty: 0.1 },
  creative:  { temperature: 0.85, topP: 0.95, maxTokens: 1200, frequencyPenalty: 0.7, presencePenalty: 0.6 },
};

export function paramsFor(task: AiTask, override?: Partial<GenParams>): GenParams {
  return { ...TASK_PRESETS[task], ...(override ?? {}) };
}

/** 長すぎるテキストを、頭とお尻を残して省略する（真ん中を落とす） */
export function clampText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.65);
  const tail = max - head - 10;
  return `${t.slice(0, head)}\n…（中略）…\n${t.slice(-tail)}`;
}

export type HistoryTurn = { role: "user" | "assistant"; content: string };

/**
 * 会話履歴を「直近は丸ごと・古いものは1行要約」に圧縮する。
 * 小さいモデルは文脈が長いほど精度が落ちるので、文字数予算を必ず守る。
 */
export function buildBudgetedHistory(
  turns: HistoryTurn[],
  opts?: { budget?: number; keepRecent?: number },
): string {
  const budget = opts?.budget ?? 4000;
  const keepRecent = opts?.keepRecent ?? 6;

  const recent = turns.slice(-keepRecent);
  const older = turns.slice(0, Math.max(0, turns.length - keepRecent));

  const label = (r: HistoryTurn["role"]) => (r === "user" ? "ユーザー" : "アシスタント");
  const lines: string[] = [];

  if (older.length) {
    const digest = older
      .slice(-12)
      .map((m) => `- ${label(m.role)}: ${m.content.replace(/\s+/g, " ").slice(0, 90)}`)
      .join("\n");
    lines.push(`【これまでの流れ（要約）】\n${digest}`);
  }

  // 直近は新しいものを優先して予算内に詰める
  const body: string[] = [];
  let used = lines.join("\n").length;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]!;
    const share = i === recent.length - 1 ? 1800 : 700; // 最新の発言は多めに残す
    const piece = `${label(m.role)}: ${clampText(m.content, share)}`;
    if (used + piece.length > budget && body.length > 0) break;
    body.unshift(piece);
    used += piece.length;
  }

  return [...lines, ...body].join("\n\n");
}

/** 箇条書きの事実リストを、重複を除いて短くまとめる */
export function compactFacts(facts: Array<string | null | undefined>, max = 14): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of facts) {
    const t = (f ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(`- ${clampText(t, 160)}`);
    if (out.length >= max) break;
  }
  return out.join("\n");
}

type JsonCapableSession = {
  promptJSON: <T = unknown>(text: string) => Promise<T>;
  prompt: (text: string) => Promise<string>;
};

/**
 * JSON 生成を、失敗したら「形式を直して」と言い直して再挑戦する。
 * validate が false を返した場合も作り直す。
 */
export async function promptJSONRobust<T>(
  session: JsonCapableSession,
  prompt: string,
  validate: (v: any) => boolean,
  tries = 3,
): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 0; i < tries; i++) {
    const p =
      i === 0
        ? prompt
        : `${prompt}\n\n※前回の出力は形式が正しくありませんでした。前置き・説明・コードフェンスを書かず、指定どおりの JSON オブジェクト1個だけを出力してください。`;
    try {
      const v = await session.promptJSON<T>(p);
      if (validate(v)) return v;
      lastErr = new Error("形式が不正です");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AIから正しい形式の結果を得られませんでした");
}

/** 数値の中央値（採点のブレを抑えるのに使う） */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/** 同じ処理を n 回試して、成功した結果だけ集める（失敗は無視） */
export async function sampleN<T>(n: number, run: (i: number) => Promise<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    try { out.push(await run(i)); } catch { /* 1回失敗しても続行 */ }
  }
  return out;
}
