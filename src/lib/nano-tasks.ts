// 端末内 AI（Gemini Nano / WebLLM / Ollama）を使ったタスク。
// AI Gateway は使わない。呼び出し側はブラウザ非対応時のエラーをUIに表示する。
import { createAiSession, extractJSON } from "@/lib/ai-provider";
import { promptJSONRobust, median, sampleN, clampText } from "@/lib/ai-quality";

export type GradeResult = {
  score: number; rate: number; feedback: string; good: string[]; improve: string[];
  /** 採点観点（ルーブリック）。空のこともある */
  rubric?: string[];
};

/** 模範解答から採点観点（ルーブリック）を先に作る。観点があると採点が安定する。 */
async function buildRubric(input: { prompt: string; model_answer?: string }): Promise<string[]> {
  const s = await createAiSession({
    task: "json",
    system:
      "あなたは記述式問題の採点基準を作る専門家です。" +
      'JSONのみを出力します。形式: {"points": ["観点1", "観点2", "観点3"]}',
  });
  try {
    const out = await promptJSONRobust<{ points: string[] }>(
      s,
      `次の問題について、採点で必ず見るべき観点を3〜5個、短い日本語で作ってください。
【問題】${clampText(input.prompt, 1200)}
【模範解答】${clampText(input.model_answer ?? "（明示なし）", 1200)}`,
      (v) => Array.isArray(v?.points) && v.points.length > 0,
      2,
    );
    return out.points.map(String).slice(0, 5);
  } catch {
    return [];
  } finally {
    s.destroy();
  }
}

export async function nanoGradeWritten(input: {
  prompt: string; answer: string; model_answer?: string; max_points?: number;
  /** 精度重視: 複数回採点して中央値を取る（既定 true） */
  careful?: boolean;
  onProgress?: (partial: string, chars: number) => void;
}): Promise<GradeResult> {
  const max = input.max_points ?? 10;
  const careful = input.careful !== false;

  const rubric = await buildRubric(input);

  const sys = `あなたは厳格だが公平な採点者です。生徒の解答を、採点観点にそって1つずつ確認してから点数を決めます。
守ること:
- 模範解答と表現が違っても、内容が合っていれば正解にする
- 書かれていないことを想像して加点しない
- 講評は生徒に直接語りかける、やさしく具体的な日本語にする
必ずJSONだけを出力してください。他の文字は不要。
形式: {"score": 0-${max}, "rate": 0-100, "feedback": "200字以内の短評", "good": ["..."], "improve": ["..."]}`;

  const user = `【問題】${clampText(input.prompt, 1500)}
【模範解答】${clampText(input.model_answer ?? "（明示なし。一般的な妥当性で判断）", 1500)}
【採点観点】${rubric.length ? rubric.map((r, i) => `\n${i + 1}. ${r}`).join("") : "（自分で妥当な観点を立てる）"}
【満点】${max}
【生徒の解答】${clampText(input.answer, 2500)}`;

  const gradeOnce = async (attempt: number): Promise<GradeResult> => {
    const s = await createAiSession({ task: "grading", system: sys });
    try {
      const raw =
        attempt === 0 && input.onProgress
          ? await s.promptStreaming(user, (p) => input.onProgress?.(p, p.length))
          : await s.prompt(user);
      const parsed = extractJSON<any>(raw);
      if (typeof parsed?.score !== "number" && typeof parsed?.score !== "string") {
        throw new Error("採点結果の形式が不正です");
      }
      return {
        score: Math.max(0, Math.min(max, Number(parsed.score) || 0)),
        rate: Math.max(0, Math.min(100, Number(parsed.rate) || 0)),
        feedback: String(parsed.feedback ?? ""),
        good: Array.isArray(parsed.good) ? parsed.good.map(String) : [],
        improve: Array.isArray(parsed.improve) ? parsed.improve.map(String) : [],
      };
    } finally { s.destroy(); }
  };

  const first = await gradeOnce(0);
  if (!careful) return { ...first, rubric };

  // 精度重視: もう1回だけ採点し、点数は中央値、講評は情報量の多い方を採用する
  const more = await sampleN(1, () => gradeOnce(1));
  const all = [first, ...more];
  const score = median(all.map((r) => r.score));
  const rate = median(all.map((r) => (r.rate || Math.round((r.score / max) * 100))));
  const best = all.reduce((a, b) => (b.feedback.length > a.feedback.length ? b : a), first);
  const uniq = (xs: string[]) => Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean))).slice(0, 5);

  return {
    score,
    rate,
    feedback: best.feedback,
    good: uniq(all.flatMap((r) => r.good)),
    improve: uniq(all.flatMap((r) => r.improve)),
    rubric,
  };
}
