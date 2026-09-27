import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LinePrefs = {
  reminder_enabled: boolean;
  reminder_weekday_time: string;
  reminder_weekend_time: string;
  reminder_days: number[];
  reminder_tone: "gentle" | "strict" | "plain";
  homework_alert_24h: boolean;
  homework_alert_3h: boolean;
  daily_report_enabled: boolean;
  daily_report_time: string;
  weekly_report_enabled: boolean;
  forward_app_notifications: boolean;
  test_countdown_enabled: boolean;
  quiet_enabled: boolean;
  quiet_from: string;
  quiet_to: string;
  security_login_alert: boolean;
  parent_finish_report: boolean;
  parent_extension_request: boolean;
};

export const DEFAULT_LINE_PREFS: LinePrefs = {
  reminder_enabled: false,
  reminder_weekday_time: "19:00",
  reminder_weekend_time: "10:00",
  reminder_days: [0, 1, 2, 3, 4, 5, 6],
  reminder_tone: "gentle",
  homework_alert_24h: true,
  homework_alert_3h: true,
  daily_report_enabled: false,
  daily_report_time: "21:30",
  weekly_report_enabled: false,
  forward_app_notifications: false,
  test_countdown_enabled: true,
  quiet_enabled: true,
  quiet_from: "22:00",
  quiet_to: "07:00",
  security_login_alert: true,
  parent_finish_report: true,
  parent_extension_request: true,
};

const prefsSchema = z.object({
  reminder_enabled: z.boolean(),
  reminder_weekday_time: z.string().max(8),
  reminder_weekend_time: z.string().max(8),
  reminder_days: z.array(z.number().int().min(0).max(6)).max(7),
  reminder_tone: z.enum(["gentle", "strict", "plain"]),
  homework_alert_24h: z.boolean(),
  homework_alert_3h: z.boolean(),
  daily_report_enabled: z.boolean(),
  daily_report_time: z.string().max(8),
  weekly_report_enabled: z.boolean(),
  forward_app_notifications: z.boolean(),
  test_countdown_enabled: z.boolean(),
  quiet_enabled: z.boolean(),
  quiet_from: z.string().max(8),
  quiet_to: z.string().max(8),
  security_login_alert: z.boolean(),
  parent_finish_report: z.boolean(),
  parent_extension_request: z.boolean(),
});

export const getLinePreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_line_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ...DEFAULT_LINE_PREFS, ...(data ?? {}) } as LinePrefs;
  });

export const saveLinePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => prefsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_line_preferences")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send a test push so the user can confirm the LINE connection works. */
export const sendLineTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { pushToLineUser, textMessage } = await import("@/lib/line-messaging.server");
    const { data } = await context.supabase
      .from("profiles")
      .select("line_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    const lineId = (data as { line_user_id?: string } | null)?.line_user_id;
    if (!lineId) throw new Error("LINEと連携していません");
    const res = await pushToLineUser(lineId, [
      textMessage("Study# からのテスト通知です。この設定で通知が届きます。"),
    ]);
    if (!res.ok) throw new Error("送信できませんでした。LINEの友だち追加を確認してください");
    return { ok: true };
  });
