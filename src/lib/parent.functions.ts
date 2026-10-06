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
    z
      .object({
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(256),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parentId = context.userId;

    // ensure caller is a parent
    const { data: parentProf } = await supabaseAdmin
      .from("profiles")
      .select("account_kind")
      .eq("id", parentId)
      .maybeSingle();
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
    const tmp = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signErr } = await tmp.auth.signInWithPassword({
      email: childProf.email,
      password: data.password,
    });
    if (signErr) throw new Error("パスワードが違います");
    await tmp.auth.signOut();

    const { error: insErr } = await supabaseAdmin
      .from("parent_child_links")
      .upsert(
        { parent_id: parentId, child_id: childProf.id },
        { onConflict: "parent_id,child_id" },
      );
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
    await supabaseAdmin
      .from("parent_child_links")
      .delete()
      .eq("parent_id", context.userId)
      .eq("child_id", data.childId);
    return { ok: true };
  });

export const updateChildProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        childId: z.string().uuid(),
        display_name: z.string().min(1).max(40).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin
      .from("parent_child_links")
      .select("id")
      .eq("parent_id", context.userId)
      .eq("child_id", data.childId)
      .maybeSingle();
    if (!ok) throw new Error("子供アカウントとリンクされていません");
    if (!data.display_name) return { ok: true };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.display_name })
      .eq("id", data.childId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChildSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin
      .from("parent_child_links")
      .select("id")
      .eq("parent_id", context.userId)
      .eq("child_id", data.childId)
      .maybeSingle();
    if (!ok) throw new Error("子供アカウントとリンクされていません");
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: logs } = await supabaseAdmin
      .from("study_logs")
      .select("date, duration_minutes, content, subject_id")
      .eq("user_id", data.childId)
      .gte("date", since)
      .order("date", { ascending: false });
    const { data: subjects } = await supabaseAdmin
      .from("subjects")
      .select("id, name, color")
      .eq("user_id", data.childId);
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
    const { data: ok } = await supabaseAdmin
      .from("parent_child_links")
      .select("id")
      .eq("parent_id", context.userId)
      .eq("child_id", data.childId)
      .maybeSingle();
    if (!ok) throw new Error("子供アカウントとリンクされていません");
    const cid = data.childId;
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const sinceIso = new Date(Date.now() - 90 * 86400000).toISOString();

    const [
      profile,
      subjects,
      logs,
      goals,
      exams,
      examSubjects,
      streakInfo,
      makronSessions,
      makronAnswers,
      focusLogs,
      notes,
      flashcards,
      badges,
      titles,
      inventory,
      missions,
      photoLogs,
      reflections,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, username, display_name, email, avatar_url, created_at, account_kind")
        .eq("id", cid)
        .maybeSingle(),
      supabaseAdmin.from("subjects").select("id, name, color").eq("user_id", cid),
      supabaseAdmin
        .from("study_logs")
        .select("date, duration_minutes, content, subject_id")
        .eq("user_id", cid)
        .gte("date", since90)
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("goals")
        .select("*")
        .eq("user_id", cid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("exams")
        .select("*")
        .eq("user_id", cid)
        .order("start_date", { ascending: false })
        .limit(20),
      supabaseAdmin.from("exam_subjects").select("*").eq("user_id", cid).limit(200),
      supabaseAdmin.from("streak_freezes").select("*").eq("user_id", cid),
      supabaseAdmin
        .from("makron_sessions")
        .select("id, pack_id, total_score, total_points, passed, started_at, finished_at")
        .eq("user_id", cid)
        .order("started_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("makron_sessions")
        .select("id")
        .eq("user_id", cid)
        .then(async ({ data: ss }) => {
          const ids = (ss ?? []).map((s: any) => s.id);
          if (ids.length === 0) return { data: [] as any[] };
          return await supabaseAdmin
            .from("makron_answers")
            .select("id, session_id, is_correct, awarded_points, created_at")
            .in("session_id", ids)
            .gte("created_at", sinceIso)
            .limit(500);
        }),
      supabaseAdmin
        .from("focus_logs")
        .select("*")
        .eq("user_id", cid)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("sticky_notes")
        .select("id, content, updated_at")
        .eq("user_id", cid)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("flashcards")
        .select("id, front, back, updated_at")
        .eq("user_id", cid)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabaseAdmin.from("user_badges").select("*").eq("user_id", cid),
      supabaseAdmin.from("user_titles").select("*").eq("user_id", cid),
      supabaseAdmin.from("user_inventory").select("*").eq("user_id", cid),
      supabaseAdmin
        .from("daily_missions")
        .select("*")
        .eq("user_id", cid)
        .gte("date", since90)
        .order("date", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("photo_study_logs")
        .select("*")
        .eq("user_id", cid)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("daily_reflections")
        .select("*")
        .eq("user_id", cid)
        .order("date", { ascending: false })
        .limit(30),
    ]);

    return {
      profile: profile.data,
      subjects: subjects.data ?? [],
      logs: logs.data ?? [],
      goals: goals.data ?? [],
      exams: exams.data ?? [],
      examSubjects: examSubjects.data ?? [],
      streakInfo: streakInfo.data ?? [],
      makronSessions: makronSessions.data ?? [],
      makronAnswers: makronAnswers.data ?? [],
      focusLogs: focusLogs.data ?? [],
      notes: notes.data ?? [],
      flashcards: flashcards.data ?? [],
      badges: badges.data ?? [],
      titles: titles.data ?? [],
      inventory: inventory.data ?? [],
      missions: missions.data ?? [],
      photoLogs: photoLogs.data ?? [],
      reflections: reflections.data ?? [],
    };
  });

