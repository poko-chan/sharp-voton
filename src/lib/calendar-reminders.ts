import { supabase } from "@/integrations/supabase/client";
import { localDateStr } from "@/lib/date";

/**
 * 当日のカレンダー予定（イベント・勉強予定）を通知として作成する。
 * 端末側の localStorage で「同じ予定を同じ日に二重通知しない」ように制御する。
 */
export async function syncCalendarNotifications(userId: string): Promise<void> {
  const today = localDateStr(new Date());
  const key = `study.calnotif.${userId}.${today}`;
  let done: string[] = [];
  try {
    done = JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    done = [];
  }

  const [evRes, planRes] = await Promise.all([
    (supabase as any)
      .from("events")
      .select("id,title,start_time")
      .eq("user_id", userId)
      .eq("date", today),
    supabase
      .from("study_plans")
      .select("id,content,start_time,planned_minutes,done")
      .eq("user_id", userId)
      .eq("date", today),
  ]);

  const rows: Array<{ user_id: string; type: string; title: string; body: string; link: string }> = [];
  const marked: string[] = [];
  const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : null);

  for (const ev of (evRes.data ?? []) as any[]) {
    const k = `ev:${ev.id}`;
    if (done.includes(k)) continue;
    marked.push(k);
    const time = hhmm(ev.start_time);
    rows.push({
      user_id: userId,
      type: "calendar",
      title: "今日の予定",
      body: `${time ? `${time} ` : ""}${ev.title}`,
      link: "/calendar",
    });
  }

  for (const p of (planRes.data ?? []) as any[]) {
    if (p.done) continue;
    const k = `pl:${p.id}`;
    if (done.includes(k)) continue;
    marked.push(k);
    const time = hhmm(p.start_time);
    const label = (p.content ?? "").trim() || "勉強の予定";
    rows.push({
      user_id: userId,
      type: "calendar",
      title: "今日の勉強予定",
      body: `${time ? `${time} ` : ""}${label}${p.planned_minutes ? `（${p.planned_minutes}分）` : ""}`,
      link: "/calendar",
    });
  }

  if (rows.length === 0) {
    if (marked.length) {
      try { localStorage.setItem(key, JSON.stringify([...done, ...marked])); } catch { /* noop */ }
    }
    return;
  }

  const { error } = await supabase.from("notifications").insert(rows as any);
  if (error) return;
  try { localStorage.setItem(key, JSON.stringify([...done, ...marked])); } catch { /* noop */ }
}
