import { createServerFn } from "@tanstack/react-start";

type Input = { texts: string[]; target: string };

/**
 * 日本語のUI文字列を指定言語へ一括翻訳する。
 * 返り値は入力と同じ順序・同じ長さの配列。
 */
export const translateBatch = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (!data || !Array.isArray(data.texts) || typeof data.target !== "string") {
      throw new Error("invalid input");
    }
    return {
      texts: data.texts.slice(0, 120).map((t) => String(t).slice(0, 600)),
      target: data.target.slice(0, 12),
    };
  })
  .handler(async ({ data }): Promise<{ translations: string[] }> => {
    const { texts, target } = data;
    if (texts.length === 0) return { translations: [] };
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { translations: texts };

    const prompt = [
      `You are a UI localization engine for a Japanese study app.`,
      `Translate each Japanese string into ${target}.`,
      `Rules: keep it short and natural for UI labels; preserve numbers, emoji, placeholders and product names (StudyΩ, Voton, Makron) as-is;`,
      `never add explanations. Return ONLY a JSON object of the form {"t":["...","..."]} whose array has exactly ${texts.length} items in the same order.`,
      ``,
      JSON.stringify(texts),
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        console.error("translate gateway error", res.status, await res.text());
        return { translations: texts };
      }
      const json: any = await res.json();
      const content = json?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content);
      const arr: unknown = Array.isArray(parsed) ? parsed : parsed?.t ?? parsed?.translations;
      if (!Array.isArray(arr)) return { translations: texts };
      return { translations: texts.map((src, i) => (typeof arr[i] === "string" && arr[i] ? (arr[i] as string) : src)) };
    } catch (e) {
      console.error("translate failed", e);
      return { translations: texts };
    }
  });
