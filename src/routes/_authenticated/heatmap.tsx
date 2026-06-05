import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/heatmap")({ component: HeatmapPage });

function HeatmapPage() {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 365);
    supabase.from("study_logs").select("date,duration_minutes").eq("user_id", user.id).gte("date", since.toISOString().slice(0, 10))
      .then(({ data }) => {
        const m: Record<string, number> = {};
        for (const r of (data ?? []) as any[]) m[r.date] = (m[r.date] ?? 0) + (r.duration_minutes ?? 0);
        setMap(m);
      });
  }, [user]);

  const days: string[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 364);
  const dow = start.getDay();
  start.setDate(start.getDate() - dow); // align to Sunday
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const total = Object.values(map).reduce((s, v) => s + v, 0);
  const active = Object.values(map).filter((v) => v > 0).length;

  const cellColor = (min: number) => {
    if (!min) return "bg-muted/40";
    if (min < 30) return "bg-primary/20";
    if (min < 60) return "bg-primary/40";
    if (min < 120) return "bg-primary/60";
    if (min < 180) return "bg-primary/80";
    return "bg-primary";
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">ヒートマップ（直近1年）</h1>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">合計</div><div className="text-2xl font-bold tabular-nums">{Math.floor(total/60)}h {total%60}m</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">活動日数</div><div className="text-2xl font-bold tabular-nums">{active}日</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">平均/活動日</div><div className="text-2xl font-bold tabular-nums">{active ? Math.round(total/active) : 0}分</div></Card>
      </div>
      <Card className="p-4 overflow-x-auto">
        <div className="inline-flex gap-1">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-1">
              {w.map((d) => {
                const m = map[d] ?? 0;
                return (
                  <div key={d} title={`${d}: ${m}分`} className={`h-3 w-3 rounded-sm ${cellColor(m)} ${d > today.toISOString().slice(0,10) ? "opacity-30" : ""}`} />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>少</span>
          {[0, 20, 50, 100, 150, 200].map((m) => <div key={m} className={`h-3 w-3 rounded-sm ${cellColor(m)}`} />)}
          <span>多</span>
        </div>
      </Card>
    </div>
  );
}