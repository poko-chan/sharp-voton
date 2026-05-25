import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let code = "";
    for (let i = 0; i < 6; i++) {
      code = genCode();
      const { data: exists } = await supabase.from("classes").select("id").eq("invite_code", code).maybeSingle();
      if (!exists) break;
    }
    const { data: cls, error } = await supabase.from("classes").insert({
      owner_id: userId, name: data.name, description: data.description, invite_code: code,
    }).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("class_members").insert({ class_id: cls.id, user_id: userId, role: "teacher" });
    return cls;
  });

export const joinClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(4).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: r, error } = await supabase.rpc("join_class_by_code" as any, { _code: data.code.toUpperCase() });
    if (error) throw new Error(error.message);
    return { classId: r as unknown as string };
  });

export const gradeSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    submissionId: z.string().uuid(),
    score: z.number().int().min(0).max(10000),
    feedback: z.string().max(5000).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error: e1 } = await supabase.from("submissions").select("id, assignment_id, user_id").eq("id", data.submissionId).single();
    if (e1) throw new Error(e1.message);
    const { data: asg, error: e2 } = await supabase.from("assignments").select("xp_mode, fixed_xp, max_points, class_id").eq("id", sub.assignment_id).single();
    if (e2) throw new Error(e2.message);
    let xp = 0;
    if (asg.xp_mode === "score") xp = data.score;
    else if (asg.xp_mode === "fixed") xp = asg.fixed_xp;
    const { error: e3 } = await supabase.from("submissions").update({
      score: data.score, feedback: data.feedback, graded_at: new Date().toISOString(),
      graded_by: userId, xp_awarded: xp,
    }).eq("id", data.submissionId);
    if (e3) throw new Error(e3.message);
    return { xp };
  });

export const getMyClassroomXp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("submissions").select("xp_awarded").eq("user_id", userId);
    return (data ?? []).reduce((s, r) => s + (r.xp_awarded ?? 0), 0);
  });
