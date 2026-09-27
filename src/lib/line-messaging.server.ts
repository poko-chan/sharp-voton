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
    return { ok: res.ok, skipped: false };
  } catch {
    return { ok: false, skipped: false };
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
