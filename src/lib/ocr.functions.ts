import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ocrImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dataUrl: z.string().min(20).max(15_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY!;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "この画像から手書きや印刷された文字をすべて正確に書き起こしてください。説明は不要、本文のみ。" },
            { type: "image_url", image_url: { url: data.dataUrl } },
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error(`OCR失敗: ${res.status}`);
    const j: any = await res.json();
    return { text: j.choices?.[0]?.message?.content ?? "" };
  });