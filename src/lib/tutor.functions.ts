import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const STUDY_SCOPES = ["study", "goals", "weak", "notes", "exams", "flashcards", "markon"] as const;
export type StudyScope = (typeof STUDY_SCOPES)[number];

// ユーザーの学習コンテキストを集約して返す（AIチャットのツール呼び出しから使用）
// scopes で「AIに見せてよい情報」を分けて指定できる。
export const getStudyContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ scopes: z.array(z.enum(STUDY_SCOPES)).optional() }).optional().parse(i ?? {}),
  )

  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scopes = new Set<string>(data?.scopes ?? [...STUDY_SCOPES]);
    const on = (s: StudyScope) => scopes.has(s);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const empty = { data: [] as any[] };

    const [logsR, subjR, goalsR, qR, profR, examsR, todosR, cardsR, packsR] = await Promise.all([
      on("study") || on("notes")
        ? supabase.from("study_logs").select("date, duration_minutes, content, subjects(name)").eq("user_id", userId).gte("date", since).order("date", { ascending: false }).limit(200)
        : empty,
      on("study") ? supabase.from("subjects").select("name").eq("user_id", userId) : empty,
      on("goals") ? supabase.from("goals").select("title, target_minutes, progress_minutes, deadline, done").eq("user_id", userId).eq("done", false).limit(10) : empty,
      on("weak") ? supabase.from("questions").select("topic, was_wrong, attempts").eq("user_id", userId).limit(500) : empty,
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      on("exams") ? (supabase as any).from("exams").select("name, start_date, end_date").eq("user_id", userId).gte("start_date", new Date().toISOString().slice(0, 10)).order("start_date", { ascending: true }).limit(5) : empty,
      on("exams") ? (supabase as any).from("exam_todos").select("text, done").eq("user_id", userId).eq("done", false).limit(15) : empty,
      on("flashcards") ? (supabase as any).from("flashcards").select("front, reviews, ease, next_review_at").eq("user_id", userId).order("ease", { ascending: true }).limit(15) : empty,
      on("markon") ? (supabase as any).from("makron_pack_attempts").select("attempts_count, xp_earned_total, last_attempt_at, makron_packs(title)").eq("user_id", userId).order("last_attempt_at", { ascending: false }).limit(10) : empty,
    ]);

    const logs = (logsR.data ?? []) as any[];
    const totalMin = logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
    const dayMap = new Map<string, number>();
    logs.forEach((l) => dayMap.set(l.date, (dayMap.get(l.date) ?? 0) + (l.duration_minutes ?? 0)));
    const activeDays = Array.from(dayMap.values()).filter((v) => v > 0).length;

    const subjAgg = new Map<string, number>();
    logs.forEach((l) => {
      const k = l.subjects?.name ?? "その他";
      subjAgg.set(k, (subjAgg.get(k) ?? 0) + (l.duration_minutes ?? 0));
    });
    const topSubjects = Array.from(subjAgg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const topicAgg = new Map<string, { wrong: number; total: number }>();
    (qR.data ?? []).forEach((q: any) => {
      const c = topicAgg.get(q.topic) ?? { wrong: 0, total: 0 };
      c.total++;
      if (q.was_wrong) c.wrong++;
      topicAgg.set(q.topic, c);
    });
    const weakTopics = Array.from(topicAgg.entries())
      .filter(([, v]) => v.wrong > 0)
      .sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 5);

    const recentNotes = on("notes")
      ? logs.slice(0, 5).map((l) => `- ${l.date}: ${l.subjects?.name ?? ""} ${l.duration_minutes}分 ${l.content ?? ""}`).join("\n")
      : "";

    return {
      scopes: Array.from(scopes),
      displayName: (profR.data as any)?.display_name ?? "生徒",
      totalMinutes30d: on("study") ? totalMin : null,
      activeDays30d: on("study") ? activeDays : null,
      subjectsRegistered: (subjR.data ?? []).map((s: any) => s.name),
      topSubjects: topSubjects.map(([n, m]) => ({ name: n, minutes: m })),
      activeGoals: goalsR.data ?? [],
      weakTopics: weakTopics.map(([t, v]) => ({ topic: t, wrong: v.wrong, total: v.total })),
      recentNotes,
      upcomingExams: (examsR.data ?? []).map((e: any) => ({ title: e.title, date: e.exam_date, target: e.target_score })),
      examTodos: (todosR.data ?? []).map((t: any) => t.title),
      hardCards: (cardsR.data ?? []).filter((c: any) => (c.wrong_count ?? 0) > 0).map((c: any) => ({ front: c.front, wrong: c.wrong_count, correct: c.correct_count })),
      markonRecent: (packsR.data ?? []).map((a: any) => ({ score: a.score, total: a.total, at: a.created_at })),
    };
  });


export const listTutorThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("tutor_threads").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createTutorThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ title: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("tutor_threads").insert({ user_id: context.userId, title: data.title ?? "新しいチャット" }).select().single();
    if (error) throw error;
    return row;
  });

export const renameTutorThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), title: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("tutor_threads").update({ title: data.title, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTutorThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await (context.supabase as any).from("tutor_messages").delete().eq("thread_id", data.id);
    const { error } = await (context.supabase as any).from("tutor_threads").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
