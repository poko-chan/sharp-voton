import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Username helpers.
 * SECURITY: these endpoints are reachable without a session, so they never
 * return an email address. Sign-in and password reset are performed on the
 * server after resolving the username internally.
 */

async function lookupEmail(username: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .ilike("username", username)
    .maybeSingle();
  return data?.email ?? null;
}

/** Sign in with a username + password. Returns session tokens, never the email. */
export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      username: z.string().min(1).max(64),
      password: z.string().min(1).max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const email = await lookupEmail(data.username);
    if (!email) throw new Error("ユーザー名またはパスワードが正しくありません");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: any, init: any) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: res, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !res.session) throw new Error("ユーザー名またはパスワードが正しくありません");
    return {
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
    };
  });

/**
 * Send a password reset email for a username.
 * Always reports success so usernames/emails cannot be enumerated.
 */
export const requestPasswordResetByUsername = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      username: z.string().min(1).max(64),
      redirectTo: z.string().url().max(500),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const email = await lookupEmail(data.username);
    if (email) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: data.redirectTo });
    }
    return { ok: true };
  });

export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ username: z.string().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    return { available: !row };
  });
