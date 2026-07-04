// Chrome Built-in AI (Gemini Nano) を使ったクライアント側タスク
// AI Gateway を使わない。呼び出し側はブラウザ非対応時のエラーをUIに表示する。
import { createChromeAiSession, extractJSON } from "@/lib/chrome-ai";

export type GradeResult = {
  score: number; rate: number; feedback: string; good: string[]; improve: string[];
};

export async function nanoGradeWritten(input: {
  prompt: string; answer: string; model_answer?: string; max_points?: number;
}): Promise<GradeResult> {
  const max = input.max_points ?? 10;
  const sys = `あなたは厳格だが公平な採点者です。与えられた問題と模範解答に対し、生徒の解答を採点します。
必ずJSONだけを出力してください。他の文字は不要。
形式: {"score": 0-${max}, "rate": 0-100, "feedback": "200字以内の短評", "good": ["..."], "improve": ["..."]}`;
  const user = `【問題】${input.prompt}
【模範解答】${input.model_answer ?? "（明示なし。一般的な妥当性で判断）"}
【満点】${max}
【生徒の解答】${input.answer}`;
  const s = await createChromeAiSession({ system: sys, temperature: 0.2 });
  try {
    const raw = await s.prompt(user);
    const parsed = extractJSON<any>(raw);
    return {
      score: Math.max(0, Math.min(max, Number(parsed.score) || 0)),
      rate: Math.max(0, Math.min(100, Number(parsed.rate) || 0)),
      feedback: String(parsed.feedback ?? ""),
      good: Array.isArray(parsed.good) ? parsed.good.map(String) : [],
      improve: Array.isArray(parsed.improve) ? parsed.improve.map(String) : [],
    };
  } finally { s.destroy(); }
}

export async function nanoReflectDaily(input: {
  date: string; segments: string; studyTotalMin: number; subjects: string;
}): Promise<string> {
  const sys = `あなたは優しい学習コーチ。ユーザーの1日を200字以内で振り返ります。共感→気づき→明日の小さな提案の順。マークダウン記号は使わない、ふつうの文。`;
  const user = `日付: ${input.date}

1日の予定:
${input.segments || "（記録なし）"}

勉強合計: ${input.studyTotalMin}分 (${input.subjects || "未指定"})`;
  const s = await createChromeAiSession({ system: sys, temperature: 0.7 });
  try { return await s.prompt(user); } finally { s.destroy(); }
}