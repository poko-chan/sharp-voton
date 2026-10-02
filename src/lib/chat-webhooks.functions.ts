import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatWebhooks = {
  discord_url: string;
  slack_url: string;
  notify_study_finished: boolean;
};

const discordRe = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//;
const slackRe = /^https:\/\/hooks\.slack\.com\/services\//;

async function post(w: { discord_url?: string | null; slack_url?: string | null }, text: string) {
  const jobs: Promise<unknown>[] = [];
  if (w.discord_url && discordRe.test(w.discord_url))
    jobs.push(
      fetch(w.discord_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, username: "Study#" }),
      }),
    );
  if (w.slack_url && slackRe.test(w.slack_url))
    jobs.push(
      fetch(w.slack_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }),
    );
  await Promise.allSettled(jobs);
  return jobs.length;
}

export const getChatWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatWebhooks> => {
    const { data } = await context.supabase
      .from("user_chat_webhooks" as never)
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const d = (data ?? {}) as Partial<ChatWebhooks>;
    return {
      discord_url: d.discord_url ?? "",
      slack_url: d.slack_url ?? "",
      notify_study_finished: d.notify_study_finished ?? true,
    };
  });

export const saveChatWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        discord_url: z
          .string()
          .max(300)
          .refine((v) => !v || discordRe.test(v), "Discord URLが正しくありません"),
        slack_url: z
          .string()
          .max(300)
          .refine((v) => !v || slackRe.test(v), "Slack URLが正しくありません"),
        notify_study_finished: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_chat_webhooks" as never).upsert(
      {
        user_id: context.userId,
        discord_url: data.discord_url || null,
        slack_url: data.slack_url || null,
        notify_study_finished: data.notify_study_finished,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testChatWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_chat_webhooks" as never)
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const n = await post((data ?? {}) as ChatWebhooks, "✅ Study# からのテスト通知です");
    if (!n) throw new Error("通知先が設定されていません");
    return { sent: n };
  });

export const notifyChatStudyFinished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ minutes: z.number().min(0).max(1440) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: w } = await context.supabase
      .from("user_chat_webhooks" as never)
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = w as (ChatWebhooks & { notify_study_finished: boolean }) | null;
    if (!row?.notify_study_finished) return { sent: 0 };
    const sent = await post(row, `📚 Study# で ${data.minutes} 分勉強しました！`);
    return { sent };
  });
