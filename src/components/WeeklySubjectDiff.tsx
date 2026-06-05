import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

/** Today vs 7-days-ago: per-subject minutes diff. */
export function WeeklySubjectDiff() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{ name: string; color: string; thisWeek: number; lastWeek: number }>>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const start = new Date(today); start.setDate(start.getDate() - 13);
      const startStr = start.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("study_logs")
        .select("date, duration_minutes, subjects(name,color)")
        .eq("user_id", user.id).gte("date", startStr);
      const map = new Map<string, { name: string; color: string; thisWeek: number; lastWeek: number }>();
      const mid = new Date(today); mid.setDate(mid.getDate() - 7);
      for (const r of (data ?? []) as any[]) {
        const s = r.subjects ?? { name: "未指定", color: "#94a3b8" };
        const key = s.name;
        const cur = map.get(key) ?? { name: s.name, color: s.color, thisWeek: 0, lastWeek: 0 };
        const isThis = new Date(r.date + "T00:00:00") >= mid;
        if (isThis) cur.thisWeek += r.duration_minutes ?? 0;
        else cur.lastWeek += r.duration_minutes ?? 0;
        map.set(key, cur);
      }
      setRows(Array.from(map.values()).sort((a, b) => b.thisWeek - a.thisWeek));
    })();
  }, [user]);

  if (rows.length === 0) return null;
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">教科別 週次差分</h3>
      <div className="space-y-2">
        {rows.map((r) => {
          const diff = r.thisWeek - r.lastWeek;
          const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
          const cls = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-muted-foreground";
          return (
            <div key={r.name} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-sm" style={{ background: r.color }} />
              <span className="flex-1 truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">{r.thisWeek}分</span>
              <span className={`inline-flex items-center gap-0.5 w-16 justify-end tabular-nums ${cls}`}>
                <Icon className="h-3 w-3" />{Math.abs(diff)}分
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}