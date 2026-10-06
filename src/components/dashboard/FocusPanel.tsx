import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PowerBar } from "@/components/RadialGauge";
import { useTimer, fmtMs } from "@/lib/timer-context";
import { localDateStr, addDaysStr } from "@/lib/date";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Timer, Play, Clock3, Flame, Activity } from "lucide-react";

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60}m` : `${m}m`);

export function FocusPanel({ dailyGoal }: { dailyGoal: number }) {
  const { user } = useAuth();
  const { state, elapsedMs, remainingMs } = useTimer();

  const { data } = useQuery({
    queryKey: ["focus-panel", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const since = addDaysStr(new Date(), -59);
      const { data: logs } = await supabase
          .from("study_logs")
          .select("date, duration_minutes, subject_id, start_time")
          .eq("user_id", user!.id)
          .gte("date", since)
          .order("date", { ascending: true });
      return { logs: logs ?? [] };
    },
  });

  const view = useMemo(() => {
    const logs = data?.logs ?? [];
    const dayMap = new Map<string, number>();
    for (const l of logs as any[]) {
      dayMap.set(l.date, (dayMap.get(l.date) ?? 0) + (l.duration_minutes ?? 0));
    }
    const today = localDateStr();
    const base = new Date();
    const todayMin = dayMap.get(today) ?? 0;

    const series: { day: string; minutes: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const key = addDaysStr(base, -i);
      series.push({ day: key.slice(5).replace("-", "/"), minutes: dayMap.get(key) ?? 0 });
    }

    const week = series.slice(-7).reduce((s, d) => s + d.minutes, 0);
    const sessions = (logs as any[]).filter((l) => l.date === today).length;
    const avgSession = sessions ? Math.round(todayMin / sessions) : 0;

    return {
      todayMin,
      week,
      sessions,
      avgSession,
      series,
    };
  }, [data]);

  const pct = Math.min(100, (view.todayMin / Math.max(1, dailyGoal)) * 100);
  const running = state?.running;
  const liveLabel = state
    ? state.kind === "stopwatch"
      ? fmtMs(elapsedMs)
      : fmtMs(remainingMs)
    : null;

  return (
    <Card className="p-4 md:p-6 space-y-5 liquid-card border-primary/15 shadow-[0_20px_55px_-38px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-2xl bg-primary/12 text-primary grid place-items-center ring-1 ring-primary/15">
            <Timer className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-bold leading-tight text-lg">タイマー & 学習時間</h2>
            <p className="text-[11px] text-muted-foreground">
              タイマーで集中した時間が学習記録に反映されます
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state && (
            <Badge variant={running ? "default" : "secondary"} className="font-mono tabular-nums">
              {running ? "▶" : "⏸"} {liveLabel}
            </Badge>
          )}
          <Button asChild size="sm" variant={state ? "outline" : "default"}>
            <Link to="/timer">
              <Play className="h-3.5 w-3.5 mr-1" />
              {state ? "タイマーを見る" : "タイマー開始"}
            </Link>
          </Button>
        </div>
      </div>

      {/* 今日の進捗 */}
      <div>
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>
            今日 <b className="text-foreground">{fmtMin(view.todayMin)}</b> / 目標{" "}
            {fmtMin(dailyGoal)}
          </span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
        <PowerBar value={pct} height={12} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Mini icon={Clock3} label="今日" value={fmtMin(view.todayMin)} />
        <Mini icon={Flame} label="今週" value={fmtMin(view.week)} />
        <Mini icon={Activity} label="セッション" value={`${view.sessions} 回`} />
        <Mini icon={Timer} label="平均" value={view.sessions ? `${view.avgSession} 分` : "—"} />
      </div>

      {/* 14日の学習時間 */}
      <div>
        <p className="text-xs font-semibold mb-1">直近14日の学習時間</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={view.series} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="fp-min" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10 }}
                interval={1}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
              <Tooltip
                formatter={(v: any) => [`${v} 分`, "学習時間"]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                }}
              />
              <ReferenceLine y={dailyGoal} stroke="var(--warning)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#fp-min)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/60 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

