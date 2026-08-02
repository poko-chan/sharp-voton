import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type Body = {
  system?: string;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
};

export const Route = createFileRoute("/api/ai-stream")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { system, messages, temperature } = (await request.json()) as Body;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }
        const key = process.env['LOVABLE_API_KEY'];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("openai/gpt-5.6-sol"),
          system: system || "あなたは日本語で答える学習アシスタントです。",
          messages: messages.filter((m) => m.role !== "system"),
          temperature,
          providerOptions: { lovable: { reasoningEffort: "none" } },
        });
        return result.toTextStreamResponse();
      },
    },
  },
});