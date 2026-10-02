import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled LINE delivery: study reminders + daily / weekly reports.
 * Call it every 10 minutes from pg_cron or any external scheduler.
 * Nothing here is user specific in the response — it only reports counts.
 */

const jstNow = () => new Date(Date.now() + 9 * 3600_000);
const jstDate = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10);

function minutesOf(hhmm: string | null | undefined) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

const REMINDER_TEXT: Record<string, string> = {
  gentle: "そろそろ勉強の時間だよ。今日も少しだけやってみよう！",
  strict: "勉強の時間です。今日の分を始めましょう。",
  plain: "学習リマインダーです。",
};

function topRanking(map: Map<string, number>, limit = 3) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, min], i) => `${i + 1}. ${name}（${min}分）`)
    .join("\n");
}

export const Route = createFileRoute("/api/public/line/cron")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { pushToLineUser, textMessage, cardMessage, inQuietHours } =
          await import("@/lib/line-messaging.server");

        const now = jstNow();
        const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
        const dow = now.getUTCDay();
        const isWeekend = dow === 0 || dow === 6;
        const within = (target: number | null) => target !== null && Math.abs(cur - target) <= 5;

        const { data: prefs } = await supabaseAdmin
          .from("user_line_preferences")
          .select("*")
          .or(
            "reminder_enabled.eq.true,daily_report_enabled.eq.true,weekly_report_enabled.eq.true",
          );

        let reminders = 0;
        let reports = 0;

        for (const p of (prefs ?? []) as any[]) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("line_user_id, display_name, username")
            .eq("id", p.user_id)
            .maybeSingle();
          const lineId = (prof as any)?.line_user_id as string | undefined;
          if (!lineId) continue;
          if (p.quiet_enabled && inQuietHours(p.quiet_from, p.quiet_to)) continue;

          // --- reminder ---
          const reminderTime = minutesOf(
            isWeekend ? p.reminder_weekend_time : p.reminder_weekday_time,
          );
          const days: number[] = Array.isArray(p.reminder_days) ? p.reminder_days : [];
          if (p.reminder_enabled && within(reminderTime) && days.includes(dow)) {
            await pushToLineUser(lineId, [
              textMessage(REMINDER_TEXT[p.reminder_tone] ?? REMINDER_TEXT.plain),
            ]);
            reminders++;
          }

          // --- reports ---
          const wantDaily = p.daily_report_enabled && within(minutesOf(p.daily_report_time));
          const wantWeekly =
            p.weekly_report_enabled && dow === 0 && within(minutesOf(p.daily_report_time));
          if (!wantDaily && !wantWeekly) continue;

          const spanDays = wantWeekly ? 7 : 1;
          const since = jstDate(spanDays - 1);
          const { data: logs } = await supabaseAdmin
            .from("study_logs")
            .select("date, duration_minutes, subject_id, material_id")
            .eq("user_id", p.user_id)
            .gte("date", since);

          const rows = (logs ?? []) as any[];
          const total = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);

          const subjIds = [...new Set(rows.map((r) => r.subject_id).filter(Boolean))];
          const matIds = [...new Set(rows.map((r) => r.material_id).filter(Boolean))];
          const [{ data: subs }, { data: mats }] = await Promise.all([
            subjIds.length
              ? supabaseAdmin.from("subjects").select("id, name").in("id", subjIds)
              : Promise.resolve({ data: [] as any[] }),
            matIds.length
              ? supabaseAdmin.from("materials").select("id, title").in("id", matIds)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          const subjName = new Map((subs ?? []).map((s: any) => [s.id, s.name]));
          const matName = new Map((mats ?? []).map((m: any) => [m.id, m.title]));

          const bySubject = new Map<string, number>();
          const byMaterial = new Map<string, number>();
          for (const r of rows) {
            if (r.subject_id) {
              const k = subjName.get(r.subject_id) ?? "その他";
              bySubject.set(k, (bySubject.get(k) ?? 0) + (r.duration_minutes ?? 0));
            }
            if (r.material_id) {
              const k = matName.get(r.material_id) ?? "その他";
              byMaterial.set(k, (byMaterial.get(k) ?? 0) + (r.duration_minutes ?? 0));
            }
          }

          // streak: consecutive days with a study log, ending today or yesterday
          const { data: allLogs } = await supabaseAdmin
            .from("study_logs")
            .select("date")
            .eq("user_id", p.user_id)
            .gte("date", jstDate(120));
          const dates = new Set((allLogs ?? []).map((l: any) => l.date));
          let streak = 0;
          for (let i = 0; i < 120; i++) {
            if (dates.has(jstDate(i))) streak++;
            else if (i > 0) break;
          }

          await pushToLineUser(lineId, [
            cardMessage(wantWeekly ? "今週の学習レポート" : "今日の学習レポート", [
              ["学習時間", `${total}分`],
              ["教科ランキング", topRanking(bySubject) || "記録なし"],
              ["教材ランキング", topRanking(byMaterial) || "記録なし"],
              ["連続ストリーク", `${streak}日`],
            ]),
          ]);
          reports++;
        }

        return Response.json({ ok: true, reminders, reports });
      },
      GET: async () => Response.json({ ok: true, hint: "POST this endpoint from a scheduler." }),
    },
  },
});
