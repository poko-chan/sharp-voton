// 未ログインの体験用チャット。公開エンドポイントのため短い応答・少ない履歴に制限する。
import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "google/gemini-3.8-flash";
const SYSTEM =
  "あなたは学習アプリ Study# の体験用AIです。日本語で、やさしく短く（目安300文字以内）答えてください。";

type Body = { messages?: Array<{ role: "user" | "assistant"; content: string }> };

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const Route = createFileRoute("/api/public/ai-trial")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return text("AIの設定が未完了です", 500);

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return text("リクエストが不正です", 400);
        }

        const turns = (body.messages ?? [])
          .filter((m) => typeof m?.content === "string" && m.content.trim())
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
        if (!turns.length) return text("入力が空です", 400);

        const upstream = await fetch(`${GATEWAY}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: MODEL,
            stream: true,
            max_tokens: 500,
            messages: [{ role: "system", content: SYSTEM }, ...turns],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          if (upstream.status === 429)
            return text("混み合っています。少し待ってからお試しください。", 429);
          if (upstream.status === 402) return text("AIの利用枠が不足しています。", 402);
          return text(`AIの呼び出しに失敗しました（${upstream.status}）`, 502);
        }

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            let buffer = "";
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const t = line.trim();
                  if (!t.startsWith("data:")) continue;
                  const payload = t.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    /* 不完全な行は無視 */
                  }
                }
              }
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
