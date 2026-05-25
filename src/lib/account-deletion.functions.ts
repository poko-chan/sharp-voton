import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function gen6() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Step 1: After password re-auth client-side, request a 6-digit code. */
export const requestDeletionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("username, email").eq("id", context.userId).maybeSingle();
    if (prof?.username?.toLowerCase().startsWith("mcjp_")) {
      throw new Error("MCJP_ ユーザーのアカウント削除は管理者にお問い合わせください");
    }
    if (prof?.username === "pokochan") {
      throw new Error("システム管理者は削除できません");
    }
    const code = gen6();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deletion_code: code, deletion_code_expires_at: expires })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { code, email: prof?.email ?? null, expiresAt: expires };
  });

/** Step 2: Confirm code + reason and schedule deletion 7 days in the future. */
export const scheduleDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      code: z.string().regex(/^\d{6}$/, "6桁の数字を入力してください"),
      confirmText: z.string().min(1),
      reason: z.string().trim().min(30, "理由は30文字以上で入力してください").max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("username, email, deletion_code, deletion_code_expires_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof) throw new Error("プロフィールが見つかりません");
    if (prof.username?.toLowerCase().startsWith("mcjp_")) throw new Error("MCJP_ ユーザーは削除できません");
    if (prof.username === "pokochan") throw new Error("システム管理者は削除できません");
    if (!prof.deletion_code || !prof.deletion_code_expires_at) throw new Error("先にコード発行してください");
    if (new Date(prof.deletion_code_expires_at).getTime() < Date.now()) {
      throw new Error("コードの有効期限が切れています。やり直してください");
    }
    if (prof.deletion_code !== data.code) throw new Error("コードが一致しません");
    const expected = `DELETE ${prof.email ?? ""}`.trim();
    if (data.confirmText.trim() !== expected) {
      throw new Error(`確認文「${expected}」を正確に入力してください`);
    }
    const scheduled = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        deletion_scheduled_at: scheduled,
        deletion_code: null,
        deletion_code_expires_at: null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    // Log reason as feedback for admin audit
    await supabaseAdmin.from("feedback").insert({
      user_id: context.userId,
      email: prof.email,
      category: "other",
      body: `[ACCOUNT DELETION REQUEST]\n${data.reason}`,
      status: "open",
    });
    return { scheduledAt: scheduled };
  });

export const cancelDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deletion_scheduled_at: null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDeletionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("deletion_scheduled_at")
      .eq("id", context.userId)
      .maybeSingle();
    return { scheduledAt: data?.deletion_scheduled_at ?? null };
  });

/** Immediately purge own account if scheduled time has passed (can be called by client on login). */
export const executePendingDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("deletion_scheduled_at, username").eq("id", context.userId).maybeSingle();
    if (!prof?.deletion_scheduled_at) return { deleted: false };
    if (new Date(prof.deletion_scheduled_at).getTime() > Date.now()) return { deleted: false };
    if (prof.username === "pokochan") return { deleted: false };
    if (prof.username?.toLowerCase().startsWith("mcjp_")) return { deleted: false };
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });
