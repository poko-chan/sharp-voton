import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

async function loadSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("line_settings").select("*").eq("id", 1).maybeSingle();
  return data as {
    webhook_forward_url: string | null;
    webhook_enabled: boolean;
    welcome_message: string | null;
  } | null;
}

async function reply(replyToken: string, text: string) {
  const token = process.env["LINE_MESSAGING_ACCESS_TOKEN"];
  if (!token) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

export const Route = createFileRoute("/api/public/line/webhook")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        const secret = process.env["LINE_MESSAGING_CHANNEL_SECRET"];
        const body = await request.text();
        const signature = request.headers.get("x-line-signature") ?? "";

        if (!secret) return new Response("not configured", { status: 503 });
        const expected = createHmac("sha256", secret).update(body).digest("base64");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

        const settings = await loadSettings();
        if (settings && settings.webhook_enabled === false) return new Response("ok");

        let payload: any = {};
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("bad payload", { status: 400 });
        }

        // Store every verified event in our own database.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const events: any[] = payload.events ?? [];
          const ids = [...new Set(events.map((e) => e?.source?.userId).filter(Boolean))];
          const map = new Map<string, string>();
          if (ids.length) {
            const { data: profs } = await supabaseAdmin
              .from("profiles")
              .select("id, line_user_id")
              .in("line_user_id", ids as string[]);
            for (const p of (profs ?? []) as any[]) map.set(p.line_user_id, p.id);
          }
          if (events.length) {
            await supabaseAdmin.from("line_message_logs" as any).insert(
              events.map((e) => ({
                direction: "in",
                event_type: e?.type ?? null,
                line_user_id: e?.source?.userId ?? null,
                user_id: map.get(e?.source?.userId) ?? null,
                message_type: e?.message?.type ?? null,
                text: e?.message?.text ?? e?.postback?.data ?? null,
                ok: true,
                raw: e,
              })) as any,
            );
          }
        } catch {
          /* logging must not break LINE delivery */
        }

        // Relay the verified payload to Google Apps Script when configured.
        const forward = settings?.webhook_forward_url;
        if (forward) {
          try {
            await fetch(forward, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
          } catch {
            /* relay failures must not break LINE delivery */
          }
        }

        const welcome = settings?.welcome_message?.trim();
        if (welcome) {
          for (const ev of payload.events ?? []) {
            if ((ev.type === "follow" || ev.type === "message") && ev.replyToken) {
              await reply(ev.replyToken, welcome);
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
