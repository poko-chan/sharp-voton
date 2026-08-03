import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { paidAiDisabled } from "@/lib/paid-ai-disabled.server";

/**
 * 記述/長文回答のAI採点。模範解答と比較し、0-100スコア・部分点・フィードバックを返す。
 */
export const gradeWrittenAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      prompt: z.string().min(1).max(4000),
      answer: z.string().min(1).max(8000),
      model_answer: z.string().max(8000).optional(),
      max_points: z.number().int().min(1).max(1000).default(10),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    paidAiDisabled();
    const apiKey = "";
    const sys = `あなたは厳格だが公平な採点者です。与えられた問題と模範解答に対し、生徒の解答を採点してください。
出力は必ずJSON: {"score": 0-${data.max_points}, "rate": 0-100, "feedback": "短評（200字以内）", "good": ["..."], "improve": ["..."]}`;
    const user = `【問題】${data.prompt}\n【模範解答】${data.model_answer ?? "（明示なし。一般的な妥当性で判断）"}\n【満点】${data.max_points}\n【生徒の解答】${data.answer}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AI制限に達しました");
      if (res.status === 402) throw new Error("AIクレジットが不足しています");
      throw new Error(`AI採点失敗: ${res.status}`);
    }
    const j: any = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return {
      score: Math.max(0, Math.min(data.max_points, Number(parsed.score) || 0)),
      rate: Math.max(0, Math.min(100, Number(parsed.rate) || 0)),
      feedback: String(parsed.feedback ?? ""),
      good: Array.isArray(parsed.good) ? parsed.good.map(String) : [],
      improve: Array.isArray(parsed.improve) ? parsed.improve.map(String) : [],
    };
  });