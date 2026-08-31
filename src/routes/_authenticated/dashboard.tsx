import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { unreadCount as nUnreadCount } from "@/lib/notifications.functions";
import { RadialGauge, PowerBar } from "@/components/RadialGauge";
import {
  BookOpen, Clock, Flame, TrendingUp, Award, Target, Megaphone,
  CalendarDays, BarChart3, ArrowUp, ArrowDown, Minus, Star, Sun, CheckCircle2, Bell,
  Timer, Zap, Sparkles, Settings2, FileDown, Trophy, Lightbulb, ChevronRight, Brain, Layers,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from "recharts";
import { localDateStr, addDaysStr } from "@/lib/date";
import { levelInfo } from "@/lib/level";
import { Town } from "@/components/Town";
import { buildReport } from "@/lib/report-pdf";
import { TodayBreakdownChart } from "@/components/TodayBreakdownChart";
import { WeeklySubjectDiff } from "@/components/WeeklySubjectDiff";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FocusPanel } from "@/components/dashboard/FocusPanel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "ダッシュボード｜Study#" },
      { name: "description", content: "今日の学習時間・連続記録・目標達成度・教科バランスをひと目で。学習の積み重ねを可視化するダッシュボード。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Dashboard,
});

const DAILY_GOAL_KEY = "dashboard.dailyGoalMinutes";

const RANKS = [
  { min: 0, title: "白帯" }, { min: 60, title: "黄帯" }, { min: 300, title: "緑帯" },
  { min: 900, title: "青帯" }, { min: 2400, title: "紫帯" }, { min: 6000, title: "茶帯" },
  { min: 12000, title: "黒帯" }, { min: 30000, title: "師範" },
];

type Goal = { id: string; title: string; target_minutes: number; progress_minutes: number; done: boolean; deadline: string | null; scope: string };
type Announce = { id: string; title: string; body: string; publish_at: string; tag: string };

