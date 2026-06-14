import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { unreadCount as nUnreadCount } from "@/lib/notifications.functions";


import {
  BookOpen, Clock, Flame, TrendingUp, Award, Target, Megaphone,
  CalendarDays, BarChart3, ArrowUp, ArrowDown, Minus, Star, Sun, CheckCircle2, Bell,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { localDateStr, addDaysStr } from "@/lib/date";
import { levelInfo } from "@/lib/level";
import { Town } from "@/components/Town";
import { buildReport } from "@/lib/report-pdf";
import { FileDown } from "lucide-react";
import { TodayBreakdownChart } from "@/components/TodayBreakdownChart";
import { WeeklySubjectDiff } from "@/components/WeeklySubjectDiff";
import { Trophy } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

function DashboardRanking() {
  const [rows, setRows] = useState<any[]>([]);
  const [mk, setMk] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: lb } = await (supabase as any).rpc("get_leaderboard", { _limit: 10 });
      setRows(lb ?? []);
      const { data: mlb } = await (supabase as any).rpc("get_makron_leaderboard", { _limit: 10 });
      setMk(mlb ?? []);
    })();
  }, []);
  return (
    <Card className="p-4 grid md:grid-cols-2 gap-4">
      <div>
        <div className="font-bold flex items-center gap-2 mb-2"><Trophy className="h-4 w-4 text-amber-500" />学習時間ランキング Top10</div>
        <div className="divide-y">
          {rows.length === 0 && <div className="text-xs text-muted-foreground p-2">データなし</div>}
          {rows.map((r: any, i: number) => (
            <div key={r.user_id} className="flex items-center gap-2 py-1.5">
              <div className="w-6 text-center text-sm font-bold tabular-nums">{i + 1}</div>
              <Avatar className="h-6 w-6"><AvatarImage src={r.avatar_url ?? undefined} /><AvatarFallback>{(r.display_name ?? "?").slice(0,1)}</AvatarFallback></Avatar>
              <div className="flex-1 text-sm truncate">{r.display_name ?? "?"}</div>
              <div className="text-xs tabular-nums">{r.total_minutes}分</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-bold flex items-center gap-2 mb-2"><Trophy className="h-4 w-4 text-primary" />Makron XP Top10</div>
        <div className="divide-y">
          {mk.length === 0 && <div className="text-xs text-muted-foreground p-2">データなし</div>}
          {mk.map((r: any) => (
            <div key={r.user_id} className="flex items-center gap-2 py-1.5">
              <div className="w-6 text-center text-sm font-bold tabular-nums">{r.rank}</div>
              <Avatar className="h-6 w-6"><AvatarImage src={r.avatar_url ?? undefined} /><AvatarFallback>{(r.display_name ?? "?").slice(0,1)}</AvatarFallback></Avatar>
              <div className="flex-1 text-sm truncate">{r.display_name ?? "?"}</div>
              <div className="text-xs tabular-nums">{r.xp} XP / Lv{r.level}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const RANKS = [
  { min: 0, title: "白帯" }, { min: 60, title: "黄帯" }, { min: 300, title: "緑帯" },
  { min: 900, title: "青帯" }, { min: 2400, title: "紫帯" }, { min: 6000, title: "茶帯" },
  { min: 12000, title: "黒帯" }, { min: 30000, title: "師範" },
];
function RankCard({ totalMin }: { totalMin: number }) {
  const current = [...RANKS].reverse().find((r) => totalMin >= r.min)!;
  const nextIdx = RANKS.findIndex((r) => r.title === current.title) + 1;
  const next = RANKS[nextIdx];
  return (
    <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] text-muted-foreground">現在の段位</div>
        <div className="text-lg font-bold flex items-center gap-1"><Award className="h-4 w-4 text-amber-500" />{current.title}</div>
      </div>
      {next && <div className="text-xs text-muted-foreground text-right">次「{next.title}」まで<br/>あと {next.min - totalMin} 分</div>}
    </div>
  );
}

type Goal = { id: string; title: string; target_minutes: number; progress_minutes: number; done: boolean; deadline: string | null; scope: string };
type Announce = { id: string; title: string; body: string; publish_at: string; tag: string };

const ANN_TAGS: Record<string, { label: string; className: string }> = {
  update: { label: "アップデート", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  bug: { label: "バグ", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  maintenance: { label: "メンテナンス", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  other: { label: "その他", className: "bg-muted text-muted-foreground border-border" },
};
const annTagMeta = (v: string) => ANN_TAGS[v] ?? ANN_TAGS.other;

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalMin: 0, todayMin: 0, streak: 0, longestStreak: 0, sessions: 0,
    weekMin: 0, lastWeekMin: 0, avgPerActiveDay: 0, activeDays: 0,
    monthMin: 0, monthActiveDays: 0, peakHour: -1, peakHourMin: 0,
    gradingAvg: 0, gradingCount: 0, gradingPass: 0,
    goalsDone: 0, goalsTotal: 0,
  });
  const [classroomXp, setClassroomXp] = useState(0);
  const [weekly, setWeekly] = useState<{ day: string; minutes: number }[]>([]);
  const [monthly, setMonthly] = useState<{ date: string; minutes: number }[]>([]);
  const [bySubject, setBySubject] = useState<{ name: string; value: number; color: string }[]>([]);
  const [topSubjects, setTopSubjects] = useState<{ name: string; value: number; color: string }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [announcements, setAnnouncements] = useState<Announce[]>([]);
  const [heatmap, setHeatmap] = useState<{ date: string; minutes: number }[]>([]);

  const [peakByHour, setPeakByHour] = useState<{ hour: string; minutes: number }[]>([]);

  const loadDashboard = async (uid: string) => {
    const [logsRes, goalsAllRes, annRes, gradesRes, subsRes] = await Promise.all([
      supabase.from("study_logs")
        .select("date, duration_minutes, subject_id, start_time, subjects(name, color)")
        .eq("user_id", uid).order("date", { ascending: false }).limit(2000),
      supabase.from("goals").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("announcements").select("id, title, body, publish_at, tag")
        .lte("publish_at", new Date().toISOString())
        .order("publish_at", { ascending: false }).limit(2),
      supabase.from("grading_history").select("score, correct").eq("user_id", uid).limit(2000),
      supabase.from("submissions").select("xp_awarded").eq("user_id", uid),
    ]);
    const xp = (subsRes.data ?? []).reduce((s, r) => s + (r.xp_awarded ?? 0), 0);
    const logs = logsRes.data ?? [];
    const goalsAll = goalsAllRes.data ?? [];

    const today = localDateStr();
    const totalMin = logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
    const todayMin = logs.filter((l) => l.date === today).reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
    const dayMap = new Map<string, number>();
    logs.forEach((l) => dayMap.set(l.date, (dayMap.get(l.date) ?? 0) + (l.duration_minutes ?? 0)));
    const base = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const k = addDaysStr(base, -i);
      if ((dayMap.get(k) ?? 0) > 0) streak++; else break;
    }
    const sortedDays = Array.from(dayMap.keys()).sort();
    let longest = 0, cur = 0, prev: string | null = null;
    for (const d of sortedDays) {
      if (prev && addDaysStr(new Date(prev + "T00:00:00"), 1) === d) cur++;
      else cur = 1;
      longest = Math.max(longest, cur);
      prev = d;
    }
    const week: { day: string; minutes: number }[] = [];
    let weekMin = 0;
    for (let i = 6; i >= 0; i--) {
      const k = addDaysStr(base, -i);
      const m = dayMap.get(k) ?? 0;
      weekMin += m;
      const d = new Date(k + "T00:00:00");
      week.push({ day: ["日","月","火","水","木","金","土"][d.getDay()], minutes: m });
    }
    let lastWeekMin = 0;
    for (let i = 13; i >= 7; i--) lastWeekMin += dayMap.get(addDaysStr(base, -i)) ?? 0;
    const month: { date: string; minutes: number }[] = [];
    const heat: { date: string; minutes: number }[] = [];
    let monthMin = 0;
    let monthActiveDays = 0;
    for (let i = 29; i >= 0; i--) {
      const k = addDaysStr(base, -i);
      const m = dayMap.get(k) ?? 0;
      if (m > 0) monthActiveDays++;
      monthMin += m;
      month.push({ date: k.slice(5), minutes: m });
      heat.push({ date: k, minutes: m });
    }
    const subjMap = new Map<string, { v: number; c: string }>();
    logs.forEach((l: any) => {
      const name = l.subjects?.name ?? "その他";
      const color = l.subjects?.color ?? "#94a3b8";
      const c = subjMap.get(name) ?? { v: 0, c: color };
      c.v += l.duration_minutes ?? 0;
      subjMap.set(name, c);
    });
    const subjArr = Array.from(subjMap.entries())
      .map(([name, { v, c }]) => ({ name, value: v, color: c }))
      .sort((a, b) => b.value - a.value);
    const hourArr = new Array(24).fill(0);
    logs.forEach((l: any) => {
      if (l.start_time) {
        const h = parseInt(String(l.start_time).slice(0, 2), 10);
        if (!isNaN(h)) hourArr[h] += l.duration_minutes ?? 0;
      }
    });
    let peakHour = -1, peakHourMin = 0;
    hourArr.forEach((m, h) => { if (m > peakHourMin) { peakHourMin = m; peakHour = h; } });
    const peakBuckets = hourArr.map((m, h) => ({ hour: `${h}時`, minutes: m }));
    const grades = gradesRes.data ?? [];
    const gradingCount = grades.length;
    const gradingAvg = gradingCount
      ? Math.round(grades.reduce((s, g) => s + (g.score ?? 0), 0) / gradingCount)
      : 0;
    const gradingPass = grades.filter((g) => g.correct).length;
    const activeDays = Array.from(dayMap.values()).filter((v) => v > 0).length;
    const avgPerActiveDay = activeDays ? Math.round(totalMin / activeDays) : 0;
    return {
      classroomXp: xp,
      goals: goalsAll.filter((g: any) => !g.done).slice(0, 5) as Goal[],
      announcements: (annRes.data ?? []) as Announce[],
      stats: {
        totalMin, todayMin, streak, longestStreak: longest, sessions: logs.length,
        weekMin, lastWeekMin, avgPerActiveDay, activeDays,
        monthMin, monthActiveDays, peakHour, peakHourMin,
        gradingAvg, gradingCount, gradingPass,
        goalsDone: goalsAll.filter((g: any) => g.done).length, goalsTotal: goalsAll.length,
      },
      weekly: week, monthly: month, heatmap: heat,
      bySubject: subjArr, topSubjects: subjArr.slice(0, 5), peakByHour: peakBuckets,
    };
  };

  const { data } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => loadDashboard(user!.id),
    enabled: !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    setStats(data.stats);
    setClassroomXp(data.classroomXp);
    setWeekly(data.weekly);
    setMonthly(data.monthly);
    setHeatmap(data.heatmap);
    setBySubject(data.bySubject);
    setTopSubjects(data.topSubjects);
    setPeakByHour(data.peakByHour);
    setGoals(data.goals);
    setAnnouncements(data.announcements);
  }, [data]);


  const fmt = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
  const diff = stats.weekMin - stats.lastWeekMin;
  const diffPct = stats.lastWeekMin > 0 ? Math.round((diff / stats.lastWeekMin) * 100) : null;

  // 最後の学習からの経過日数
  const lastDate = heatmap.slice().reverse().find((h) => h.minutes > 0)?.date;
  const daysSinceLast = lastDate
    ? Math.floor((Date.now() - new Date(lastDate + "T00:00:00").getTime()) / 86400000)
    : 999;

  const lvl = levelInfo(stats.totalMin + classroomXp, daysSinceLast);
  const peakLabel = stats.peakHour >= 0 ? `${stats.peakHour}時台` : "—";
  const goalRate = stats.goalsTotal > 0 ? Math.round((stats.goalsDone / stats.goalsTotal) * 100) : 0;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">ダッシュボード</h1>
          <p className="text-muted-foreground">学習の積み重ねを見える化</p>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="hidden" />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="no-print">
            🖨 印刷
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!user) return;
              const { data } = await supabase
                .from("study_logs")
                .select("date, duration_minutes, subjects(name)")
                .eq("user_id", user.id)
                .order("date", { ascending: false })
                .limit(2000);
              buildReport((data as any) ?? [], "week");
            }}
          >
            <FileDown className="h-4 w-4 mr-1" />週レポート
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!user) return;
              const { data } = await supabase
                .from("study_logs")
                .select("date, duration_minutes, subjects(name)")
                .eq("user_id", user.id)
                .order("date", { ascending: false })
                .limit(2000);
              buildReport((data as any) ?? [], "month");
            }}
          >
            <FileDown className="h-4 w-4 mr-1" />月レポート
          </Button>
          <NotificationBell />
        </div>
      </div>

      {/* あなたの街 */}
      <Town />

      {/* ユーザーレベル */}
      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center font-extrabold text-xl shadow">
            Lv{lvl.level}
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>次のレベルまで <span className="font-medium text-foreground">残り約 {Math.ceil(lvl.remainingHours * 60)} 分</span></span>
              <span>{Math.round(lvl.progressPct)}%</span>
            </div>
            <Progress value={lvl.progressPct} />
            <div className="text-[10px] text-muted-foreground mt-1">
              累計 {Math.round(lvl.currentHours)}h / 次 Lv{lvl.level + 1} で {Math.round(lvl.nextLevelHours)}h
              {lvl.inactivityFactor < 1 && (
                <span className="ml-2 text-amber-600">
                  ⚠ 停滞中: レベル上昇が ×{lvl.inactivityFactor.toFixed(2)} に減速
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* スタッツ 12 個 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="今日の勉強" value={fmt(stats.todayMin)} />
        <StatCard icon={Flame} label="連続日数" value={`${stats.streak} 日`} />
        <StatCard icon={Award} label="最長連続" value={`${stats.longestStreak} 日`} />
        <StatCard icon={BookOpen} label="累計時間" value={fmt(stats.totalMin)} />
        <StatCard icon={CalendarDays} label="今週" value={fmt(stats.weekMin)} sub={
          diffPct === null ? "—" :
          diff > 0 ? <span className="text-emerald-600 inline-flex items-center"><ArrowUp className="h-3 w-3" />{diffPct}%</span> :
          diff < 0 ? <span className="text-amber-600 inline-flex items-center"><ArrowDown className="h-3 w-3" />{Math.abs(diffPct)}%</span> :
          <span className="text-muted-foreground inline-flex items-center"><Minus className="h-3 w-3" />0%</span>
        } />
        <StatCard icon={CalendarDays} label="今月 (30日)" value={fmt(stats.monthMin)} sub={`${stats.monthActiveDays} 活動日`} />
        <StatCard icon={Sun} label="ピーク時間帯" value={peakLabel} sub={stats.peakHourMin > 0 ? fmt(stats.peakHourMin) : "—"} />
        <StatCard icon={Star} label="採点平均" value={stats.gradingCount ? `${stats.gradingAvg}点` : "—"} sub={`${stats.gradingCount}件 / 正解${stats.gradingPass}`} />
        <StatCard icon={BarChart3} label="活動日数" value={`${stats.activeDays} 日`} />
        <StatCard icon={TrendingUp} label="平均/活動日" value={fmt(stats.avgPerActiveDay)} />
        <StatCard icon={BookOpen} label="記録数" value={`${stats.sessions} 件`} />
        <StatCard icon={CheckCircle2} label="目標達成率" value={`${goalRate}%`} sub={`${stats.goalsDone}/${stats.goalsTotal}`} />
      </div>

      {/* 7日 + 30日 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">直近7日間</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly}>
              <XAxis dataKey="day" stroke="oklch(0.5 0.02 160)" />
              <YAxis stroke="oklch(0.5 0.02 160)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="minutes" fill="oklch(0.6 0.18 150)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-4">直近30日推移</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 240)" />
              <XAxis dataKey="date" stroke="oklch(0.5 0.02 160)" interval={4} />
              <YAxis stroke="oklch(0.5 0.02 160)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="minutes" stroke="oklch(0.55 0.2 145)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ヒートマップ + ピーク時間帯 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-3">学習ヒートマップ（直近30日）</h3>
          <div className="flex flex-wrap gap-1">
            {heatmap.map((h) => {
              const intensity = Math.min(1, h.minutes / 120);
              const bg = h.minutes === 0
                ? "oklch(0.95 0.005 240)"
                : `oklch(${0.85 - intensity * 0.3} ${0.05 + intensity * 0.18} 150)`;
              return (
                <div
                  key={h.date}
                  title={`${h.date}: ${h.minutes}分`}
                  className="h-6 w-6 rounded"
                  style={{ background: bg }}
                />
              );
            })}
          </div>
          <RankCard totalMin={stats.totalMin} />
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Sun className="h-4 w-4" />時間帯別の学習量</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={peakByHour}>
              <XAxis dataKey="hour" stroke="oklch(0.5 0.02 160)" interval={2} fontSize={10} />
              <YAxis stroke="oklch(0.5 0.02 160)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="minutes" fill="oklch(0.65 0.15 80)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">開始時刻が記録された学習を時間帯ごとに集計</p>
        </Card>
      </div>

      {/* 教科 + 目標 + お知らせ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {bySubject.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">教科別の比率</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={bySubject} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {bySubject.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4" />教科トップ</h3>
          {topSubjects.length === 0 && <p className="text-sm text-muted-foreground">記録がありません</p>}
          <div className="space-y-3">
            {topSubjects.map((s) => {
              const pct = stats.totalMin ? (s.value / stats.totalMin) * 100 : 0;
              return (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium" style={{ color: s.color }}>{s.name}</span>
                    <span className="text-muted-foreground">{fmt(s.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4" />進行中の目標</h3>
          {goals.length === 0 && (
            <div className="text-sm text-muted-foreground">
              目標はまだ設定されていません。
              <Link to="/goals" className="ml-1 text-primary underline">設定する</Link>
            </div>
          )}
          <div className="space-y-3">
            {goals.slice(0, 4).map((g) => {
              const pct = g.target_minutes > 0 ? Math.min(100, (g.progress_minutes / g.target_minutes) * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium truncate pr-2">{g.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{Math.round(pct)}%</span>
                  </div>
                  <Progress value={pct} />
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {fmt(g.progress_minutes)} / {fmt(g.target_minutes)}
                    {g.deadline ? ` ・ 〆${g.deadline}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 最新お知らせ */}
      {announcements.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4" />最新のお知らせ</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/announcements">すべて見る</Link></Button>
          </div>
          <div className="space-y-2">
            {announcements.map((a) => {
              const t = annTagMeta(a.tag);
              return (
                <div key={a.id} className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex justify-between items-baseline gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${t.className}`}>{t.label}</span>
                      <p className="font-medium text-sm truncate">{a.title}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(a.publish_at).toLocaleString("ja-JP")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">{a.body}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <TodayBreakdownChart />
      <WeeklySubjectDiff />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: any) {
  return (
    <Card className={`p-4 ${accent ? "border-primary/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-orange-500/15 text-orange-600" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-[10px] mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function NotificationBell() {
  const fn = useServerFn(nUnreadCount);
  const { data } = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => fn(),
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const count = data?.count ?? 0;
  return (
    <Link
      to="/notifications"
      className="relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-border/60 bg-card/70 backdrop-blur-md hover:bg-accent transition shrink-0"
      aria-label={`通知 (未読 ${count} 件)`}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold inline-flex items-center justify-center border-2 border-background">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

