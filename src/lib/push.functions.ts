import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pushToUser } from "./push.server";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(
  async () => process.env["VAPID_PUBLIC_KEY"] ?? "",
);

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        endpoint: z.string().url().max(1000),
        p256dh: z.string().max(200),
        auth: z.string().max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions" as never)
      .upsert({ ...data, user_id: context.userId } as never, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ endpoint: z.string().max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_subscriptions" as never)
      .delete()
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const n = await pushToUser(context.userId);
    if (!n) throw new Error("この端末で通知がオンになっていません");
    return { sent: n };
  });
