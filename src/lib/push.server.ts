// ペイロードなしの Web Push（VAPID署名のみ）。通知の中身はサービスワーカー側で固定文言を表示。
const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function vapidJwt(aud: string) {
  const pub = fromB64u(process.env["VAPID_PUBLIC_KEY"]!);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: b64u(pub.slice(1, 33)),
      y: b64u(pub.slice(33, 65)),
      d: process.env["VAPID_PRIVATE_D"]!,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const enc = new TextEncoder();
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(
    enc.encode(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: "mailto:support@studysharp.app",
      }),
    ),
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64u(sig)}`;
}

export async function pushToUser(userId: string) {
  if (!process.env["VAPID_PRIVATE_D"]) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("push_subscriptions" as never)
    .select("endpoint")
    .eq("user_id", userId);
  let sent = 0;
  for (const { endpoint } of (data ?? []) as { endpoint: string }[]) {
    try {
      const jwt = await vapidJwt(new URL(endpoint).origin);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `vapid t=${jwt}, k=${process.env["VAPID_PUBLIC_KEY"]}`,
          TTL: "86400",
          "Content-Length": "0",
        },
      });
      if (res.status === 404 || res.status === 410)
        await supabaseAdmin
          .from("push_subscriptions" as never)
          .delete()
          .eq("endpoint", endpoint);
      else if (res.ok) sent++;
    } catch {
      /* ignore */
    }
  }
  return sent;
}
