import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
<<<<<<< HEAD
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VOTON_URL = process.env.VOTON_URL;
const VOTON_PUBLISHABLE_KEY = process.env.VOTON_PUBLISHABLE_KEY;

function getVotonClient(accessToken?: string) {
  if (!VOTON_URL || !VOTON_PUBLISHABLE_KEY) {
    throw new Error("Voton認証の設定が未完了です");
  }

  return createClient(VOTON_URL, VOTON_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
=======

const VOTON_URL = "https://bzcapzqxrbjfdlamctrb.supabase.co";
const VOTON_KEY = "sb_publishable_uduJUXODyTfPFse9YYtgYA__ddVoCfa";

function votonClient(accessToken?: string) {
  return createClient(VOTON_URL, VOTON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (h.get("Authorization") === `Bearer ${VOTON_KEY}`) h.delete("Authorization");
        if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
        h.set("apikey", VOTON_KEY);
        return fetch(input, { ...init, headers: h });
      },
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
    },
  });
}

<<<<<<< HEAD
const accessTokenInput = z.object({
  accessToken: z.string().min(10).max(4096),
});

export const exchangeVotonToken = createServerFn({ method: "POST" })
  .inputValidator((data) => accessTokenInput.parse(data))
  .handler(async ({ data }) => {
    const voton = getVotonClient(data.accessToken);
    const { data: userData, error: userError } = await voton.auth.getUser(data.accessToken);
    if (userError || !userData.user?.id) {
      return { error: "Votonアカウントを確認できませんでした" as const };
    }

    const votonUserId = userData.user.id;
    const votonEmail = userData.user.email?.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linkedProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("voton_user_id", votonUserId)
      .maybeSingle();

    if (profileError) {
      console.error("[Voton] linked profile lookup failed", profileError);
      return { error: "Voton連携情報を確認できませんでした" as const };
    }

    let targetEmail = linkedProfile?.email?.trim().toLowerCase();
    if (!targetEmail) {
      if (!votonEmail) return { error: "Votonアカウントにメールアドレスが登録されていません" as const };
      targetEmail = votonEmail;

      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        email_confirm: true,
        user_metadata: { voton_user_id: votonUserId },
      });
      if (createError && !/already registered|already exists/i.test(createError.message)) {
        console.error("[Voton] user creation failed", createError);
        return { error: "Study#アカウントの準備に失敗しました" as const };
      }

      const { error: linkError } = await supabaseAdmin
        .from("profiles")
        .update({ voton_user_id: votonUserId })
        .eq("email", targetEmail);
      if (linkError) {
        console.error("[Voton] profile link failed", linkError);
        return { error: "Voton連携情報の保存に失敗しました" as const };
      }
    }

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("[Voton] magic link generation failed", linkError);
      return { error: "ログインに失敗しました" as const };
    }
    return { tokenHash };
  });

export const linkVotonAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => accessTokenInput.parse(data))
  .handler(async ({ data, context }) => {
    const voton = getVotonClient(data.accessToken);
    const { data: userData, error: userError } = await voton.auth.getUser(data.accessToken);
    if (userError || !userData.user?.id) return { error: "Votonアカウントの確認に失敗しました" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("voton_user_id", userData.user.id)
      .neq("id", context.userId)
      .maybeSingle();
    if (lookupError) {
      console.error("[Voton] existing link lookup failed", lookupError);
      return { error: "既存のVoton連携を確認できませんでした" as const };
    }
    if (existing) return { error: "このVotonアカウントは別のStudy#アカウントに連携されています" as const };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ voton_user_id: userData.user.id })
      .eq("id", context.userId);
    if (error) {
      console.error("[Voton] profile link update failed", error);
      return { error: "連携の保存に失敗しました" as const };
    }
    return { ok: true as const };
  });

export const unlinkVotonAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ voton_user_id: null })
      .eq("id", context.userId);
    if (error) {
      console.error("[Voton] profile unlink failed", error);
      return { error: "Voton連携の解除に失敗しました" as const };
    }
    return { ok: true as const };
  });

export const getMyVotonStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("voton_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) {
      console.error("[Voton] status lookup failed", error);
      return { error: "Voton連携状態を確認できませんでした" as const, linked: false };
    }
    return { linked: Boolean(data?.voton_user_id) };
=======
/** Voton のトークンを検証し、Study# のログイン用ワンタイムトークンを返す */
export const exchangeVotonToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(10).max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const voton = votonClient(data.accessToken);
    const { data: u, error } = await voton.auth.getUser(data.accessToken);
    if (error || !u.user?.email) return { error: "Votonアカウントを確認できませんでした" as const };
    const votonUserId = u.user.id;
    const email = u.user.email.toLowerCase();

    let profile: { username?: string | null; display_name?: string | null; avatar_url?: string | null } | null = null;
    try {
      const r = await voton
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", votonUserId)
        .maybeSingle();
      profile = r.data;
    } catch {
      /* プロフィール取得失敗は無視 */
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // 未登録なら作成（既存なら失敗するが無視）
    await supabaseAdmin.auth.admin
      .createUser({
        email,
        email_confirm: true,
        user_metadata: {
          voton_user_id: votonUserId,
          display_name: profile?.display_name ?? profile?.username ?? undefined,
          avatar_url: profile?.avatar_url ?? undefined,
        },
      })
      .catch(() => null);

    const { data: link, error: le } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (le || !link?.properties?.hashed_token) return { error: "ログインに失敗しました" as const };
    return { tokenHash: link.properties.hashed_token };
>>>>>>> b23be19da64131c89d3a8a56ef1fa3a06ad7b83b
  });
