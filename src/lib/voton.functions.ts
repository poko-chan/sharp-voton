import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_VOTON_URL = "https://bzcapzqxrbjfdlamctrb.supabase.co";
const DEFAULT_VOTON_KEY = "sb_publishable_uduJUXODyTfPFse9YYtgYA__ddVoCfa";

function getVotonClient(accessToken?: string) {
  const url = process.env.VOTON_URL || DEFAULT_VOTON_URL;
  const key = process.env.VOTON_PUBLISHABLE_KEY || DEFAULT_VOTON_KEY;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

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
  });
