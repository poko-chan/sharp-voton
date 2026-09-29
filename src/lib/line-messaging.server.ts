/**
 * Server-only helpers for pushing messages to LINE.
 * Never import this from a component; call it inside a server function handler.
 */

const PUSH_URL = "https://api.line.me/v2/bot/message/push";

type LineMessage = Record<string, unknown>;

export async function pushToLineUser(lineUserId: string, messages: LineMessage[]) {
  const token = process.env["LINE_MESSAGING_ACCESS_TOKEN"];
  if (!token || !lineUserId) return { ok: false, skipped: true };
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: messages.slice(0, 5) }),
    });
    await logOutgoing(lineUserId, messages, res.ok);
    return { ok: res.ok, skipped: false };
  } catch {
    await logOutgoing(lineUserId, messages, false);
    return { ok: false, skipped: false };
  }
}

async function logOutgoing(lineUserId: string, messages: LineMessage[], ok: boolean) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const first = messages[0] ?? {};
    await supabaseAdmin.from("line_message_logs" as any).insert({
      direction: "out",
      event_type: "push",
      line_user_id: lineUserId,
      message_type: String(first.type ?? ""),
      text: String(first.text ?? first.altText ?? "").slice(0, 2000),
      ok,
      raw: { messages },
    } as any);
  } catch {
    /* ignore */
  }
}

export function textMessage(text: string): LineMessage {
  return { type: "text", text: text.slice(0, 4900) };
}

/** Simple titled card with optional key/value rows. */
export function cardMessage(
  title: string,
  rows: Array<[string, string]>,
  footer?: string,
): LineMessage {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: title, weight: "bold", size: "md", wrap: true },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: rows.map(([k, v]) => ({
              type: "box",
              layout: "baseline",
              spacing: "sm",
              contents: [
                { type: "text", text: k, size: "sm", color: "#888888", flex: 3 },
                { type: "text", text: v, size: "sm", wrap: true, flex: 5 },
              ],
            })),
          },
          ...(footer
            ? [{ type: "text", text: footer, size: "xs", color: "#888888", wrap: true }]
            : []),
        ],
      },
    },
  };
}

/**
 * Forward an in-app notification to the user's LINE, honouring their
 * "forward app notifications" switch and quiet hours.
 */
export async function forwardNotificationToLine(
  userId: string,
  title: string,
  body?: string | null,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: pref }, { data: prof }] = await Promise.all([
      supabaseAdmin
        .from("user_line_preferences")
        .select("forward_app_notifications, quiet_enabled, quiet_from, quiet_to")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("line_user_id").eq("id", userId).maybeSingle(),
    ]);
    const p = pref as Record<string, unknown> | null;
    if (!p || p.forward_app_notifications !== true) return;
    if (
      p.quiet_enabled === true &&
      inQuietHours((p.quiet_from as string) ?? null, (p.quiet_to as string) ?? null)
    ) {
      return;
    }
    const lineId = (prof as { line_user_id?: string } | null)?.line_user_id;
    if (!lineId) return;
    await pushToLineUser(lineId, [textMessage(body ? `${title}\n${body}` : title)]);
  } catch {
    /* notifications must never fail because of LINE */
  }
}

/** Quiet-hours check against "HH:MM" strings, local JST. */
export function inQuietHours(from: string | null, to: string | null) {
  if (!from || !to) return false;
  const now = new Date(Date.now() + 9 * 3600_000);
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const start = fh * 60 + (fm || 0);
  const end = th * 60 + (tm || 0);
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}
