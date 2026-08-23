import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const attachmentSchema = z.object({
  name: z.string().max(255),
  url: z.string().url().max(1000),
  size: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
  type: z.string().max(100).optional(),
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    classId: z.string().uuid(),
    title: z.string().max(200).optional().default(""),
    body: z.string().min(1).max(10000),
    attachments: z.array(attachmentSchema).max(10).optional().default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("class_posts").insert({
      class_id: data.classId, author_id: userId,
      title: data.title || null, body: data.body, attachments: data.attachments,
    } as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("class_posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    postId: z.string().uuid(),
    classId: z.string().uuid(),
    body: z.string().min(1).max(4000),
    privateTo: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("class_post_comments").insert({
      post_id: data.postId, class_id: data.classId, author_id: userId,
      body: data.body, private_to: data.privateTo ?? null,
    } as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ commentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("class_post_comments").delete().eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Auto-grade quiz submissions
export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assignmentId: z.string().uuid(),
    answers: z.array(z.object({
      questionId: z.string(),
      answer: z.string().max(2000),
    })).max(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // 受講者であることを RLS 経由で確認してから、正解キーは管理クライアントで読む
    const { data: visible, error: e1 } = await supabase.from("assignments")
      .select("id, kind").eq("id", data.assignmentId).single();
    if (e1 || !visible) throw new Error("課題が見つかりません");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: asg } = await supabaseAdmin.from("assignments")
      .select("id, kind, quiz_questions, quiz_answer_key, max_points, xp_mode, fixed_xp")
      .eq("id", data.assignmentId).single();
    if (!asg) throw new Error("課題が見つかりません");
    if (asg.kind !== "quiz" || !asg.quiz_questions) throw new Error("小テストではありません");

    const keyMap = new Map<string, string>(
      ((asg as any).quiz_answer_key as any[] ?? []).map((k: any) => [String(k.id), String(k.answer ?? "")]),
    );
    const questions = (asg.quiz_questions as any[]).map((q: any) => ({ ...q, answer: keyMap.get(String(q.id)) ?? q.answer }));
    let totalPts = 0;
    let earnedPts = 0;
    const detail: any[] = [];

    for (const q of questions) {
      const pts = Number(q.points ?? 1);
      totalPts += pts;
      const userAns = data.answers.find((a) => a.questionId === q.id)?.answer ?? "";
      const correct = String(q.answer ?? "").trim().toLowerCase() === userAns.trim().toLowerCase();
      if (correct) earnedPts += pts;
      detail.push({ questionId: q.id, userAnswer: userAns, correct, expected: q.answer });
    }
    const score = totalPts > 0
      ? Math.round((earnedPts / totalPts) * (asg.max_points ?? 100))
      : 0;
    let xp = 0;
    if (asg.xp_mode === "score") xp = score;
    else if (asg.xp_mode === "fixed") xp = asg.fixed_xp ?? 0;

    // upsert submission
    const { data: existing } = await supabase.from("submissions").select("id")
      .eq("assignment_id", data.assignmentId).eq("user_id", userId).maybeSingle();
    const payload: any = {
      assignment_id: data.assignmentId, user_id: userId,
      content: `自動採点: ${earnedPts}/${totalPts}点`,
      quiz_answers: { answers: data.answers, detail, earned: earnedPts, total: totalPts },
      score, xp_awarded: xp, graded_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("submissions").update(payload).eq("id", existing.id)
      : await supabase.from("submissions").insert(payload);
    if (error) throw new Error(error.message);
    return { score, earnedPts, totalPts, xp, detail };
  });
