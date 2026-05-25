import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const q = supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", context.userId);
    if (data.all) {
      const { error } = await q.is("read_at", null);
      if (error) throw new Error(error.message);
    } else if (data.id) {
      const { error } = await q.eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      ids: z.array(z.string().uuid()).optional(),
      all: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const base = supabaseAdmin.from("notifications").delete().eq("user_id", context.userId);
    if (data.all) {
      const { error } = await base;
      if (error) throw new Error(error.message);
    } else if (data.ids && data.ids.length > 0) {
      const { error } = await base.in("id", data.ids);
      if (error) throw new Error(error.message);
    } else if (data.id) {
      const { error } = await base.eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const unreadCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { count: count ?? 0 };
  });

