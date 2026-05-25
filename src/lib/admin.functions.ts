import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("管理者権限が必要です");
}

const POKOCHAN_USERNAME = "pokochan";
async function assertNotPokochan(userId: string, action = "操作") {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  if (data?.username === POKOCHAN_USERNAME) {
    throw new Error(`ぽこちゃん（システム管理者）は${action}できません`);
  }
}

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, username, display_name, avatar_url, created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    roles?.forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? ["user"],
      isAdmin: (roleMap.get(p.id) ?? []).includes("admin"),
    }));
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      username: z.string().min(1).max(40),
      displayName: z.string().min(1).max(80),
      isAdmin: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, display_name: data.displayName },
    });
    if (error) throw new Error(error.message);
    if (created.user) {
      await supabaseAdmin.from("profiles").upsert({
        id: created.user.id, email: data.email, username: data.username, display_name: data.displayName,
      });
      if (data.isAdmin) {
        await supabaseAdmin.from("user_roles").upsert({ user_id: created.user.id, role: "admin" });
      }
    }
    return { ok: true };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      username: z.string().optional(),
      displayName: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await assertNotPokochan(data.userId, "変更");
    const update: any = {};
    if (data.email) update.email = data.email;
    if (data.password) update.password = data.password;
    if (Object.keys(update).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, update);
      if (error) throw new Error(error.message);
    }
    const profUpdate: any = {};
    if (data.username !== undefined) profUpdate.username = data.username;
    if (data.displayName !== undefined) profUpdate.display_name = data.displayName;
    if (data.email) profUpdate.email = data.email;
    if (Object.keys(profUpdate).length > 0) {
      await supabaseAdmin.from("profiles").update(profUpdate).eq("id", data.userId);
    }
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("自分自身は削除できません");
    await assertNotPokochan(data.userId, "削除");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await assertNotPokochan(data.userId, "権限変更");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      if (data.userId === context.userId) throw new Error("自分の管理者権限は外せません");
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    return { ok: true };
  });

export const adminImpersonate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await assertNotPokochan(data.userId, "ログイン");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!u.user?.email) throw new Error("ユーザーが見つかりません");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: u.user.email,
    });
    if (error) throw new Error(error.message);
    return { actionLink: link.properties?.action_link };
  });

export const selfDeleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertNotPokochan(context.userId, "削除");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminEnsurePokochan = createServerFn({ method: "POST" }).handler(async () => {
  // Idempotent admin seeder. Anyone can call this once to ensure pokochan exists.
  const email = "pokochan@study-plus.local";
  const password = "Udka7456";
  const username = "pokochan";

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  let userId = existing?.id as string | undefined;
  if (!userId) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { username, display_name: "ぽこちゃん（管理者）" },
    });
    if (error && !error.message.includes("already")) throw new Error(error.message);
    userId = created?.user?.id;
    if (!userId) {
      // fallback: lookup via profile created by trigger
      const { data: p } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
      userId = p?.id;
    }
  }
  if (userId) {
    await supabaseAdmin.from("profiles").upsert({
      id: userId, email, username, display_name: "ぽこちゃん（管理者）",
    });
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" });
  }
  return { ok: true, username, email };
});

export const adminUpdateMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      enabled: z.boolean(),
      message: z.string().max(2000).optional(),
      until: z.string().nullable().optional(),
      appVersion: z.string().min(1).max(64).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: Record<string, unknown> = {
      id: 1,
      maintenance_mode: data.enabled,
      maintenance_message: data.message ?? null,
      maintenance_until: data.until ?? null,
      updated_at: new Date().toISOString(),
    };
    if (data.appVersion !== undefined) patch.app_version = data.appVersion;
    await supabaseAdmin.from("app_settings").upsert(patch);
    return { ok: true };
  });