/* ---------------- 保護者コントロール（利用制限・QRログイン・フレンド確認） ---------------- */

async function assertLinked(parentId: string, childId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("parent_child_links")
    .select("id")
    .eq("parent_id", parentId)
    .eq("child_id", childId)
    .maybeSingle();
  if (!data) throw new Error("子供アカウントとリンクされていません");
  return supabaseAdmin;
}

export const getChildControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const { data: row } = await admin
      .from("child_controls")
      .select("*")
      .eq("child_id", data.childId)
      .maybeSingle();
    const { data: codes } = await admin
      .from("child_login_tokens")
      .select("code, created_at, last_used_at, revoked")
      .eq("child_id", data.childId)
      .eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(1);
    return { controls: row ?? null, loginCode: codes?.[0]?.code ?? null };
  });

export const setChildControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        childId: z.string().uuid(),
        daily_limit_minutes: z.number().int().min(0).max(1440).nullable(),
        allowed_from: z.string().max(8).nullable(),
        allowed_to: z.string().max(8).nullable(),
        locked_features: z.array(z.string().max(40)).max(40),
        always_allowed_features: z.array(z.string().max(40)).max(40).optional(),
        app_time_limits: z.record(z.string().max(40), z.number().int().min(0).max(1440)).optional(),
        homework_first: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const { childId, ...rest } = data;
    const { error } = await admin
      .from("child_controls")
      .upsert(
        { child_id: childId, updated_by: context.userId, ...rest },
        { onConflict: "child_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const issueChildLoginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    await admin
      .from("child_login_tokens")
      .update({ revoked: true })
      .eq("child_id", data.childId)
      .eq("parent_id", context.userId);
    const code = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 40);
    const { error } = await admin
      .from("child_login_tokens")
      .insert({ child_id: data.childId, parent_id: context.userId, code });
    if (error) throw new Error(error.message);
    return { code };
  });

export const revokeChildLoginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    await admin
      .from("child_login_tokens")
      .update({ revoked: true })
      .eq("child_id", data.childId)
      .eq("parent_id", context.userId);
    return { ok: true };
  });

