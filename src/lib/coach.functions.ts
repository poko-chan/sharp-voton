import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";

export const generateCoachAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI 設定がありません");

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [{ data: logs }, { data: subjects }, { data: goals }] = await Promise.all([
      supabase.from("study_logs").select("date, duration_minutes, subjects(name)").eq("user_id", userId).gte("date", since),
      supabase.from("subjects").select("name").eq("user_id", userId),
      supabase.from("goals").select("title, target_minutes, progress_minutes, done").eq("user_id", userId).eq("done", false),
    ]);

    const total = (logs ?? []).reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
    const days = new Set((logs ?? []).map((l) => l.date)).size;
    const lastDate = (logs ?? []).reduce<string | null>((m, l) => (l.duration_minutes > 0 && (!m || l.date > m) ? l.date : m), null);
    const daysSince = lastDate ? Math.floor((Date.now() - new Date(lastDate + "T00:00:00").getTime()) / 86400000) : 999;
    const subjList = (subjects ?? []).map((s) => s.name).join(", ") || "未登録";
    const goalList = (goals ?? []).map((g) => `${g.title}(${g.progress_minutes}/${g.target_minutes}分)`).join("; ") || "なし";

    const prompt = `あなたは優しく現実的なAI学習コーチです。次のユーザーに、今日できる小さな一歩を提案してください。

過去30日:
- 合計学習: ${total}分
- 活動日数: ${days}日
- 最終学習からの経過: ${daysSince}日
- 教科: ${subjList}
- 未達成目標: ${goalList}

ルール:
- 説教はしない。共感→小さな提案の順
- 「5分だけやる」「1問だけ解く」「教科書を開くだけ」など、最小行動を1〜3個提案
- 全くやってない場合でも、罪悪感をあおらない
- 250字以内
- マークダウン記号 (** や ##) は使わない、ふつうの文`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AI制限に達しました。少し時間を置いてください");
      if (res.status === 402) throw new Error("AIクレジットが不足しています");
      throw new Error(`AI失敗: ${res.status}`);
    }
    const json = await res.json();
    const advice: string = json?.choices?.[0]?.message?.content ?? "";
    return { advice };
  });

export const generateMicroQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ topic: z.string().min(1).max(100).optional() }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI 設定がありません");
    const topic = data.topic || "中学・高校レベルの基礎一般教養";
    const prompt = `「${topic}」から、1分で解ける4択クイズを1問作成。
出力はJSON: {"question":"...","choices":["A","B","C","D"],"answer":0,"explanation":"..."}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI失敗: ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return parsed as { question: string; choices: string[]; answer: number; explanation: string };
  });

export const generateListenSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ topic: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI 設定がありません");
    const prompt = `「${data.topic}」について、中学生でも理解できる優しい要約を400字程度で。読むだけ／聞き流すだけで頭に入る、会話調で。マークダウン記号は使わない。`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`AI失敗: ${res.status}`);
    const json = await res.json();
    return { text: json?.choices?.[0]?.message?.content ?? "" };
  });
