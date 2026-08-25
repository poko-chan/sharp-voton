import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { localDateStr } from "@/lib/date";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type ViewMode = "month" | "week" | "agenda";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 種別ごとの色設定（凡例・チップ共通）
const TYPE_STYLES = {
  plan: {
    label: "勉強予定",
    chip: "bg-warning/15 text-warning-foreground border-warning/40",
    dot: "bg-warning",
  },
  event: {
    label: "イベント",
    chip: "bg-primary/15 text-primary border-primary/40",
    dot: "bg-primary",
  },
  log: {
    label: "実績",
    chip: "bg-success/15 text-success-foreground border-success/40",
    dot: "bg-success",
  },
} as const;

function startOfCalendarGrid(monthAnchor: Date): Date {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay()); // back to Sunday
  return start;
}

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();

  const [view, setView] = useState<ViewMode>("month");
  const [monthAnchor, setMonthAnchor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [weekAnchor, setWeekAnchor] = useState<Date>(startOfWeek(today));
  const [date, setDate] = useState<Date | undefined>(today);
  const [panelOpen, setPanelOpen] = useState(false);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Plan form
  const [planSubject, setPlanSubject] = useState("");
  const [planMin, setPlanMin] = useState(60);
  const [planTime, setPlanTime] = useState("");
  const [planContent, setPlanContent] = useState("");

  // Event form
  const [evTitle, setEvTitle] = useState("");
  const [evTime, setEvTime] = useState("");
  const [evDesc, setEvDesc] = useState("");

  const dateStr = date ? localDateStr(date) : "";
  const todayStr = localDateStr(today);

  const load = async () => {
    if (!user) return;
    const [s, p, l, e] = await Promise.all([
      supabase.from("subjects").select("*").eq("user_id", user.id),
      supabase.from("study_plans").select("*, subjects(name,color)").eq("user_id", user.id),
      supabase.from("study_logs").select("*, subjects(name,color)").eq("user_id", user.id),
      supabase.from("events" as any).select("*").eq("user_id", user.id),
    ]);
    setSubjects(s.data ?? []);
    setPlans(p.data ?? []);
    setLogs(l.data ?? []);
    setEvents((e.data as any) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const dayPlans = plans.filter((p) => p.date === dateStr);
  const dayLogs = logs.filter((l) => l.date === dateStr);
  const dayEvents = events.filter((ev) => ev.date === dateStr);

  const addPlan = async () => {
    if (!user || !date) return;
    const { error } = await supabase.from("study_plans").insert({
      user_id: user.id, date: dateStr, subject_id: planSubject || null,
      planned_minutes: planMin, content: planContent,
      start_time: planTime || null,
    } as any);
    if (error) return toast.error(error.message);
    setPlanContent(""); setPlanTime(""); load(); toast.success("予定を追加しました");
  };

  const addEvent = async () => {
    if (!user || !date || !evTitle.trim()) return;
    const { error } = await supabase.from("events" as any).insert({
      user_id: user.id, date: dateStr, title: evTitle.trim(),
      start_time: evTime || null, description: evDesc || null,
    });
    if (error) return toast.error(error.message);
    setEvTitle(""); setEvTime(""); setEvDesc(""); load(); toast.success("イベントを追加しました");
  };

  const togglePlan = async (id: string, done: boolean) => {
    await supabase.from("study_plans").update({ done }).eq("id", id); load();
  };
  const delPlan = async (id: string) => { await supabase.from("study_plans").delete().eq("id", id); load(); };
  const delEvent = async (id: string) => { await supabase.from("events" as any).delete().eq("id", id); load(); };

  const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : "");

  // 日付ごとのチップ一覧（月・週グリッド共通）
  const itemsByDate = useMemo(() => {
    const map = new Map<string, { type: keyof typeof TYPE_STYLES; label: string; time: string; id: string }[]>();
    const push = (d: string, item: { type: keyof typeof TYPE_STYLES; label: string; time: string; id: string }) => {
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(item);
    };
    for (const p of plans) {
      push(p.date, { type: "plan", label: p.subjects?.name ? `${p.subjects.name}` : (p.content || "勉強予定"), time: fmtTime(p.start_time), id: p.id });
    }
    for (const ev of events) {
      push(ev.date, { type: "event", label: ev.title, time: fmtTime(ev.start_time), id: ev.id });
    }
    for (const l of logs) {
      push(l.date, { type: "log", label: l.subjects?.name ?? "実績", time: fmtTime(l.start_time), id: l.id });
    }
    for (const [d, arr] of map) {
      arr.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    }
    return map;
  }, [plans, events, logs]);

  const monthGridDays = useMemo(() => {
    const start = startOfCalendarGrid(monthAnchor);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [monthAnchor]);

  const weekGridDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAnchor);
      d.setDate(weekAnchor.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekAnchor]);

  const agendaItems = useMemo(() => {
    type A = { date: string; type: keyof typeof TYPE_STYLES; label: string; time: string; id: string };
    const arr: A[] = [];
    for (const p of plans) if (p.date >= todayStr) arr.push({ date: p.date, type: "plan", label: p.subjects?.name ? `${p.subjects.name}${p.content ? " — " + p.content : ""}` : (p.content || "勉強予定"), time: fmtTime(p.start_time), id: p.id });
    for (const ev of events) if (ev.date >= todayStr) arr.push({ date: ev.date, type: "event", label: ev.title, time: fmtTime(ev.start_time), id: ev.id });
    arr.sort((a, b) => (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99")));
    return arr.slice(0, 60);
  }, [plans, events, todayStr]);

  const openDay = (d: Date) => {
    setDate(d);
    setPanelOpen(true);
  };

  const goToday = () => {
    setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    setWeekAnchor(startOfWeek(today));
    setDate(today);
  };

  const prev = () => {
    if (view === "week") {
      const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d);
    } else {
      setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    }
  };
  const next = () => {
    if (view === "week") {
      const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); setWeekAnchor(d);
    } else {
      setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    }
  };

  const headerLabel = view === "week"
    ? `${weekGridDays[0].getFullYear()}年${weekGridDays[0].getMonth() + 1}月 第${Math.ceil(weekGridDays[0].getDate() / 7)}週`
    : `${monthAnchor.getFullYear()}年${monthAnchor.getMonth() + 1}月`;

  const renderDayCell = (d: Date, compact: boolean) => {
    const dStr = localDateStr(d);
    const isToday = dStr === todayStr;
    const inMonth = d.getMonth() === monthAnchor.getMonth();
    const items = itemsByDate.get(dStr) ?? [];
    const maxShown = compact ? 3 : 6;
    return (
      <button
        key={dStr}
        onClick={() => openDay(d)}
        className={cn(
          "flex flex-col items-stretch text-left border rounded-md p-1 sm:p-1.5 min-h-[72px] sm:min-h-[96px] transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring",
          isToday ? "border-primary bg-primary/5" : "border-border",
          view === "month" && !inMonth ? "opacity-40" : "",
        )}
      >
        <span className={cn(
          "text-xs sm:text-sm font-medium mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full",
          isToday && "bg-primary text-primary-foreground",
        )}>
          {d.getDate()}
        </span>
        <div className="flex-1 space-y-0.5 overflow-hidden">
          {items.slice(0, maxShown).map((it) => (
            <div
              key={it.type + it.id}
              className={cn("truncate rounded border px-1 py-0.5 text-[10px] sm:text-xs leading-tight", TYPE_STYLES[it.type].chip)}
              title={`${it.time ? it.time + " " : ""}${it.label}`}
            >
              {it.time && <span className="mr-1 opacity-80">{it.time}</span>}
              {it.label}
            </div>
          ))}
          {items.length > maxShown && (
            <div className="text-[10px] text-muted-foreground pl-1">+{items.length - maxShown}件</div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">カレンダー</h1>
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="week">週</TabsTrigger>
            <TabsTrigger value="agenda">一覧</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view !== "agenda" && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={goToday} className="ml-1">今日</Button>
          </div>
          <div className="font-semibold text-lg">{headerLabel}</div>
        </div>
      )}

      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
        {Object.entries(TYPE_STYLES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {view === "month" && (
        <Card className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={w} className={cn("text-center text-xs sm:text-sm font-medium py-1", i === 0 && "text-destructive", i === 6 && "text-primary")}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGridDays.map((d) => renderDayCell(d, true))}
          </div>
        </Card>
      )}

      {view === "week" && (
        <Card className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekGridDays.map((d, i) => (
              <div key={i} className={cn("text-center text-xs sm:text-sm font-medium py-1", i === 0 && "text-destructive", i === 6 && "text-primary")}>
                {WEEKDAY_LABELS[i]} {d.getDate()}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekGridDays.map((d) => renderDayCell(d, false))}
          </div>
        </Card>
      )}

      {view === "agenda" && (
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-3">今後の予定</h3>
          {agendaItems.length === 0 && <p className="text-sm text-muted-foreground">今後の予定はありません</p>}
          <div className="space-y-1.5">
            {agendaItems.map((it) => (
              <button
                key={it.type + it.id}
                onClick={() => openDay(new Date(it.date + "T00:00:00"))}
                className="w-full flex items-center gap-3 p-2 rounded-md border hover:bg-accent/50 text-left"
              >
                <span className="text-xs sm:text-sm text-muted-foreground w-24 shrink-0">
                  {it.date}{it.time ? ` ${it.time}` : ""}
                </span>
                <Badge variant="outline" className={cn("shrink-0", TYPE_STYLES[it.type].chip)}>{TYPE_STYLES[it.type].label}</Badge>
                <span className="truncate text-sm">{it.label}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 日別詳細パネル */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{dateStr}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">{dateStr} に追加</h3>
              <Tabs defaultValue="plan">
                <TabsList className="w-full">
                  <TabsTrigger value="plan" className="flex-1">勉強予定</TabsTrigger>
                  <TabsTrigger value="event" className="flex-1">イベント</TabsTrigger>
                </TabsList>
                <TabsContent value="plan" className="space-y-2 pt-3">
                  <Select value={planSubject} onValueChange={setPlanSubject}>
                    <SelectTrigger><SelectValue placeholder="教科" /></SelectTrigger>
                    <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>開始時刻</Label><Input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} /></div>
                    <div><Label>予定時間(分)</Label><Input type="number" value={planMin} onChange={(e) => setPlanMin(+e.target.value)} /></div>
                  </div>
                  <Textarea value={planContent} onChange={(e) => setPlanContent(e.target.value)} placeholder="内容" />
                  <Button onClick={addPlan} className="w-full">予定を追加</Button>
                </TabsContent>
                <TabsContent value="event" className="space-y-2 pt-3">
                  <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="タイトル (例: 模試)" />
                  <div><Label>開始時刻</Label><Input type="time" value={evTime} onChange={(e) => setEvTime(e.target.value)} /></div>
                  <Textarea value={evDesc} onChange={(e) => setEvDesc(e.target.value)} placeholder="メモ" />
                  <Button onClick={addEvent} className="w-full">イベントを追加</Button>
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", TYPE_STYLES.plan.dot)} />
                この日の勉強予定
              </h3>
              {dayPlans.length === 0 && <p className="text-sm text-muted-foreground">予定なし</p>}
              <div className="space-y-2">
                {dayPlans.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded border">
                    <Checkbox checked={p.done} onCheckedChange={(v) => togglePlan(p.id, !!v)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {fmtTime(p.start_time) && <span className="text-muted-foreground mr-1">{fmtTime(p.start_time)}</span>}
                        {p.subjects?.name ?? "—"} ({p.planned_minutes}分)
                      </div>
                      {p.content && <div className="text-xs text-muted-foreground">{p.content}</div>}
                    </div>
                    <button onClick={() => delPlan(p.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", TYPE_STYLES.event.dot)} />
                イベント
              </h3>
              {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">イベントなし</p>}
              <div className="space-y-2">
                {dayEvents.map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-2 p-2 rounded border">
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {fmtTime(ev.start_time) && <span className="text-muted-foreground mr-1">{fmtTime(ev.start_time)}</span>}
                        {ev.title}
                      </div>
                      {ev.description && <div className="text-xs text-muted-foreground">{ev.description}</div>}
                    </div>
                    <button onClick={() => delEvent(ev.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", TYPE_STYLES.log.dot)} />
                実績
              </h3>
              {dayLogs.length === 0 && <p className="text-sm text-muted-foreground">記録なし</p>}
              {dayLogs.map((l: any) => (
                <div key={l.id} className="text-sm py-1">
                  {fmtTime(l.start_time) && <span className="text-muted-foreground mr-1">{fmtTime(l.start_time)}</span>}
                  {l.subjects?.name ?? "—"} — {l.duration_minutes}分
                </div>
              ))}
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
