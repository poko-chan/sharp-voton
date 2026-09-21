import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/instatus-check/ai-back")({
  server: {
    handlers: {
      GET: async () => {
        let status = 100;
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          if (apiKey) {
            const res = await fetch("https://ai.gateway.lovable.dev/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (res.ok) status = 400;
          }
        } catch {
          // fall through with status 100
        }
        return new Response(String(status), {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Ai-Back-Status": String(status),
          },
        });
      },
    },
  },
});