export const listChildFriends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const { data: follows } = await admin
      .from("follows")
      .select("following_id, created_at")
      .eq("follower_id", data.childId)
      .limit(200);
    const ids = (follows ?? []).map((f: any) => f.following_id);
    if (ids.length === 0) return [];
    const { data: profs } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    return profs ?? [];
  });

/** QRカードから子供がログインする（公開・コードのみで認証） */
export const loginWithChildCode = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ code: z.string().min(10).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("child_login_tokens")
      .select("id, child_id, expires_at, revoked")
      .eq("code", data.code)
      .maybeSingle();
    if (!row || row.revoked) throw new Error("このログインカードは使えません");
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      throw new Error("このログインカードは期限切れです");
    }
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, display_name, username")
      .eq("id", row.child_id)
      .maybeSingle();
    if (!prof?.email) throw new Error("アカウントが見つかりません");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: prof.email,
    });
    if (error || !link?.properties?.hashed_token) throw new Error("ログインに失敗しました");
    await supabaseAdmin
      .from("child_login_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      tokenHash: link.properties.hashed_token,
      name: (prof as any).display_name ?? (prof as any).username ?? "",
    };
  });

/** 子供本人が自分の制限を取得する */
export const getMyControls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("child_controls")
      .select("*")
      .eq("child_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

/* ---------------- 親子メッセージ・延長リクエスト ---------------- */

const JST = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

async function parentOf(childId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("parent_child_links")
    .select("parent_id")
    .eq("child_id", childId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { parent_id: string } | null)?.parent_id ?? null;
}

async function notifyParentOnLine(parentId: string, messages: unknown[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { pushToLineUser } = await import("@/lib/line-messaging.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("line_user_id")
    .eq("id", parentId)
    .maybeSingle();
  const lineId = (data as { line_user_id?: string } | null)?.line_user_id;
  if (!lineId) return;
  await pushToLineUser(lineId, messages as Record<string, unknown>[]);
}

/** 子供側：保護者とのつながり・メッセージ・延長申請の状態をまとめて取得 */
export const getMyParentPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parentId = await parentOf(context.userId);
    if (!parentId) return { linked: false as const };
    const [{ data: prof }, { data: msgs }, { data: reqs }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", parentId)
        .maybeSingle(),
      supabaseAdmin
        .from("parent_child_messages")
        .select("*")
        .eq("child_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabaseAdmin
        .from("child_extension_requests")
        .select("*")
        .eq("child_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    return {
      linked: true as const,
      parent: prof ?? null,
      messages: (msgs ?? []).reverse(),
      requests: reqs ?? [],
    };
  });

/** 子供側：保護者へメッセージ／スタンプを送る */
export const sendMessageToParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        body: z.string().min(1).max(300),
        kind: z.enum(["text", "sticker"]).default("text"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parentId = await parentOf(context.userId);
    if (!parentId) throw new Error("おうちの人とつながっていません");
    const { error } = await supabaseAdmin.from("parent_child_messages").insert({
      parent_id: parentId,
      child_id: context.userId,
      sender_role: "child",
      kind: data.kind,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", context.userId)
      .maybeSingle();
    const name = (me as any)?.display_name ?? (me as any)?.username ?? "お子様";
    await notifyParentOnLine(parentId, [{ type: "text", text: `${name}さんから：${data.body}` }]);
    try {
      const { pushToUser } = await import("@/lib/push.server");
      await pushToUser(parentId);
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

/** 子供側：利用時間の延長をお願いする */
export const requestTimeExtension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        minutes: z.number().int().min(5).max(240),
        reason: z.string().max(120).optional(),
        scope: z.string().max(40).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parentId = await parentOf(context.userId);
    if (!parentId) throw new Error("おうちの人とつながっていません");
    const { error } = await supabaseAdmin.from("child_extension_requests").insert({
      child_id: context.userId,
      parent_id: parentId,
      minutes: data.minutes,
      reason: data.reason ?? null,
      scope: data.scope,
    });
    if (error) throw new Error(error.message);
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", context.userId)
      .maybeSingle();
    const name = (me as any)?.display_name ?? (me as any)?.username ?? "お子様";
    await notifyParentOnLine(parentId, [
      {
        type: "text",
        text: `${name}さんから「あと${data.minutes}分つかいたい」というお願いが届きました。${
          data.reason ? `\n理由：${data.reason}` : ""
        }\nStudy#の保護者ページから承認できます。`,
      },
    ]);
    return { ok: true };
  });

/** 子供側：学習おわりを保護者に知らせる */
export const notifyStudyFinished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        minutes: z.number().int().min(0).max(1440),
        questions: z.number().int().min(0).max(10000).default(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parentId = await parentOf(context.userId);
    if (!parentId) return { ok: false };
    const { data: pref } = await supabaseAdmin
      .from("user_line_preferences")
      .select("parent_finish_report")
      .eq("user_id", parentId)
      .maybeSingle();
    if (pref && (pref as any).parent_finish_report === false) return { ok: false };
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", context.userId)
      .maybeSingle();
    const name = (me as any)?.display_name ?? (me as any)?.username ?? "お子様";
    const { cardMessage } = await import("@/lib/line-messaging.server");
    await notifyParentOnLine(parentId, [
      cardMessage(`${name}さんの学習がおわりました`, [
        ["学習時間", `${data.minutes}分`],
        ["といた問題", `${data.questions}問`],
      ]),
    ]);
    return { ok: true };
  });

/** 保護者側：やり取りと延長申請の一覧 */
export const getParentThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const [{ data: msgs }, { data: reqs }] = await Promise.all([
      admin
        .from("parent_child_messages")
        .select("*")
        .eq("child_id", data.childId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("child_extension_requests")
        .select("*")
        .eq("child_id", data.childId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return { messages: (msgs ?? []).reverse(), requests: reqs ?? [] };
  });

/** 保護者側：応援スタンプ・メッセージを送る（Study#内のみ） */
export const sendCheerToChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        childId: z.string().uuid(),
        body: z.string().min(1).max(300),
        kind: z.enum(["text", "sticker"]).default("text"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const { error } = await admin.from("parent_child_messages").insert({
      parent_id: context.userId,
      child_id: data.childId,
      sender_role: "parent",
      kind: data.kind,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    try {
      const { pushToUser } = await import("@/lib/push.server");
      await pushToUser(data.childId);
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

/** 保護者側：延長申請の承認・却下 */
export const decideExtensionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        requestId: z.string().uuid(),
        approve: z.boolean(),
        minutes: z.number().int().min(0).max(240).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("child_extension_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req) throw new Error("申請が見つかりません");
    if ((req as any).parent_id !== context.userId) throw new Error("権限がありません");

    const granted = data.approve ? (data.minutes ?? (req as any).minutes) : 0;
    await supabaseAdmin
      .from("child_extension_requests")
      .update({
        status: data.approve ? "approved" : "rejected",
        granted_minutes: granted,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);

    if (data.approve && granted > 0) {
      const childId = (req as any).child_id as string;
      const today = JST();
      const { data: cur } = await supabaseAdmin
        .from("child_controls")
        .select("bonus_minutes, bonus_date")
        .eq("child_id", childId)
        .maybeSingle();
      const base = (cur as any)?.bonus_date === today ? Number((cur as any).bonus_minutes ?? 0) : 0;
      await supabaseAdmin.from("child_controls").upsert(
        {
          child_id: childId,
          bonus_minutes: base + granted,
          bonus_date: today,
          updated_by: context.userId,
        },
        { onConflict: "child_id" },
      );
      await supabaseAdmin.from("parent_child_messages").insert({
        parent_id: context.userId,
        child_id: childId,
        sender_role: "parent",
        kind: "text",
        body: `あと${granted}分つかえるようにしたよ！`,
      });
    }
    return { ok: true, granted };
  });

/** 保護者側：今すぐ時間を追加する（申請なしでも延長できる） */
export const grantBonusMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ childId: z.string().uuid(), minutes: z.number().int().min(-240).max(240) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const today = JST();
    const { data: cur } = await admin
      .from("child_controls")
      .select("bonus_minutes, bonus_date")
      .eq("child_id", data.childId)
      .maybeSingle();
    const base = (cur as any)?.bonus_date === today ? Number((cur as any).bonus_minutes ?? 0) : 0;
    const next = Math.max(0, base + data.minutes);
    const { error } = await admin.from("child_controls").upsert(
      {
        child_id: data.childId,
        bonus_minutes: next,
        bonus_date: today,
        updated_by: context.userId,
      },
      { onConflict: "child_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, bonus: next };
  });

/* ---------------- 親子ミッション・集中ロック ---------------- */

/** 保護者側：ミッション一覧 */
export const listChildMissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ childId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const { data: rows } = await admin
      .from("parent_missions")
      .select("*")
      .eq("child_id", data.childId)
      .order("created_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });

/** 保護者側：ミッションを作る */
export const createChildMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        childId: z.string().uuid(),
        title: z.string().min(1).max(80),
        detail: z.string().max(300).optional(),
        reward_text: z.string().max(80).optional(),
        due_date: z.string().max(10).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const { error } = await admin.from("parent_missions").insert({
      parent_id: context.userId,
      child_id: data.childId,
      title: data.title,
      detail: data.detail ?? null,
      reward_coins: 0,
      reward_text: data.reward_text?.trim() || null,
      due_date: data.due_date || null,
    } as any);
    if (error) throw new Error(error.message);
    try {
      const { pushToUser } = await import("@/lib/push.server");
      await pushToUser(data.childId);
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

export const deleteChildMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ missionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("parent_missions")
      .delete()
      .eq("id", data.missionId)
      .eq("parent_id", context.userId);
    return { ok: true };
  });

/** 保護者側：確認／もう少し／ごほうびを渡した（コインは使わない） */
export const reviewChildMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        missionId: z.string().uuid(),
        approve: z.boolean(),
        rewarded: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("parent_missions")
      .select("*")
      .eq("id", data.missionId)
      .maybeSingle();
    if (!m) throw new Error("約束が見つかりません");
    if ((m as any).parent_id !== context.userId) throw new Error("権限がありません");
    const childId = (m as any).child_id as string;
    const reward = (m as any).reward_text as string | null;

    if (data.rewarded) {
      await supabaseAdmin
        .from("parent_missions")
        .update({ status: "rewarded", rewarded_at: new Date().toISOString() } as any)
        .eq("id", data.missionId);
      await supabaseAdmin.from("parent_child_messages").insert({
        parent_id: context.userId,
        child_id: childId,
        sender_role: "parent",
        kind: "text",
        body: `約束「${(m as any).title}」のごほうびを渡したよ。よくがんばったね`,
      });
      return { ok: true };
    }

    await supabaseAdmin
      .from("parent_missions")
      .update({
        status: data.approve ? "done" : "open",
        approved_at: data.approve ? new Date().toISOString() : null,
        claimed_at: data.approve ? (m as any).claimed_at : null,
      })
      .eq("id", data.missionId);

    await supabaseAdmin.from("parent_child_messages").insert({
      parent_id: context.userId,
      child_id: childId,
      sender_role: "parent",
      kind: "text",
      body: data.approve
        ? `約束「${(m as any).title}」できたね！${reward ? `ごほうび「${reward}」を楽しみにしててね` : ""}`
        : `約束「${(m as any).title}」もう少しだけがんばろう`,
    });
    try {
      const { pushToUser } = await import("@/lib/push.server");
      await pushToUser(childId);
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

/** 子供側：自分のミッション一覧 */
export const listMyMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("parent_missions")
      .select("*")
      .eq("child_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

/** 子供側：できた！と報告する */
export const claimMyMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ missionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("parent_missions")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", data.missionId)
      .eq("child_id", context.userId);
    if (error) throw new Error(error.message);
    const parentId = await parentOf(context.userId);
    if (parentId) {
      await notifyParentOnLine(parentId, [
        {
          type: "text",
          text: "お子様からミッション達成の報告が届きました。Study#で承認できます。",
        },
      ]);
      try {
        const { pushToUser } = await import("@/lib/push.server");
        await pushToUser(parentId);
      } catch {
        /* ignore */
      }
    }
    return { ok: true };
  });

/** 保護者側：いますぐ集中ロック（分数と範囲を指定） */
export const setFocusLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        childId: z.string().uuid(),
        minutes: z.number().int().min(0).max(1440),
        scope: z.enum(["all", "study_only"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertLinked(context.userId, data.childId);
    const until =
      data.minutes > 0 ? new Date(Date.now() + data.minutes * 60000).toISOString() : null;
    const { error } = await admin.from("child_controls").upsert(
      {
        child_id: data.childId,
        focus_until: until,
        focus_scope: data.minutes > 0 ? data.scope : null,
        updated_by: context.userId,
      },
      { onConflict: "child_id" },
    );
    if (error) throw new Error(error.message);
    try {
      const { pushToUser } = await import("@/lib/push.server");
      await pushToUser(data.childId);
    } catch {
      /* ignore */
    }
    return { ok: true, until };
  });

/** 保護者側：全員まとめて集中ロック */
export const setFocusLockAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        minutes: z.number().int().min(0).max(1440),
        scope: z.enum(["all", "study_only"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("parent_child_links")
      .select("child_id")
      .eq("parent_id", context.userId);
    const until =
      data.minutes > 0 ? new Date(Date.now() + data.minutes * 60000).toISOString() : null;
    for (const l of links ?? []) {
      await supabaseAdmin.from("child_controls").upsert(
        {
          child_id: (l as any).child_id,
          focus_until: until,
          focus_scope: data.minutes > 0 ? data.scope : null,
          updated_by: context.userId,
        },
        { onConflict: "child_id" },
      );
    }
    return { ok: true, count: (links ?? []).length };
  });

/** 保護者側：左ペイン用の軽いサマリー（今日の学習時間など） */
export const getChildrenOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("parent_child_links")
      .select("child_id")
      .eq("parent_id", context.userId);
    const ids = (links ?? []).map((l: any) => l.child_id);
    if (ids.length === 0) return [];
    const today = JST();
    const [{ data: profs }, { data: logs }, { data: ctrls }, { data: reqs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, display_name, avatar_url").in("id", ids),
      supabaseAdmin
        .from("study_logs")
        .select("user_id, duration_minutes")
        .in("user_id", ids)
        .eq("date", today),
      supabaseAdmin
        .from("child_controls")
        .select("child_id, daily_limit_minutes, bonus_minutes, bonus_date, focus_until")
        .in("child_id", ids),
      supabaseAdmin
        .from("child_extension_requests")
        .select("child_id, status")
        .in("child_id", ids)
        .eq("status", "pending"),
    ]);
    return (profs ?? []).map((p: any) => {
      const mins = (logs ?? [])
        .filter((l: any) => l.user_id === p.id)
        .reduce((s: number, l: any) => s + (l.duration_minutes ?? 0), 0);
      const c = (ctrls ?? []).find((x: any) => x.child_id === p.id) as any;
      const bonus = c?.bonus_date === today ? Number(c?.bonus_minutes ?? 0) : 0;
      return {
        ...p,
        todayMinutes: mins,
        dailyLimit: c?.daily_limit_minutes ?? null,
        bonusMinutes: bonus,
        focusUntil: c?.focus_until ?? null,
        pendingRequests: (reqs ?? []).filter((r: any) => r.child_id === p.id).length,
      };
    });
  });
