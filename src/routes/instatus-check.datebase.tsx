import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/instatus-check/datebase")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { error } = await supabaseAdmin
            .from("profiles")
            .select("id", { head: true, count: "exact" });

          const status = error ? 100 : 400;
          return new Response(String(status), {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "X-Database-Status": String(status),
            },
          });
        } catch {
          return new Response("100", {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "X-Database-Status": "100",
            },
          });
        }
      },
    },
  },
});
