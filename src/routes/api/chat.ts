import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        await request.body?.cancel();
        return new Response("クラウド AI（AI Gateway）は有料プラン専用のため使用できません。端末内 AI を選択してください。", { status: 403 });
      },
    },
  },
});
