import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/instatus-check/login")({
  server: {
    handlers: {
      GET: async () => {
        let status = 100;
        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const res = await fetch(`${url}/auth/v1/health`, {
              headers: { apikey: key },
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
            "X-Login-Status": String(status),
          },
        });
      },
    },
  },
});
