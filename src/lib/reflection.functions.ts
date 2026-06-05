import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";

export const generateDailyReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ date: z.string().min(8).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI 設定がありません");

    const [{ data: entries }, { data: logs }] = await Promise.all([
      supabase.from("today_entries").select("category,label,start_time,end_time").eq("user_id", userId).eq("date", data.date).order("start_time"),
      supabase.from("study_logs").select("duration_minutes,content,subjects(name)").eq("user_id", userId).eq("date", data.date),
    ]);

    const segLines = (entries ?? []).map((e: any) => `${e.start_time}-${e.end_time} ${e.category} ${e.label ?? ""}`).join("\n");
    const studyTotal = (logs ?? []).reduce((s: number, l: any) => s + (l.duration_minutes ?? 0), 0);
    const subjects = Array.from(new Set((logs ?? []).map((l: any) => l.subjects?.name).filter(Boolean))).join(", ");

    const prompt = `あなたは優しい学習コーチ。ユーザーの${data.date}の1日を200字以内で振り返ってください。

1日の予定:
${segLines || "（記録なし）"}

勉強合計: ${studyTotal}分 (${subjects || "未指定"})

ルール:
- 共感→気づき→明日への小さな提案、の順
- 罪悪感を煽らない
- マークダウン記号は使わない、ふつうの文`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AI制限に達しました");
      if (res.status === 402) throw new Error("AIクレジット不足");
      throw new Error(`AI失敗: ${res.status}`);
    }
    const json = await res.json();
    const summary: string = json?.choices?.[0]?.message?.content ?? "";
    await supabase.from("daily_reflections").upsert({ user_id: userId, date: data.date, summary }, { onConflict: "user_id,date" });
    return { summary };
  });