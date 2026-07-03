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

/**
 * Full read-only child dashboard. Parents see almost everything the child sees,
 * but cannot mutate any of the child's data.
 */
export const getChildFullDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.from("parent_child_links").select("id").eq("parent_id", context.userId).eq("child_id", data.childId).maybeSingle();
    if (!ok) throw new Error("子供アカウントとリンクされていません");
    const cid = data.childId;
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const sinceIso = new Date(Date.now() - 90 * 86400000).toISOString();

    const [
      profile, coins, subjects, logs, todayEntries, goals, exams, examSubjects,
      streakInfo, makronSessions, makronAnswers, focusLogs, notes, flashcards,
      badges, titles, inventory, txns, missions, photoLogs, reflections,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, display_name, email, avatar_url, created_at, account_kind").eq("id", cid).maybeSingle(),
      supabaseAdmin.from("user_coins").select("*").eq("user_id", cid).maybeSingle(),
      supabaseAdmin.from("subjects").select("id, name, color").eq("user_id", cid),
      supabaseAdmin.from("study_logs").select("date, duration_minutes, content, subject_id").eq("user_id", cid).gte("date", since90).order("date", { ascending: false }),
      supabaseAdmin.from("today_entries").select("*").eq("user_id", cid).gte("planned_date", since90).order("planned_date", { ascending: false }).limit(200),
      supabaseAdmin.from("goals").select("*").eq("user_id", cid).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("exams").select("*").eq("user_id", cid).order("date", { ascending: false }).limit(20),
      supabaseAdmin.from("exam_subjects").select("*").eq("user_id", cid).limit(200),
      supabaseAdmin.from("streak_freezes").select("*").eq("user_id", cid),
      supabaseAdmin.from("makron_sessions").select("id, pack_id, total_score, total_points, passed, started_at, finished_at").eq("user_id", cid).order("started_at", { ascending: false }).limit(50),
      supabaseAdmin.from("makron_sessions").select("id").eq("user_id", cid).then(async ({ data: ss }) => {
        const ids = (ss ?? []).map((s: any) => s.id);
        if (ids.length === 0) return { data: [] as any[] };
        return await supabaseAdmin.from("makron_answers").select("id, session_id, is_correct, awarded_points, created_at").in("session_id", ids).gte("created_at", sinceIso).limit(500);
      }),
      supabaseAdmin.from("focus_logs").select("*").eq("user_id", cid).gte("started_at", sinceIso).order("started_at", { ascending: false }).limit(200),
      supabaseAdmin.from("sticky_notes").select("id, title, updated_at").eq("user_id", cid).order("updated_at", { ascending: false }).limit(30),
      supabaseAdmin.from("flashcards").select("id, front, back, updated_at").eq("user_id", cid).order("updated_at", { ascending: false }).limit(30),
      supabaseAdmin.from("user_badges").select("*").eq("user_id", cid),
      supabaseAdmin.from("user_titles").select("*").eq("user_id", cid),
      supabaseAdmin.from("user_inventory").select("*").eq("user_id", cid),
      supabaseAdmin.from("coin_transactions").select("*").eq("user_id", cid).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("daily_missions").select("*").eq("user_id", cid).gte("date", since90).order("date", { ascending: false }).limit(100),
      supabaseAdmin.from("photo_study_logs").select("*").eq("user_id", cid).order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("daily_reflections").select("*").eq("user_id", cid).order("date", { ascending: false }).limit(30),
    ]);

    return {
      profile: profile.data,
      coins: coins.data,
      subjects: subjects.data ?? [],
      logs: logs.data ?? [],
      todayEntries: todayEntries.data ?? [],
      goals: goals.data ?? [],
      exams: exams.data ?? [],
      examSubjects: examSubjects.data ?? [],
      streakInfo: streakInfo.data ?? [],
      makronSessions: makronSessions.data ?? [],
      makronAnswers: makronAnswers.data ?? [],
      focusLogs: focusLogs.data ?? [],
      notes: (notes as any).data ?? [],
      flashcards: flashcards.data ?? [],
      badges: badges.data ?? [],
      titles: titles.data ?? [],
      inventory: inventory.data ?? [],
      txns: txns.data ?? [],
      missions: missions.data ?? [],
      photoLogs: photoLogs.data ?? [],
      reflections: reflections.data ?? [],
    };
  });