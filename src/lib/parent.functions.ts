import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

/**
 * Verify a child's username + password without touching the parent's session,
 * then create a parent_child_links row.
 */
export const linkChildAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      username: z.string().min(1).max(64),
      password: z.string().min(1).max(256),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parentId = context.userId;

    // ensure caller is a parent
    const { data: parentProf } = await supabaseAdmin.from("profiles").select("account_kind").eq("id", parentId).maybeSingle();
    if (!parentProf || (parentProf as any).account_kind !== "parent") {
      throw new Error("保護者アカウントでログインしてください");
    }

    const { data: childProf } = await supabaseAdmin
      .from("profiles")
      .select("id, email, account_kind")
      .ilike("username", data.username)
      .maybeSingle();
    if (!childProf?.email) throw new Error("子供アカウントが見つかりません");

    // verify password using an isolated client (no persistence)
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const tmp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signErr } = await tmp.auth.signInWithPassword({ email: childProf.email, password: data.password });
    if (signErr) throw new Error("パスワードが違います");
    await tmp.auth.signOut();

    const { error: insErr } = await supabaseAdmin.from("parent_child_links").upsert({ parent_id: parentId, child_id: childProf.id }, { onConflict: "parent_id,child_id" });
    if (insErr) throw new Error(insErr.message);
    return { childId: childProf.id };
  });

export const listMyChildren = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("parent_child_links")
      .select("child_id, created_at")
      .eq("parent_id", context.userId);
    const ids = (links ?? []).map((l) => l.child_id);
    if (ids.length === 0) return [];
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, email, avatar_url")
      .in("id", ids);
    return profs ?? [];
  });

export const unlinkChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("parent_child_links").delete().eq("parent_id", context.userId).eq("child_id", data.childId);
    return { ok: true };
  });

export const updateChildProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    childId: z.string().uuid(),
    display_name: z.string().min(1).max(40).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.from("parent_child_links").select("id").eq("parent_id", context.userId).eq("child_id", data.childId).maybeSingle();
    if (!ok) throw new Error("子供アカウントとリンクされていません");
    if (!data.display_name) return { ok: true };
    const { error } = await supabaseAdmin.from("profiles").update({ display_name: data.display_name }).eq("id", data.childId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChildSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.from("parent_child_links").select("id").eq("parent_id", context.userId).eq("child_id", data.childId).maybeSingle();
    if (!ok) throw new Error("子供アカウントとリンクされていません");
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: logs } = await supabaseAdmin
      .from("study_logs")
      .select("date, duration_minutes, content, subject_id")
      .eq("user_id", data.childId)
      .gte("date", since)
      .order("date", { ascending: false });
    const { data: subjects } = await supabaseAdmin.from("subjects").select("id, name, color").eq("user_id", data.childId);
    return { logs: logs ?? [], subjects: subjects ?? [] };
  });