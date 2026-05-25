import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ユーザーの学習コンテキストを集約して返す（家庭教師AIに渡す）
export const getStudyContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

    const [logsR, subjR, goalsR, qR, profR] = await Promise.all([
      supabase.from("study_logs").select("date, duration_minutes, content, subjects(name)").eq("user_id", userId).gte("date", since).order("date", { ascending: false }).limit(200),
      supabase.from("subjects").select("name").eq("user_id", userId),
      supabase.from("goals").select("title, target_minutes, progress_minutes, deadline, done").eq("user_id", userId).eq("done", false).limit(10),
      supabase.from("questions").select("topic, was_wrong, attempts").eq("user_id", userId).limit(500),
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
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

    const recentNotes = logs.slice(0, 5).map((l) => `- ${l.date}: ${l.subjects?.name ?? ""} ${l.duration_minutes}分 ${l.content ?? ""}`).join("\n");

    return {
      displayName: (profR.data as any)?.display_name ?? "生徒",
      totalMinutes30d: totalMin,
      activeDays30d: activeDays,
      subjectsRegistered: (subjR.data ?? []).map((s: any) => s.name),
      topSubjects: topSubjects.map(([n, m]) => ({ name: n, minutes: m })),
      activeGoals: goalsR.data ?? [],
      weakTopics: weakTopics.map(([t, v]) => ({ topic: t, wrong: v.wrong, total: v.total })),
      recentNotes,
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
