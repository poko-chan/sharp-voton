import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VOTON = "https://voton.app";
const REDIRECT_URI = "https://sharp.voton.app/login/redirect-voton";

async function fetchVotonUser(code: string, codeVerifier: string) {
  const secret = process.env.VOTON_CLIENT_SECRET;
  if (!secret) {
    console.error("[Voton] VOTON_CLIENT_SECRET missing");
    return null;
  }
  const tokRes = await fetch(`${VOTON}/api/public/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      client_id: "study-sharp",
      client_secret: secret,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const tok = (await tokRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!tokRes.ok || !tok?.access_token) {
    console.error("[Voton] token exchange failed", tokRes.status, tok);
    return null;
  }
  const meRes = await fetch(`${VOTON}/api/public/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  const me = (await meRes.json().catch(() => null)) as { sub?: string; email?: string } | null;
  if (!meRes.ok || !me?.sub) {
    console.error("[Voton] userinfo failed", meRes.status);
    return null;
  }
  return { id: me.sub, email: me.email };
}

const accessTokenInput = z.object({
  code: z.string().min(4).max(2048),
  codeVerifier: z.string().min(20).max(256),
});

export const exchangeVotonToken = createServerFn({ method: "POST" })
  .validator((data) => accessTokenInput.parse(data))
  .handler(async ({ data }) => {
    const me = await fetchVotonUser(data.code, data.codeVerifier);
    if (!me) return { error: "Votonアカウントを確認できませんでした" as const };
    const votonUserId = me.id;
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

    if (!linkedProfile) {
      return {
        error:
          "このVotonアカウントはStudy#と連携されていません。通常のログイン後、設定画面の「ログイン方法」からVoton連携を行ってください。" as const,
      };
    }

    const targetEmail = linkedProfile.email?.trim().toLowerCase();
    if (!targetEmail) {
      return { error: "連携先アカウントのメールアドレスを確認できませんでした" as const };
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
  .validator((data) => accessTokenInput.parse(data))
  .handler(async ({ data, context }) => {
    const me = await fetchVotonUser(data.code, data.codeVerifier);
    if (!me) return { error: "Votonアカウントの確認に失敗しました" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("voton_user_id", me.id)
      .neq("id", context.userId)
      .maybeSingle();
    if (lookupError) {
      console.error("[Voton] existing link lookup failed", lookupError);
      return { error: "既存のVoton連携を確認できませんでした" as const };
    }
    if (existing) return { error: "このVotonアカウントは別のStudy#アカウントに連携されています" as const };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ voton_user_id: me.id })
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
    const { error } = await supabaseAdmin.from("profiles").update({ voton_user_id: null }).eq("id", context.userId);
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
