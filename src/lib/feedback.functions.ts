import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const FEEDBACK_CATEGORIES = ["bug", "feature", "question", "praise", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

// Categories that are action-required (vs. review-only like "praise")
export const ACTION_CATEGORIES: FeedbackCategory[] = ["bug", "feature", "question", "other"];
export const REVIEW_ONLY_CATEGORIES: FeedbackCategory[] = ["praise"];

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email().max(255).optional().nullable(),
      category: z.enum(FEEDBACK_CATEGORIES).default("other"),
      body: z.string().trim().min(3, "3文字以上で入力してください").max(4000),
      route: z.string().max(500).optional().nullable(),
      userAgent: z.string().max(500).optional().nullable(),
      userId: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("feedback").insert({
      user_id: data.userId ?? null,
      email: data.email ?? null,
      category: data.category,
      body: data.body,
      route: data.route ?? null,
      user_agent: data.userAgent ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("管理者権限が必要です");
}

export const adminListFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const STATUS_LABEL: Record<string, string> = {
  open: "未対応",
  in_progress: "対応中",
  resolved: "解決済み",
  wontfix: "対応しない",
};

export const adminUpdateFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "in_progress", "resolved", "wontfix"]).optional(),
      adminReply: z.string().max(4000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // load existing
    const { data: existing } = await supabaseAdmin
      .from("feedback").select("user_id, status, admin_reply, body").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("見つかりません");

    const patch: any = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.adminReply !== undefined) {
      patch.admin_reply = data.adminReply;
      patch.replied_at = data.adminReply ? new Date().toISOString() : null;
    }
    const { error } = await supabaseAdmin.from("feedback").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notify submitter if registered
    if (existing.user_id) {
      const events: { title: string; body: string }[] = [];
      if (data.status !== undefined && data.status !== existing.status) {
        events.push({
          title: `フィードバックの状態が「${STATUS_LABEL[data.status] ?? data.status}」になりました`,
          body: existing.body?.slice(0, 120) ?? "",
        });
      }
      if (data.adminReply !== undefined && (data.adminReply ?? "") !== (existing.admin_reply ?? "")) {
        events.push({
          title: "管理者から返信があります",
          body: (data.adminReply ?? "").slice(0, 200),
        });
      }
      if (events.length > 0 && existing.user_id) {
        const uid = existing.user_id;
        await supabaseAdmin.from("notifications").insert(
          events.map((e) => ({
            user_id: uid,
            type: "feedback",
            title: e.title,
            body: e.body,
            link: "/notifications",
          })),
        );
        await supabaseAdmin.from("feedback").update({ user_notified_at: new Date().toISOString() }).eq("id", data.id);
      }
    }

    return { ok: true };
  });

export const adminDeleteFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("feedback").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
 *  1-on-1 Admin Chat (built on top of feedback table)
 * ============================================================ */

export const listMyThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: threads } = await supabaseAdmin
      .from("feedback")
      .select("id, category, body, status, created_at, admin_reply, replied_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = (threads ?? []).map((t) => t.id);
    if (ids.length === 0) return [] as any[];
    const { data: msgs } = await (supabaseAdmin as any)
      .from("feedback_messages")
      .select("feedback_id, sender_role, body, created_at, read_at")
      .in("feedback_id", ids)
      .order("created_at", { ascending: false });
    const byThread = new Map<string, any[]>();
    (msgs ?? []).forEach((m: any) => {
      const arr = byThread.get(m.feedback_id) ?? [];
      arr.push(m);
      byThread.set(m.feedback_id, arr);
    });
    return (threads ?? []).map((t) => {
      const arr = byThread.get(t.id) ?? [];
      const latest = arr[0];
      const unread = arr.filter((m) => m.sender_role === "admin" && !m.read_at).length;
      return { ...t, latest, unread };
    });
  });

export const getThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ feedbackId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: fb } = await supabaseAdmin
      .from("feedback").select("user_id, category, body, status, created_at, admin_reply")
      .eq("id", data.feedbackId).maybeSingle();
    if (!fb) throw new Error("見つかりません");
    const isOwner = fb.user_id === context.userId;
    let isAdmin = false;
    if (!isOwner) {
      const { data: r } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
      isAdmin = !!r;
    }
    if (!isOwner && !isAdmin) throw new Error("権限がありません");
    const { data: msgs } = await (supabaseAdmin as any)
      .from("feedback_messages")
      .select("*")
      .eq("feedback_id", data.feedbackId)
      .order("created_at", { ascending: true });
    const otherRole = isOwner ? "admin" : "user";
    await (supabaseAdmin as any)
      .from("feedback_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("feedback_id", data.feedbackId)
      .eq("sender_role", otherRole)
      .is("read_at", null);
    return { thread: fb, messages: (msgs ?? []) as any[] };
  });

export const postThreadMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      feedbackId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: fb } = await supabaseAdmin
      .from("feedback").select("user_id").eq("id", data.feedbackId).maybeSingle();
    if (!fb) throw new Error("スレッドが見つかりません");
    const isOwner = fb.user_id === context.userId;
    let isAdmin = false;
    if (!isOwner) {
      const { data: r } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
      isAdmin = !!r;
    }
    if (!isOwner && !isAdmin) throw new Error("権限がありません");
    const role = isOwner ? "user" : "admin";
    const { error } = await (supabaseAdmin as any).from("feedback_messages").insert({
      feedback_id: data.feedbackId,
      sender_id: context.userId,
      sender_role: role,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    if (role === "admin" && fb.user_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: fb.user_id,
        type: "feedback",
        title: "管理者から返信があります",
        body: data.body.slice(0, 200),
        link: "/notifications",
      });
    }
    return { ok: true };
  });

export const startThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      category: z.enum(FEEDBACK_CATEGORIES).default("other"),
      body: z.string().trim().min(1).max(4000),
      route: z.string().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", context.userId).maybeSingle();
    const { data: fb, error } = await supabaseAdmin
      .from("feedback")
      .insert({
        user_id: context.userId,
        email: prof?.email ?? null,
        category: data.category,
        body: data.body,
        route: data.route ?? null,
      })
      .select("id").single();
    if (error || !fb) throw new Error(error?.message ?? "送信に失敗しました");
    await (supabaseAdmin as any).from("feedback_messages").insert({
      feedback_id: fb.id,
      sender_id: context.userId,
      sender_role: "user",
      body: data.body,
    });
    return { feedbackId: fb.id };
  });

export const myThreadsUnreadCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: threads } = await supabaseAdmin
      .from("feedback").select("id").eq("user_id", context.userId);
    const ids = (threads ?? []).map((t) => t.id);
    if (ids.length === 0) return { count: 0 };
    const { count } = await (supabaseAdmin as any)
      .from("feedback_messages")
      .select("id", { count: "exact", head: true })
      .in("feedback_id", ids)
      .eq("sender_role", "admin")
      .is("read_at", null);
    return { count: count ?? 0 };
  });

