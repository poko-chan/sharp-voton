import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUTH_BASE = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

type LineIdentity = {
  sub: string;
  name?: string;
  picture?: string;
  email?: string;
};

function tmpClient() {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Mint a one-time token the browser can exchange for a real session. */
async function sessionTokenFor(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error("ログインの準備に失敗しました");
  }
  return { tokenHash: data.properties.hashed_token, email };
}

/** Step 1: build the LINE authorization URL. */
export const getLineAuthUrl = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ redirectUri: z.string().url(), state: z.string().min(8).max(128) }).parse(i),
  )
  .handler(async ({ data }) => {
    const channelId = process.env["LINE_LOGIN_CHANNEL_ID"];
    if (!channelId) throw new Error("LINEログインの設定が未完了です（チャネルID未設定）");
    const url = new URL(AUTH_BASE);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", channelId);
    url.searchParams.set("redirect_uri", data.redirectUri);
    url.searchParams.set("state", data.state);
    url.searchParams.set("scope", "profile openid email");
    url.searchParams.set("bot_prompt", "aggressive");
    return { url: url.toString() };
  });

async function exchangeCode(code: string, redirectUri: string): Promise<LineIdentity> {
  const channelId = process.env["LINE_LOGIN_CHANNEL_ID"];
  const channelSecret = process.env["LINE_LOGIN_CHANNEL_SECRET"];
  if (!channelId || !channelSecret) throw new Error("LINEログインの設定が未完了です");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  const token = (await res.json()) as { id_token?: string; error_description?: string };
  if (!res.ok || !token.id_token) {
    throw new Error(token.error_description || "LINEの認証に失敗しました");
  }

  const vRes = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: token.id_token, client_id: channelId }),
  });
  const claims = (await vRes.json()) as LineIdentity & { error_description?: string };
  if (!vRes.ok || !claims.sub) {
    throw new Error(claims.error_description || "LINEアカウントの確認に失敗しました");
  }
  return { sub: claims.sub, name: claims.name, picture: claims.picture, email: claims.email };
}

/**
 * Step 2: exchange the authorization code.
 * Linked account -> a session token. Unknown LINE user -> a short-lived pending token.
 */
export const completeLineLogin = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ code: z.string().min(4).max(512), redirectUri: z.string().url() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const identity = await exchangeCode(data.code, data.redirectUri);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, username")
      .eq("line_user_id", identity.sub)
      .maybeSingle();

    if (prof?.email) {
      const { tokenHash, email } = await sessionTokenFor(prof.email);
      return {
        mode: "session" as const,
        tokenHash,
        email,
        displayName: (prof as any).display_name ?? (prof as any).username ?? null,
      };
    }

    const { data: pending, error } = await supabaseAdmin
      .from("line_pending_links")
      .insert({
        line_user_id: identity.sub,
        display_name: identity.name ?? null,
        picture_url: identity.picture ?? null,
        email: identity.email ?? null,
      })
      .select("token")
      .single();
    if (error) throw new Error(error.message);

    return {
      mode: "setup" as const,
      token: pending.token as string,
      lineName: identity.name ?? null,
      linePicture: identity.picture ?? null,
      lineEmail: identity.email ?? null,
    };
  });

async function takePending(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("line_pending_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data) throw new Error("連携の有効期限が切れました。もう一度お試しください");
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    throw new Error("連携の有効期限が切れました。もう一度お試しください");
  }
  return data as {
    token: string;
    line_user_id: string;
    display_name: string | null;
    picture_url: string | null;
    email: string | null;
  };
}

async function clearPending(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("line_pending_links").delete().eq("token", token);
}

/** Link LINE to an existing account by username + password, then sign in. */
export const linkLineToExistingAccount = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().uuid(),
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(256),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pending = await takePending(data.token);

    const looksLikeEmail = data.username.includes("@");
    const query = supabaseAdmin.from("profiles").select("id, email, line_user_id");
    const { data: prof } = looksLikeEmail
      ? await query.ilike("email", data.username).maybeSingle()
      : await query.ilike("username", data.username).maybeSingle();
    if (!prof?.email) throw new Error("アカウントが見つかりません");
    if (prof.line_user_id && prof.line_user_id !== pending.line_user_id) {
      throw new Error("このアカウントには別のLINEが連携されています");
    }

    const tmp = tmpClient();
    const { error: signErr } = await tmp.auth.signInWithPassword({
      email: prof.email,
      password: data.password,
    });
    if (signErr) throw new Error("ユーザー名またはパスワードが正しくありません");
    await tmp.auth.signOut();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ line_user_id: pending.line_user_id })
      .eq("id", prof.id);
    if (error) throw new Error("連携に失敗しました");
    await clearPending(data.token);
    return await sessionTokenFor(prof.email);
  });

/** Create a brand new Study# account from the LINE identity. */
export const createAccountFromLine = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().uuid(),
        username: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_]+$/, "ユーザー名は半角英数字と _ のみ使えます"),
        displayName: z.string().min(1).max(40),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pending = await takePending(data.token);

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (taken) throw new Error("このユーザー名は既に使われています");

    const email = pending.email ?? `line_${pending.line_user_id}@line.study-hash.app`;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { username: data.username, display_name: data.displayName },
    });
    if (cErr || !created?.user) throw new Error(cErr?.message ?? "アカウント作成に失敗しました");

    await supabaseAdmin
      .from("profiles")
      .update({
        username: data.username,
        display_name: data.displayName,
        email,
        avatar_url: pending.picture_url,
        line_user_id: pending.line_user_id,
      })
      .eq("id", created.user.id);

    await clearPending(data.token);
    return await sessionTokenFor(email);
  });

/** Attach LINE to the account that is already signed in (settings screen). */
export const linkLineToCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ token: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pending = await takePending(data.token);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ line_user_id: pending.line_user_id })
      .eq("id", context.userId);
    if (error) throw new Error("連携に失敗しました");
    await clearPending(data.token);
    return { ok: true };
  });

export const unlinkLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ line_user_id: null })
      .eq("id", context.userId);
    return { ok: true };
  });

export const getMyLineStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("line_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("LINEの連携状態を確認できませんでした");
    return { linked: Boolean((data as any)?.line_user_id) };
  });

/** Admin: is the LINE integration configured on the server? */
export const getLineServerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("管理者のみ利用できます");
    return {
      loginChannelId: Boolean(process.env["LINE_LOGIN_CHANNEL_ID"]),
      loginChannelSecret: Boolean(process.env["LINE_LOGIN_CHANNEL_SECRET"]),
      messagingChannelSecret: Boolean(process.env["LINE_MESSAGING_CHANNEL_SECRET"]),
      messagingAccessToken: Boolean(process.env["LINE_MESSAGING_ACCESS_TOKEN"]),
    };
  });
