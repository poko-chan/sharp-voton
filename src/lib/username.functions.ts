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
  const safe = username.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("username", safe)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (data.email) return data.email;
  // Fallback: profile has no email copy — read it from the auth account.
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.id);
  return u?.user?.email ?? null;
}

const BAD_LOGIN = "ユーザー名またはパスワードが正しくありません";

/** Sign in with a username + password. Returns session tokens, never the email. */
export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const email = await lookupEmail(data.username);
    if (!email) return { error: BAD_LOGIN, access_token: "", refresh_token: "" };
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: any, init: any) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: res, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !res.session) return { error: BAD_LOGIN, access_token: "", refresh_token: "" };
    return {
      error: null as string | null,
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
    z
      .object({
        username: z.string().min(1).max(64),
        redirectTo: z.string().url().max(500),
      })
      .parse(i),
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
  .inputValidator((i) => z.object({ username: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    return { available: !row };
  });
