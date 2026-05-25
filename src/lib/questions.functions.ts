import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  topic: z.string().min(1).max(500),
  format: z.enum(["flashcard", "multiple_choice", "exam"]),
  count: z.number().int().min(1).max(100),
});

type GenQ = { question: string; options?: string[]; answer: string; explanation: string };

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const candidates = [raw.indexOf("{"), raw.indexOf("[")].filter((i) => i >= 0);
  if (candidates.length === 0) throw new Error("AI応答にJSONが含まれていません");
  const start = Math.min(...candidates);
  return JSON.parse(raw.slice(start));
}

function formatHint(format: "flashcard" | "multiple_choice" | "exam") {
  return format === "flashcard"
    ? "フラッシュカード形式（短い質問+短い答え）。optionsは空配列。"
    : format === "multiple_choice"
    ? "4択問題。optionsに必ず4つ（紛らわしい誤答3つ+正答1つ）。answerはoptionsの正解の文字列をそのまま。"
    : "記述式の試験問題。optionsは空配列。answerに模範解答。";
}

const RULES = `絶対ルール:
- 問題文(question)の中に答えや答えのヒントを書かない。
- 「〇〇は△△である。〇〇は何か」のように答えを問題文に含めない。
- 4択の場合、選択肢の長さや言い回しを揃え、正答だけ明らかに違うものにしない。
- 解説(explanation)は1〜3文で簡潔に。`;

async function callAI(prompt: string, opts?: { model?: string; jsonMode?: boolean }): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY が設定されていません");
  const body: any = {
    model: opts?.model ?? "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "あなたは日本の学習教材作成の専門家です。指定形式の有効なJSONのみで応答します。説明文や前置きは一切書きません。" },
      { role: "user", content: prompt },
    ],
  };
  if (opts?.jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AIゲートウェイエラー (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

const JSON_SHAPE = `以下のJSON形式で**それのみ**返答:
{ "questions": [ { "question": "...", "options": ["A","B","C","D"], "answer": "...", "explanation": "..." } ] }`;

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const prompt = `日本語で「${data.topic}」に関する問題を${data.count}問作成。
形式: ${formatHint(data.format)}
${RULES}
${JSON_SHAPE}`;
    const text = await callAI(prompt);
    let parsed: { questions: GenQ[] };
    try { parsed = extractJson(text); } catch (e: any) { throw new Error(`AI応答の解析に失敗: ${e.message}`); }
    const questions = (parsed.questions ?? []).slice(0, data.count);
    if (questions.length === 0) throw new Error("問題が生成されませんでした");

    const { supabase, userId } = context;
    const rows = questions.map((q) => ({
      user_id: userId,
      topic: data.topic,
      format: data.format,
      question: q.question,
      options: q.options ?? [],
      answer: q.answer,
      explanation: q.explanation ?? "",
    }));
    const { data: inserted, error } = await supabase.from("questions").insert(rows).select("*");
    if (error) throw error;
    return { questions: inserted };
  });

// 類題生成: 間違えた問題を元に、似ているが異なる新しい問題を作る
export const generateSimilarFromWrong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ topic: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: wrongs, error: fErr } = await supabase
      .from("questions")
      .select("*")
      .eq("topic", data.topic)
      .eq("was_wrong", true)
      .order("created_at", { ascending: false })
      .limit(10);
    if (fErr) throw fErr;
    if (!wrongs || wrongs.length === 0) throw new Error("このトピックの間違えた問題がありません");

    // 弱点を2倍量で補強
    const count = Math.min(20, Math.max(2, wrongs.length * 2));
    const fmt = (wrongs[0].format ?? "multiple_choice") as "flashcard" | "multiple_choice" | "exam";
    const examples = wrongs.map((w, i) => `${i + 1}. 間違えた問題: ${w.question}\n   正解: ${w.answer}`).join("\n");

    const prompt = `あなたは生徒の弱点を分析する学習コーチです。
トピック: 「${data.topic}」
生徒が間違えた問題と正解一覧:
${examples}

これらの間違いから生徒の理解不足のポイントを推測し、**同じ概念・知識を別の角度から問う新しい問題**を${count}問作成してください。元の問題のコピーや言い換えではなく、類似テーマの異なる問題にすること。
形式: ${formatHint(fmt)}
${RULES}
${JSON_SHAPE}`;

    const text = await callAI(prompt);
    let parsed: { questions: GenQ[] };
    try { parsed = extractJson(text); } catch (e: any) { throw new Error(`AI応答の解析に失敗: ${e.message}`); }
    const questions = (parsed.questions ?? []).slice(0, count);
    if (questions.length === 0) throw new Error("類題が生成されませんでした");

    const rows = questions.map((q) => ({
      user_id: userId,
      topic: data.topic,
      format: fmt,
      question: q.question,
      options: q.options ?? [],
      answer: q.answer,
      explanation: q.explanation ?? "",
    }));
    const { data: inserted, error } = await supabase.from("questions").insert(rows).select("*");
    if (error) throw error;
    return { questions: inserted };
  });

