import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type Body = { messages?: any[]; system?: string; model?: string; raw?: boolean };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages, system, model, raw } = (await request.json()) as Body;
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        if (raw) {
          // Plain OpenAI-compatible call (used by tutor page with multi-modal content)
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: model ?? "google/gemini-2.5-flash",
              messages: [{ role: "system", content: system ?? "" }, ...messages],
            }),
          });
          if (!res.ok) return new Response(await res.text(), { status: res.status });
          const json = await res.json();
          return new Response(json.choices?.[0]?.message?.content ?? "", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway(model ?? "google/gemini-2.5-flash"),
          system: system ?? "You are a helpful Japanese study assistant.",
          messages: await convertToModelMessages(messages as UIMessage[]),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages as UIMessage[] });
      },
    },
  },
});