const ANN_TAGS: Record<string, { label: string; className: string }> = {
  update: { label: "アップデート", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  bug: { label: "バグ", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  maintenance: { label: "メンテナンス", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  other: { label: "その他", className: "bg-muted text-muted-foreground border-border" },
};
const annTagMeta = (v: string) => ANN_TAGS[v] ?? ANN_TAGS.other;

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "おつかれさま";
  if (h < 11) return "おはよう";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

function Dashboard() {
  const { user } = useAuth();
  const [dailyGoal, setDailyGoal] = useState(120);

  useEffect(() => {
    const v = Number(localStorage.getItem(DAILY_GOAL_KEY));
    if (v > 0) setDailyGoal(v);
  }, []);

  const loadDashboard = async (uid: string) => {
    const [logsRes, goalsAllRes, annRes, gradesRes, subsRes, examsRes] = await Promise.all([
      supabase.from("study_logs")
        .select("id, date, duration_minutes, subject_id, start_time, content, materials(title), subjects(name, color)")

        .eq("user_id", uid).order("date", { ascending: false }).limit(2000),
      supabase.from("goals").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("announcements").select("id, title, body, publish_at, tag")
        .lte("publish_at", new Date().toISOString())
        .order("publish_at", { ascending: false }).limit(2),
      supabase.from("grading_history").select("score, correct").eq("user_id", uid).limit(2000),
      supabase.from("submissions").select("xp_awarded").eq("user_id", uid),
      supabase.from("exams").select("id, name, start_date")
        .eq("user_id", uid).gte("start_date", localDateStr())
        .order("start_date", { ascending: true }).limit(3),
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
      if ((dayMap.get(k) ?? 0) > 0) streak++; else if (i > 0) break; else continue;
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
    let monthMin = 0, monthActiveDays = 0;
    for (let i = 29; i >= 0; i--) {
      const k = addDaysStr(base, -i);
      const m = dayMap.get(k) ?? 0;
      if (m > 0) monthActiveDays++;
      monthMin += m;
      month.push({ date: k.slice(5), minutes: m });
    }
    // 12週間のヒートマップ（GitHub風）
    const heat: { date: string; minutes: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const k = addDaysStr(base, -i);
      heat.push({ date: k, minutes: dayMap.get(k) ?? 0 });
    }
    // 曜日別平均
    const dowTotals = new Array(7).fill(0);
    const dowCounts = new Array(7).fill(0);
    heat.forEach((h) => {
      const d = new Date(h.date + "T00:00:00").getDay();
      dowTotals[d] += h.minutes;
      dowCounts[d]++;
    });
    const byDow = dowTotals.map((t, i) => ({
      day: ["日","月","火","水","木","金","土"][i],
      minutes: dowCounts[i] ? Math.round(t / dowCounts[i]) : 0,
    }));

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

    const matMap = new Map<string, number>();
    logs.forEach((l: any) => {
      const t = l.materials?.title;
      if (t) matMap.set(t, (matMap.get(t) ?? 0) + (l.duration_minutes ?? 0));
    });
    const byMaterial = Array.from(matMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);

    const hourArr = new Array(24).fill(0);
    logs.forEach((l: any) => {
      if (l.start_time) {
        const h = parseInt(String(l.start_time).slice(0, 2), 10);
        if (!isNaN(h)) hourArr[h] += l.duration_minutes ?? 0;
      }
    });
    let peakHour = -1, peakHourMin = 0;
    hourArr.forEach((m, h) => { if (m > peakHourMin) { peakHourMin = m; peakHour = h; } });
    const peakBuckets = hourArr.map((m, h) => ({ hour: `${h}`, minutes: m }));

    const grades = gradesRes.data ?? [];
    const gradingCount = grades.length;
    const gradingAvg = gradingCount ? Math.round(grades.reduce((s, g) => s + (g.score ?? 0), 0) / gradingCount) : 0;
    const gradingPass = grades.filter((g) => g.correct).length;
    const activeDays = Array.from(dayMap.values()).filter((v) => v > 0).length;
    const avgPerActiveDay = activeDays ? Math.round(totalMin / activeDays) : 0;

    return {
      classroomXp: xp,
      goals: goalsAll.filter((g: any) => !g.done).slice(0, 5) as Goal[],
      announcements: (annRes.data ?? []) as Announce[],
      recent: logs.slice(0, 6) as any[],
      stats: {
        totalMin, todayMin, streak, longestStreak: longest, sessions: logs.length,
        weekMin, lastWeekMin, avgPerActiveDay, activeDays,
        monthMin, monthActiveDays, peakHour, peakHourMin,
        gradingAvg, gradingCount, gradingPass,
        goalsDone: goalsAll.filter((g: any) => g.done).length, goalsTotal: goalsAll.length,
      },
      weekly: week, monthly: month, heatmap: heat, byDow,
      bySubject: subjArr, topSubjects: subjArr.slice(0, 5), peakByHour: peakBuckets,
      byMaterial, exams: (examsRes.data ?? []) as { id: string; name: string; start_date: string | null }[],
    };
  };

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => loadDashboard(user!.id),
    enabled: !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const stats = data?.stats ?? {
    totalMin: 0, todayMin: 0, streak: 0, longestStreak: 0, sessions: 0,
    weekMin: 0, lastWeekMin: 0, avgPerActiveDay: 0, activeDays: 0,
    monthMin: 0, monthActiveDays: 0, peakHour: -1, peakHourMin: 0,
    gradingAvg: 0, gradingCount: 0, gradingPass: 0, goalsDone: 0, goalsTotal: 0,
  };
  const weekly = data?.weekly ?? [];
  const monthly = data?.monthly ?? [];
  const heatmap = data?.heatmap ?? [];
  const byDow = data?.byDow ?? [];
  const bySubject = data?.bySubject ?? [];
  const topSubjects = data?.topSubjects ?? [];
  const peakByHour = data?.peakByHour ?? [];
  const goals = data?.goals ?? [];
  const announcements = data?.announcements ?? [];
  const recent = data?.recent ?? [];
  const classroomXp = data?.classroomXp ?? 0;
  const byMaterial = data?.byMaterial ?? [];
  const exams = data?.exams ?? [];
  const maxMaterialMin = Math.max(1, ...byMaterial.map((m) => m.value));

  const diff = stats.weekMin - stats.lastWeekMin;
  const diffPct = stats.lastWeekMin > 0 ? Math.round((diff / stats.lastWeekMin) * 100) : null;

  const lastDate = heatmap.slice().reverse().find((h) => h.minutes > 0)?.date;
  const daysSinceLast = lastDate
    ? Math.floor((Date.now() - new Date(lastDate + "T00:00:00").getTime()) / 86400000)
    : 999;
  const lvl = levelInfo(stats.totalMin + classroomXp, daysSinceLast);
  const peakLabel = stats.peakHour >= 0 ? `${stats.peakHour}時台` : "—";
  const goalRate = stats.goalsTotal > 0 ? Math.round((stats.goalsDone / stats.goalsTotal) * 100) : 0;

  const dailyPct = dailyGoal > 0 ? Math.min(100, (stats.todayMin / dailyGoal) * 100) : 0;
  const weeklyTarget = dailyGoal * 7;
  const weekPct = weeklyTarget > 0 ? Math.min(100, (stats.weekMin / weeklyTarget) * 100) : 0;
  const rank = [...RANKS].reverse().find((r) => stats.totalMin >= r.min)!;
  const nextRank = RANKS[RANKS.findIndex((r) => r.title === rank.title) + 1];

  // 自動インサイト
  const insights = useMemo(() => {
    const out: { icon: any; tone: string; text: string }[] = [];
    if (stats.todayMin === 0) {
      out.push({ icon: Zap, tone: "amber", text: `今日はまだ記録がありません。まずは ${Math.min(25, dailyGoal)} 分だけ始めてみましょう。` });
    } else if (dailyPct >= 100) {
      out.push({ icon: CheckCircle2, tone: "emerald", text: `今日の目標 ${fmt(dailyGoal)} を達成！連続 ${stats.streak} 日目です。` });
    } else {
      out.push({ icon: Target, tone: "primary", text: `今日の目標まであと ${fmt(Math.max(0, dailyGoal - stats.todayMin))}。あと少し！` });
    }
    if (diffPct !== null) {
      out.push(diff >= 0
        ? { icon: TrendingUp, tone: "emerald", text: `今週は先週より ${diffPct}% 多く学習しています。いいペースです。` }
        : { icon: ArrowDown, tone: "amber", text: `今週は先週より ${Math.abs(diffPct)}% 少なめ。取り戻すには 1 日 ${fmt(Math.ceil(Math.abs(diff) / 7))} 追加でOK。` });
    }
    const bestDow = [...byDow].sort((a, b) => b.minutes - a.minutes)[0];
    if (bestDow && bestDow.minutes > 0) {
      out.push({ icon: CalendarDays, tone: "primary", text: `一番集中できているのは ${bestDow.day}曜日（平均 ${fmt(bestDow.minutes)}）。` });
    }
    if (stats.peakHour >= 0) {
      out.push({ icon: Sun, tone: "primary", text: `${stats.peakHour}時台がゴールデンタイム。重い科目はこの時間に。` });
    }
    if (topSubjects.length >= 2) {
      const low = topSubjects[topSubjects.length - 1];
      out.push({ icon: Layers, tone: "amber", text: `「${low.name}」の比率が低めです。バランスを整えると伸びやすくなります。` });
    }
    return out.slice(0, 4);
  }, [stats, dailyGoal, dailyPct, diff, diffPct, byDow, topSubjects]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ===== 一番上: 左=1日の目標 / 右=あなたの街 ===== */}
      <div className="grid gap-5 xl:grid-cols-2 items-start">
      {/* ===== ヒーロー ===== */}
      <Card className="relative overflow-hidden liquid-card p-0">
        <div
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{ background: "radial-gradient(1000px 320px at 12% -10%, oklch(0.7 0.2 150), transparent 60%), radial-gradient(800px 320px at 92% 0%, oklch(0.62 0.22 275), transparent 60%)" }}
        />
        <div className="relative p-5 md:p-7 grid gap-6 md:grid-cols-[auto_1fr] items-center">

          {/* 今日のリング */}
          <div className="flex items-center gap-5 justify-center lg:justify-start">
            <RadialGauge
              value={dailyPct}
              size={172}
              thickness={15}
              ticks={12}
              label={<span className="text-3xl">{fmt(stats.todayMin)}</span>}
              sub={<>今日 / 目標 {fmt(dailyGoal)}<br /><span className="font-semibold text-foreground">{Math.round(dailyPct)}%</span></>}
            />
          </div>

          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "long" })}
              </p>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {greeting()}{isLoading ? "" : "、今日も積み上げよう"}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Chip icon={Flame} tone="amber" label={`${stats.streak} 日連続`} />
              <Chip icon={Award} tone="violet" label={`Lv ${lvl.level}`} />
              <Chip icon={Trophy} tone="emerald" label={rank.title} />
              <Chip icon={BookOpen} tone="slate" label={`累計 ${fmt(stats.totalMin)}`} />
            </div>

            {/* レベルゲージ */}
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>次のレベルまで <b className="text-foreground">{Math.ceil(lvl.remainingHours * 60)} 分</b></span>
                <span className="tabular-nums">{Math.round(lvl.progressPct)}%</span>
              </div>
              <PowerBar value={lvl.progressPct} height={14} from="oklch(0.78 0.17 85)" to="oklch(0.62 0.22 275)" />
              {lvl.inactivityFactor < 1 && (
                <p className="text-[10px] text-amber-600 mt-1">⚠ 停滞中: レベル上昇が ×{lvl.inactivityFactor.toFixed(2)} に減速しています</p>
              )}
            </div>

            {/* 週ペース */}
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>今週のペース <b className="text-foreground">{fmt(stats.weekMin)}</b> / {fmt(weeklyTarget)}</span>
                <span className="tabular-nums">{Math.round(weekPct)}%</span>
              </div>
              <PowerBar value={weekPct} height={10} striped={false} from="oklch(0.75 0.16 200)" to="oklch(0.66 0.2 150)" />
            </div>
          </div>

          <div className="flex lg:flex-col gap-2 flex-wrap justify-center">
            <DailyGoalDialog value={dailyGoal} onChange={(v) => { setDailyGoal(v); localStorage.setItem(DAILY_GOAL_KEY, String(v)); }} />
            <NotificationBell />
          </div>
        </div>

        {/* クイックアクション */}
        <div className="relative border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/60">
          <QuickAction to="/timer" icon={Timer} label="タイマー開始" />
          <QuickAction to="/study" icon={BookOpen} label="学習を記録" />
          <QuickAction to="/makron" icon={Brain} label="Makron 演習" />
          <QuickAction to="/flashcards" icon={Layers} label="暗記カード" />
        </div>
      </Card>

      {/* ===== あなたの街（右上） ===== */}
      <div className="xl:sticky xl:top-4">
        <Town />
      </div>
      </div>

      {/* ===== タイマー & 学習時間の集約 ===== */}
      <FocusPanel dailyGoal={dailyGoal} />

      {/* ===== インサイト ===== */}
      {insights.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {insights.map((i, idx) => (
            <Card key={idx} className="p-3.5 flex gap-3 items-start liquid-hover transition">
              <div className={`h-8 w-8 rounded-xl grid place-items-center shrink-0 ${
                i.tone === "emerald" ? "bg-emerald-500/15 text-emerald-600"
                : i.tone === "amber" ? "bg-amber-500/15 text-amber-600"
                : "bg-primary/12 text-primary"}`}>
                <i.icon className="h-4 w-4" />
              </div>
              <p className="text-[12px] leading-relaxed">{i.text}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ===== KPI ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="今日の勉強" value={fmt(stats.todayMin)} />
        <StatCard icon={Flame} label="連続日数" value={`${stats.streak} 日`} sub={`最長 ${stats.longestStreak} 日`} accent={stats.streak > 0} />
        <StatCard icon={CalendarDays} label="今週" value={fmt(stats.weekMin)} sub={
          diffPct === null ? "—" :
          diff > 0 ? <span className="text-emerald-600 inline-flex items-center"><ArrowUp className="h-3 w-3" />{diffPct}%</span> :
          diff < 0 ? <span className="text-amber-600 inline-flex items-center"><ArrowDown className="h-3 w-3" />{Math.abs(diffPct)}%</span> :
          <span className="text-muted-foreground inline-flex items-center"><Minus className="h-3 w-3" />0%</span>
        } />
        <StatCard icon={CalendarDays} label="今月 (30日)" value={fmt(stats.monthMin)} sub={`${stats.monthActiveDays} 活動日`} />
        <StatCard icon={Sun} label="ピーク時間帯" value={peakLabel} sub={stats.peakHourMin > 0 ? fmt(stats.peakHourMin) : "—"} />
        <StatCard icon={Star} label="採点平均" value={stats.gradingCount ? `${stats.gradingAvg}点` : "—"} sub={`${stats.gradingCount}件 / 正解${stats.gradingPass}`} />
        <StatCard icon={TrendingUp} label="平均/活動日" value={fmt(stats.avgPerActiveDay)} sub={`${stats.activeDays} 活動日`} />
        <StatCard icon={CheckCircle2} label="目標達成率" value={`${goalRate}%`} sub={`${stats.goalsDone}/${stats.goalsTotal}`} />
      </div>

      {/* ===== グラフ（タブ） ===== */}
      <Card className="p-4 md:p-6">
        <Tabs defaultValue="week">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h3 className="font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />学習の推移</h3>
            <TabsList>
              <TabsTrigger value="week">7日</TabsTrigger>
              <TabsTrigger value="month">30日</TabsTrigger>
              <TabsTrigger value="dow">曜日別</TabsTrigger>
              <TabsTrigger value="hour">時間帯</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="week">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}分`, "学習"]} />
                <Bar dataKey="minutes" fill="oklch(0.65 0.19 150)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="month">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.21 265)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.62 0.21 265)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" interval={4} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}分`, "学習"]} />
                <Area type="monotone" dataKey="minutes" stroke="oklch(0.55 0.2 265)" strokeWidth={2.5} fill="url(#dashArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="dow">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}分`, "平均"]} />
                <Bar dataKey="minutes" fill="oklch(0.68 0.17 200)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">直近12週間の曜日ごとの平均学習時間</p>
          </TabsContent>
          <TabsContent value="hour">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={peakByHour}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" interval={1} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}分`, "学習"]} labelFormatter={(l) => `${l}時台`} />
                <Bar dataKey="minutes" fill="oklch(0.72 0.16 80)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </Card>

      {/* ===== ヒートマップ + 教科 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-bold flex items-center gap-2"><Flame className="h-4 w-4 text-amber-500" />学習ヒートマップ（12週間）</h3>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              少ない
              {[0, 0.25, 0.5, 0.75, 1].map((i) => (
                <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: heatColor(i * 120) }} />
              ))}
              多い
            </div>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="grid grid-flow-col grid-rows-7 gap-[3px] w-max">
              {heatmap.map((h) => (
                <div
                  key={h.date}
                  title={`${h.date}: ${h.minutes}分`}
                  className="h-[13px] w-[13px] rounded-[3px] transition hover:ring-2 hover:ring-primary/50"
                  style={{ background: heatColor(h.minutes) }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] text-muted-foreground">現在の段位</div>
              <div className="text-lg font-bold flex items-center gap-1"><Award className="h-4 w-4 text-amber-500" />{rank.title}</div>
            </div>
            {nextRank && (
              <div className="flex-1 max-w-xs">
                <div className="text-[10px] text-muted-foreground text-right mb-1">
                  次「{nextRank.title}」まであと {nextRank.min - stats.totalMin} 分
                </div>
                <PowerBar
                  value={((stats.totalMin - rank.min) / Math.max(1, nextRank.min - rank.min)) * 100}
                  height={10} striped={false}
                  from="oklch(0.8 0.16 85)" to="oklch(0.6 0.19 30)"
                />
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />教科バランス</h3>
          {bySubject.length === 0 ? (
            <p className="text-sm text-muted-foreground">記録がありません</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={bySubject} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={2}>
                    {bySubject.map((s, i) => <Cell key={i} fill={s.color} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${v}分`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 mt-3">
                {topSubjects.map((s) => {
                  const pct = stats.totalMin ? (s.value / stats.totalMin) * 100 : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-semibold" style={{ color: s.color }}>{s.name}</span>
                        <span className="text-muted-foreground tabular-nums">{fmt(s.value)}・{Math.round(pct)}%</span>
                      </div>
                      <PowerBar value={pct} height={8} striped={false} from={s.color} to={s.color} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ===== 試験カウントダウン + 教材別 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-rose-500" />試験カウントダウン</h3>
            <Button asChild size="sm" variant="ghost"><Link to="/exams">管理 <ChevronRight className="h-3 w-3" /></Link></Button>
          </div>
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">予定されている試験はありません。<Link to="/exams" className="ml-1 text-primary underline">登録する</Link></p>
          ) : (
            <div className="space-y-3">
              {exams.map((e) => {
                const days = e.start_date
                  ? Math.max(0, Math.ceil((new Date(e.start_date + "T00:00:00").getTime() - Date.now()) / 86400000))
                  : null;
                const urgency = days === null ? "slate" : days <= 3 ? "rose" : days <= 14 ? "amber" : "primary";
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20">
                    <div className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 font-extrabold tabular-nums ${
                      urgency === "rose" ? "bg-rose-500/15 text-rose-600"
                      : urgency === "amber" ? "bg-amber-500/15 text-amber-600"
                      : "bg-primary/12 text-primary"}`}>
                      {days ?? "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{e.name}</div>
                      <div className="text-[11px] text-muted-foreground">{e.start_date ?? "日付未設定"}{days !== null ? ` ・ あと ${days} 日` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />よく使う教材 TOP5</h3>
            <Button asChild size="sm" variant="ghost"><Link to="/materials">教材DB <ChevronRight className="h-3 w-3" /></Link></Button>
          </div>
          {byMaterial.length === 0 ? (
            <p className="text-sm text-muted-foreground">教材を紐づけた記録がまだありません。</p>
          ) : (
            <div className="space-y-3">
              {byMaterial.map((m, i) => (
                <div key={m.name}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="font-semibold truncate pr-2">{i + 1}. {m.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{fmt(m.value)}</span>
                  </div>
                  <PowerBar value={(m.value / maxMaterialMin) * 100} height={9} striped={false}
                    from="oklch(0.75 0.16 200)" to="oklch(0.62 0.22 275)" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ===== 目標 + 最近の記録 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Target className="h-4 w-4 text-primary" />進行中の目標</h3>
            <Button asChild size="sm" variant="ghost"><Link to="/goals">管理 <ChevronRight className="h-3 w-3" /></Link></Button>
          </div>
          {goals.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              目標はまだ設定されていません。<Link to="/goals" className="ml-1 text-primary underline">設定する</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.slice(0, 4).map((g) => {
                const pct = g.target_minutes > 0 ? Math.min(100, (g.progress_minutes / g.target_minutes) * 100) : 0;
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-semibold truncate pr-2">{g.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{Math.round(pct)}%</span>
                    </div>
                    <PowerBar value={pct} height={12} />
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {fmt(g.progress_minutes)} / {fmt(g.target_minutes)}{g.deadline ? ` ・ 〆${g.deadline}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />最近の学習記録</h3>
            <Button asChild size="sm" variant="ghost"><Link to="/study">すべて <ChevronRight className="h-3 w-3" /></Link></Button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ記録がありません。</p>
          ) : (
            <div className="divide-y">
              {recent.map((r: any) => (
                <div key={r.id} className="py-2 flex items-center gap-3">
                  <span className="h-8 w-1.5 rounded-full shrink-0" style={{ background: r.subjects?.color ?? "#94a3b8" }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.subjects?.name ?? "その他"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r.date}
                      {r.materials?.title ? ` ・ 📗${r.materials.title}` : ""}
                      {r.content ? ` ・ ${r.content}` : ""}
                    </div>

                  </div>
                  <div className="text-sm font-bold tabular-nums shrink-0">{fmt(r.duration_minutes ?? 0)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ===== お知らせ ===== */}
      {announcements.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4" />最新のお知らせ</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/announcements">すべて見る</Link></Button>
          </div>
          <div className="space-y-2">
            {announcements.map((a) => {
              const t = annTagMeta(a.tag);
              return (
                <div key={a.id} className="p-3 rounded-xl border bg-muted/20">
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
      <DashboardRanking />

      <div className="flex items-center gap-2 flex-wrap justify-end no-print">
        <Button size="sm" variant="outline" onClick={() => window.print()}>🖨 印刷</Button>
        <Button size="sm" variant="outline" onClick={() => exportReport(user?.id, "week")}>
          <FileDown className="h-4 w-4 mr-1" />週レポート
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportReport(user?.id, "month")}>
          <FileDown className="h-4 w-4 mr-1" />月レポート
        </Button>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

function heatColor(minutes: number) {
  if (minutes <= 0) return "oklch(0.93 0.006 250)";
  const i = Math.min(1, minutes / 120);
  return `oklch(${0.88 - i * 0.32} ${0.05 + i * 0.17} 150)`;
}

async function exportReport(uid: string | undefined, range: "week" | "month") {
  if (!uid) return;
  const { data } = await supabase
    .from("study_logs")
    .select("date, duration_minutes, subjects(name)")
    .eq("user_id", uid)
    .order("date", { ascending: false })
    .limit(2000);
  buildReport((data as any) ?? [], range);
}

function Chip({ icon: Icon, label, tone }: { icon: any; label: string; tone: string }) {
  const tones: Record<string, string> = {
    amber: "bg-amber-500/15 text-amber-700 border-amber-500/25",
    violet: "bg-violet-500/15 text-violet-700 border-violet-500/25",
    emerald: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
    slate: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${tones[tone]}`}>
      <Icon className="h-3.5 w-3.5" />{label}
    </span>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="group flex items-center justify-center gap-2 px-3 py-3.5 text-sm font-semibold hover:bg-accent/60 transition">
      <Icon className="h-4 w-4 text-primary group-hover:scale-110 transition" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function DailyGoalDialog({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 h-11 rounded-full">
          <Settings2 className="h-4 w-4" />1日の目標
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="h-4 w-4" />1日の目標学習時間</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input type="number" min={5} step={5} value={draft} onChange={(e) => setDraft(Math.max(5, +e.target.value))} />
            <span className="text-sm text-muted-foreground shrink-0">分</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[30, 60, 90, 120, 180, 240].map((m) => (
              <Button key={m} size="sm" variant={draft === m ? "default" : "outline"} onClick={() => setDraft(m)}>
                {fmt(m)}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1">
            <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
            達成しやすい時間から始めると連続記録が伸びやすくなります。
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => { onChange(draft); setOpen(false); }}>
            <Sparkles className="h-4 w-4 mr-1" />保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: any) {
  return (
    <Card className={`p-4 liquid-hover transition ${accent ? "border-amber-500/40" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-xl font-extrabold leading-tight tabular-nums">{value}</p>
          {sub && <p className="text-[10px] mt-0.5 text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

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
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1));
  return (
    <Card className="p-5 grid md:grid-cols-2 gap-6">
      <div>
        <div className="font-bold flex items-center gap-2 mb-2"><Trophy className="h-4 w-4 text-amber-500" />学習時間ランキング Top10</div>
        <div className="divide-y">
          {rows.length === 0 && <div className="text-xs text-muted-foreground p-2">データなし</div>}
          {rows.map((r: any, i: number) => (
            <div key={r.user_id} className="flex items-center gap-2 py-1.5">
              <div className="w-6 text-center text-sm font-bold tabular-nums">{medal(i)}</div>
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
          {mk.map((r: any, i: number) => (
            <div key={r.user_id} className="flex items-center gap-2 py-1.5">
              <div className="w-6 text-center text-sm font-bold tabular-nums">{medal(i)}</div>
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
