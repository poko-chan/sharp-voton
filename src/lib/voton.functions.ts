import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

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
    },
  });
}

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
  });
