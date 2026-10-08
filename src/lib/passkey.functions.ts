import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function rp() {
  const origin = getRequestHeader("origin") ?? "";
  const u = new URL(origin || "http://localhost");
  return { origin: u.origin, rpID: u.hostname };
}

// ライブラリの generate*Options は初期化順エラー(_generateChallengeInternals)を起こすため使わず、
// WebAuthn 標準のオプションJSONを自前で組み立てる。検証は passkey.server.ts のみで行う。
async function lib() {
  return await import("./passkey.server");
}
async function newChallenge() {
  const { b64urlFromBytes } = await lib();
  return b64urlFromBytes(crypto.getRandomValues(new Uint8Array(32)));
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function takeChallenge(id: string) {
  const db = await admin();
  const { data } = await db
    .from("webauthn_challenges" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  await db
    .from("webauthn_challenges" as never)
    .delete()
    .eq("id", id);
  const row = data as { challenge: string; user_id: string | null; created_at: string } | null;
  if (!row || Date.now() - new Date(row.created_at).getTime() > 5 * 60_000)
    throw new Error("時間切れです。もう一度お試しください");
  return row;
}

export const passkeyRegisterOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { b64urlFromBytes } = await lib();
    const { rpID } = rp();
    const db = await admin();
    const { data: existing } = await db
      .from("user_passkeys" as never)
      .select("id")
      .eq("user_id", context.userId);
    const email = (context.claims as { email?: string }).email ?? "user";
    const options = {
      challenge: await newChallenge(),
      rp: { name: "Study#", id: rpID },
      user: {
        id: b64urlFromBytes(new TextEncoder().encode(context.userId)),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -8, type: "public-key" },
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      timeout: 60000,
      attestation: "none",
      excludeCredentials: ((existing ?? []) as { id: string }[]).map((c) => ({
        id: c.id,
        type: "public-key",
      })),
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "preferred",
      },
      extensions: { credProps: true },
    };
    const { data: ch } = await db
      .from("webauthn_challenges" as never)
      .insert({ user_id: context.userId, challenge: options.challenge } as never)
      .select("id")
      .single();
    return {
      options: JSON.parse(JSON.stringify(options)),
      challengeId: (ch as unknown as { id: string }).id,
    };
  });

export const passkeyRegisterVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ challengeId: z.string().uuid(), response: z.any(), label: z.string().max(40) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { verifyRegistration, b64urlFromBytes } = await lib();
    const ch = await takeChallenge(data.challengeId);
    if (ch.user_id !== context.userId) throw new Error("不正なリクエストです");
    const { origin, rpID } = rp();
    const v = await verifyRegistration({
      response: data.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!v.verified || !v.registrationInfo) throw new Error("登録できませんでした");
    const c = v.registrationInfo.credential;
    const db = await admin();
    const { error } = await db.from("user_passkeys" as never).insert({
      id: c.id,
      user_id: context.userId,
      public_key: b64urlFromBytes(c.publicKey),
      counter: c.counter,
      transports: c.transports ?? null,
      label: data.label || "この端末",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const passkeyLoginOptions = createServerFn({ method: "POST" }).handler(async () => {
  const { rpID } = rp();
  const options = {
    challenge: await newChallenge(),
    rpId: rpID,
    timeout: 60000,
    userVerification: "preferred",
  };
  const db = await admin();
  const { data: ch } = await db
    .from("webauthn_challenges" as never)
    .insert({ challenge: options.challenge } as never)
    .select("id")
    .single();
  return {
    options: JSON.parse(JSON.stringify(options)),
    challengeId: (ch as unknown as { id: string }).id,
  };
});

export const passkeyLoginVerify = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ challengeId: z.string().uuid(), response: z.any() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAuthentication, bytesFromB64url } = await lib();
    const ch = await takeChallenge(data.challengeId);
    const db = await admin();
    const credId = String(data.response?.id ?? "");
    const { data: row } = await db
      .from("user_passkeys" as never)
      .select("*")
      .eq("id", credId)
      .maybeSingle();
    const cred = row as {
      id: string;
      user_id: string;
      public_key: string;
      counter: number;
      transports: string[] | null;
    } | null;
    if (!cred) return { error: "このパスキーは登録されていません" };
    const { origin, rpID } = rp();
    const v = await verifyAuthentication({
      response: data.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: bytesFromB64url(cred.public_key),
        counter: Number(cred.counter),
        transports: cred.transports ?? undefined,
      },
    });
    if (!v.verified) return { error: "認証に失敗しました" };
    await db
      .from("user_passkeys" as never)
      .update({ counter: v.authenticationInfo.newCounter } as never)
      .eq("id", cred.id);
    const { data: u } = await db.auth.admin.getUserById(cred.user_id);
    const email = u?.user?.email;
    if (!email) return { error: "アカウントが見つかりません" };
    const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link?.properties?.hashed_token) return { error: "ログインの準備に失敗しました" };
    return { tokenHash: link.properties.hashed_token };
  });

export const listMyPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_passkeys" as never)
      .select("id,label,created_at")
      .eq("user_id", context.userId)
      .order("created_at");
    return (data ?? []) as { id: string; label: string | null; created_at: string }[];
  });

export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().max(512) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("user_passkeys" as never)
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
