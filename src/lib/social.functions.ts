import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE_SIZE = 20;

export const createSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    body: z.string().min(1).max(4000),
    minutes: z.number().int().min(0).max(1440).nullable().optional(),
    subject: z.string().max(100).nullable().optional(),
    organizationId: z.string().uuid().nullable().optional(),
    visibility: z.enum(["public", "followers", "private"]).default("public"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("social_posts").insert({
      user_id: userId,
      body: data.body.trim(),
      minutes: data.minutes ?? null,
      subject: data.subject?.trim() || null,
      organization_id: data.organizationId ?? null,
      visibility: data.organizationId ? "public" : data.visibility,
    } as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// タブ: all(閲覧可能な全体) / following(フォロー中のみ) / mine(自分のみ)
export const listFeedPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    scope: z.enum(["all", "following", "mine"]).default("all"),
    organizationId: z.string().uuid().nullable().optional(),
    page: z.number().int().min(0).max(200).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let userIds: string[] | null = null;
    if (data.scope === "following") {
      const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", userId).eq("status", "accepted");
      userIds = (f ?? []).map((r: any) => r.following_id);
      if (userIds.length === 0) return { posts: [], hasMore: false };
    } else if (data.scope === "mine") {
      userIds = [userId];
    }

    let q = supabase.from("social_posts").select("*").order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE);

    if (data.organizationId) q = q.eq("organization_id", data.organizationId);
    else if (data.scope !== "mine") q = q.is("organization_id", null);

    if (userIds) q = q.in("user_id", userIds);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const posts = (rows ?? []).slice(0, PAGE_SIZE);
    const hasMore = (rows ?? []).length > PAGE_SIZE;
    return { posts, hasMore };
  });
