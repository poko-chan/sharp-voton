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
import { computeMetrics, fmtNum, type BuildingRow } from "@/lib/town-economy";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Timer, Play, Users, Coins, Leaf, Clock3, Flame, Activity } from "lucide-react";

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
      const [logs, builds, pols, town] = await Promise.all([
        supabase.from("study_logs").select("date, duration_minutes, subject_id, start_time")
          .eq("user_id", user!.id).gte("date", since).order("date", { ascending: true }),
        supabase.from("town_buildings").select("id, kind, gx, gz, level").eq("user_id", user!.id),
        supabase.from("town_policies").select("key, enabled").eq("user_id", user!.id),
        supabase.from("towns").select("stage").eq("user_id", user!.id).maybeSingle(),
      ]);
      return {
        logs: logs.data ?? [],
        buildings: (builds.data ?? []) as BuildingRow[],
        policies: (pols.data ?? []).filter((p: any) => p.enabled !== false).map((p: any) => p.key as string),
        stage: town.data?.stage ?? 1,
      };
    },
  });

  const view = useMemo(() => {
    const logs = data?.logs ?? [];
    const dayMap = new Map<string, number>();
    const daySubj = new Map<string, Set<string>>();
    for (const l of logs as any[]) {
      dayMap.set(l.date, (dayMap.get(l.date) ?? 0) + (l.duration_minutes ?? 0));
      if (l.subject_id) {
        const s = daySubj.get(l.date) ?? new Set<string>();
        s.add(l.subject_id);
        daySubj.set(l.date, s);
      }
    }
    const today = localDateStr();
    const base = new Date();
    const todayMin = dayMap.get(today) ?? 0;

    const series: { day: string; minutes: number; population: number; gdp: number; co2: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const key = addDaysStr(base, -i);
      // その日までの直近30日を使って街の指標を再現する
      let minutes30 = 0, activeDays30 = 0, streak = 0;
      const subj = new Set<string>();
      for (let j = 0; j < 30; j++) {
        const k = addDaysStr(new Date(key + "T00:00:00"), -j);
        const m = dayMap.get(k) ?? 0;
        minutes30 += m;
        if (m > 0) activeDays30++;
        daySubj.get(k)?.forEach((s) => subj.add(s));
      }
      for (let j = 0; j < 120; j++) {
        const k = addDaysStr(new Date(key + "T00:00:00"), -j);
        if ((dayMap.get(k) ?? 0) > 0) streak++;
        else break;
      }
      const m = computeMetrics(
        data?.stage ?? 1,
        { minutes30, activeDays30, avgScore: 70, subjects: subj.size, goalsDone: 0, streak },
        data?.buildings ?? [],
        data?.policies ?? [],
      );
      series.push({
        day: key.slice(5).replace("-", "/"),
        minutes: dayMap.get(key) ?? 0,
        population: m.population,
        gdp: m.gdp,
        co2: m.co2,
      });
    }

    const last = series[series.length - 1];
    const prev = series[series.length - 8] ?? series[0];
    const week = series.slice(-7).reduce((s, d) => s + d.minutes, 0);
    const sessions = (logs as any[]).filter((l) => l.date === today).length;
    const avgSession = sessions ? Math.round(todayMin / sessions) : 0;

    return {
      todayMin, week, sessions, avgSession, series,
      metrics: last,
      delta: last && prev
        ? { population: last.population - prev.population, gdp: last.gdp - prev.gdp, co2: last.co2 - prev.co2 }
        : { population: 0, gdp: 0, co2: 0 },
    };
  }, [data]);

  const pct = Math.min(100, (view.todayMin / Math.max(1, dailyGoal)) * 100);
  const running = state?.running;
  const liveLabel = state ? (state.kind === "stopwatch" ? fmtMs(elapsedMs) : fmtMs(remainingMs)) : null;

  return (
    <Card className="p-4 md:p-5 space-y-5 liquid-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/12 text-primary grid place-items-center">
            <Timer className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-bold leading-tight">タイマー & 学習時間</h2>
            <p className="text-[11px] text-muted-foreground">記録した時間が街の指標に反映されます</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state && (
            <Badge variant={running ? "default" : "secondary"} className="font-mono tabular-nums">
              {running ? "▶" : "⏸"} {liveLabel}
            </Badge>
          )}
          <Button asChild size="sm" variant={state ? "outline" : "default"}>
            <Link to="/timer"><Play className="h-3.5 w-3.5 mr-1" />{state ? "タイマーを見る" : "タイマー開始"}</Link>
          </Button>
        </div>
      </div>

      {/* 今日の進捗 */}
      <div>
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>今日 <b className="text-foreground">{fmtMin(view.todayMin)}</b> / 目標 {fmtMin(dailyGoal)}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
        <PowerBar value={pct} height={12} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
              <Tooltip
                formatter={(v: any) => [`${v} 分`, "学習時間"]}
                contentStyle={{ fontSize: 12, borderRadius: 10, background: "var(--popover)", border: "1px solid var(--border)" }}
              />
              <ReferenceLine y={dailyGoal} stroke="var(--warning)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="minutes" stroke="var(--primary)" strokeWidth={2} fill="url(#fp-min)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 街の指標推移 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold">街の指標の推移</p>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />人口</span>
            <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />GDP</span>
            <span className="inline-flex items-center gap-1"><Leaf className="h-3 w-3" />CO2</span>
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={view.series} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, background: "var(--popover)", border: "1px solid var(--border)" }} />
              <Line type="monotone" dataKey="population" name="人口" dot={false} strokeWidth={2} stroke="oklch(0.65 0.2 265)" />
              <Line type="monotone" dataKey="gdp" name="GDP" dot={false} strokeWidth={2} stroke="oklch(0.72 0.16 160)" />
              <Line type="monotone" dataKey="co2" name="CO2" dot={false} strokeWidth={2} stroke="oklch(0.72 0.16 40)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {view.metrics && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Metric icon={Users} label="人口" value={fmtNum(view.metrics.population)} delta={view.delta.population} />
            <Metric icon={Coins} label="GDP" value={`${fmtNum(view.metrics.gdp)}百万`} delta={view.delta.gdp} />
            <Metric icon={Leaf} label="CO2" value={`${fmtNum(view.metrics.co2)}t`} delta={view.delta.co2} good="down" />
          </div>
        )}
      </div>
    </Card>
  );
}

function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/60 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="text-sm font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function Metric({
  icon: Icon, label, value, delta, good = "up",
}: { icon: any; label: string; value: string; delta: number; good?: "up" | "down" }) {
  const positive = good === "up" ? delta > 0 : delta < 0;
  const tone = delta === 0 ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-amber-600";
  return (
    <div className="rounded-xl border bg-card/60 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className={`text-[10px] tabular-nums ${tone}`}>
        {delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${fmtNum(delta)}`} / 7日
      </div>
    </div>
  );
}