export const recordAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), correct: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error: fetchErr } = await supabase
      .from("questions")
      .select("attempts")
      .eq("id", data.id)
      .single();
    if (fetchErr) throw fetchErr;
    const { error } = await supabase
      .from("questions")
      .update({
        attempts: (row?.attempts ?? 0) + 1,
        was_wrong: !data.correct,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const gradeWrittenAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      userAnswer: z.string().min(1).max(5000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q, error: fErr } = await supabase
      .from("questions").select("*").eq("id", data.id).single();
    if (fErr) throw fErr;

    const prompt = `あなたは厳格だが公平な採点者です。次の記述問題を採点してください。
問題: ${q.question}
模範解答: ${q.answer}
${q.explanation ? `解説: ${q.explanation}\n` : ""}生徒の解答: ${data.userAnswer}

採点基準: 模範解答の要点を捉えているか、論理性、用語の正確さ。
以下のJSON形式で**それのみ**返答:
{ "score": 0-100の整数, "correct": true/false (70点以上ならtrue), "feedback": "良かった点と改善点を簡潔に2-3文で" }`;
    const text = await callAI(prompt);
    let parsed: { score: number; correct: boolean; feedback: string };
    try { parsed = extractJson(text); } catch (e: any) { throw new Error(`採点失敗: ${e.message}`); }

    await supabase.from("questions").update({
      attempts: (q.attempts ?? 0) + 1,
      was_wrong: !parsed.correct,
    }).eq("id", data.id);

    // 採点履歴を保存
    await (supabase as any).from("grading_history").insert({
      user_id: userId,
      question_id: data.id,
      user_answer: data.userAnswer,
      score: parsed.score,
      correct: parsed.correct,
      feedback: parsed.feedback,
    });

    return parsed;
  });

export const deleteGradingRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("grading_history").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteGradingHistoryForQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ questionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("grading_history").delete().eq("question_id", data.questionId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // 関連する採点履歴も削除
    await (context.supabase as any).from("grading_history").delete().eq("question_id", data.id);
    const { error } = await context.supabase.from("questions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteQuestionsByTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ topic: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    // 削除対象の問題IDを取得して、関連採点履歴も削除
    const { data: qs } = await context.supabase
      .from("questions").select("id").eq("topic", data.topic).eq("user_id", context.userId);
    const ids = (qs ?? []).map((r: any) => r.id);
    if (ids.length > 0) {
      await (context.supabase as any).from("grading_history").delete().in("question_id", ids);
    }
    const { error } = await context.supabase
      .from("questions").delete().eq("topic", data.topic).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true, deleted: ids.length };
  });

export const clearWrongByTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ topic: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("questions").update({ was_wrong: false })
      .eq("topic", data.topic).eq("user_id", context.userId).eq("was_wrong", true);
    if (error) throw error;
    return { ok: true };
  });

// 試験予想問題の作成
const ExamPaperSchema = z.object({
  subject: z.string().min(1).max(200),
  scope: z.string().min(1).max(2000),
  durationMinutes: z.number().int().min(5).max(600),
  difficulty: z.enum(["easy", "normal", "hard"]),
  questionCount: z.number().int().min(1).max(100),
  formats: z.array(z.enum(["multiple_choice", "exam", "flashcard"])).min(1),
  notes: z.string().max(2000).optional(),
});

export const generateExamPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ExamPaperSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const diffLabel = data.difficulty === "easy" ? "やや易しめ" : data.difficulty === "hard" ? "難関レベル" : "標準レベル";
    const fmts = data.formats.map(formatHint).join(" / ");

    const prompt = `あなたはベテラン講師。次の条件で「試験予想問題」を作成してください。
科目/分野: ${data.subject}
出題範囲・内容: ${data.scope}
想定試験時間: ${data.durationMinutes}分
難易度: ${diffLabel}
問題数: ${data.questionCount}問
形式の混在: ${fmts}
${data.notes ? `補足要望: ${data.notes}` : ""}

要件:
- 試験時間に対して適切な分量・配分。
- 形式は指定された中から問題ごとに最適なものを選ぶ。
- 形式は各問の "format" フィールドに "multiple_choice" | "exam" | "flashcard" で明記。
- multiple_choice は options を4つ。それ以外は options を空配列。
${RULES}

以下のJSON形式で**それのみ**返答:
{ "questions": [ { "format": "...", "question": "...", "options": ["A","B","C","D"], "answer": "...", "explanation": "..." } ] }`;

    const text = await callAI(prompt, { model: "google/gemini-2.5-pro", jsonMode: true });
    let parsed: { questions: (GenQ & { format?: string })[] };
    try { parsed = extractJson(text); } catch (e: any) {
      console.error("Exam paper parse failed. Raw:", text?.slice(0, 500));
      throw new Error(`AI応答の解析に失敗しました。問題数を減らすか、もう一度お試しください。 (${e.message})`);
    }
    const questions = (parsed.questions ?? []).slice(0, data.questionCount);
    if (questions.length === 0) throw new Error("問題が生成されませんでした");

    const topic = `【試験予想】${data.subject} (${data.durationMinutes}分)`;
    const allowed = new Set(data.formats);
    const rows = questions.map((q) => {
      const f = (q.format && allowed.has(q.format as any) ? q.format : data.formats[0]) as
        "flashcard" | "multiple_choice" | "exam";
      return {
        user_id: userId,
        topic,
        format: f,
        question: q.question,
        options: q.options ?? [],
        answer: q.answer,
        explanation: q.explanation ?? "",
      };
    });
    const { data: inserted, error } = await supabase.from("questions").insert(rows).select("*");
    if (error) throw error;
    return { questions: inserted, topic };
  });

// 試験モード：全回答をまとめてAIに採点させる
const ExamGradeSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    userAnswer: z.string().max(5000),
  })).min(1).max(200),
});

export const gradeExamSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ExamGradeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ids = data.answers.map((a) => a.questionId);
    const { data: qs, error } = await supabase
      .from("questions").select("*").in("id", ids);
    if (error) throw error;
    const byId = new Map<string, any>((qs ?? []).map((q: any) => [q.id, q]));

    const items = data.answers.map((a, idx) => {
      const q = byId.get(a.questionId);
      return q
        ? `【問${idx + 1}】(id=${q.id})\n形式: ${q.format}\n問題: ${q.question}\n${q.options && q.options.length ? `選択肢: ${(q.options as string[]).join(" / ")}\n` : ""}模範解答: ${q.answer}\n${q.explanation ? `解説: ${q.explanation}\n` : ""}生徒の解答: ${a.userAnswer || "（無回答）"}`
        : `【問${idx + 1}】不明`;
    }).join("\n\n");

    const prompt = `あなたはベテラン採点者です。次の試験の解答を採点してください。
**判定ルール**:
- 全角/半角・空白・大文字小文字の違いは正解とみなす。
- 表記揺れ・別解・意味が同じ言い換えは正解とみなす（例: 「源頼朝」と「みなもとのよりとも」、漢字/ひらがな同義語）。
- 4択や短答は完全一致でなくても、答えの本質が一致すれば正解。
- 記述問題は要点を捉えていれば部分点を与える。

${items}

以下のJSON形式で**それのみ**返答:
{
  "results": [
    { "id": "問題ID(uuid)", "score": 0-100の整数, "correct": true/false, "feedback": "短い講評(1-2文)" }
  ]
}`;

    const text = await callAI(prompt, { model: "google/gemini-2.5-pro", jsonMode: true });
    let parsed: { results: { id: string; score: number; correct: boolean; feedback: string }[] };
    try { parsed = extractJson(text); } catch (e: any) {
      console.error("Exam grading parse failed:", text?.slice(0, 500));
      throw new Error(`採点結果の解析に失敗: ${e.message}`);
    }

    // DB保存
    const inserts = parsed.results.map((r) => {
      const ans = data.answers.find((a) => a.questionId === r.id);
      return {
        user_id: userId,
        question_id: r.id,
        user_answer: ans?.userAnswer ?? "",
        score: Math.round(r.score),
        correct: !!r.correct,
        feedback: r.feedback,
      };
    });
    if (inserts.length > 0) {
      await (supabase as any).from("grading_history").insert(inserts);
    }
    // 各問題の was_wrong を更新
    for (const r of parsed.results) {
      await supabase.from("questions").update({ was_wrong: !r.correct, attempts: ((byId.get(r.id)?.attempts ?? 0) + 1) }).eq("id", r.id);
    }

    const total = parsed.results.reduce((s, r) => s + r.score, 0);
    const avg = parsed.results.length ? Math.round(total / parsed.results.length) : 0;
    const correctCount = parsed.results.filter((r) => r.correct).length;
    return { results: parsed.results, averageScore: avg, totalScore: total, correctCount, totalCount: parsed.results.length };
  });
