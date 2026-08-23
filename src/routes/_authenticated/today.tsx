import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, CalendarClock, Sparkles } from "lucide-react";
import { School, BookOpen, Brain } from "lucide-react";
import { toast } from "sonner";
import { localDateStr } from "@/lib/date";
import { nanoReflectDaily } from "@/lib/nano-tasks";
import { ChromeAiStatusBadge } from "@/components/ChromeAiStatusBadge";

export const Route = createFileRoute("/_authenticated/today")({ component: TodayPage });

const CATEGORIES = [
  { key: "school",   label: "学校",       color: "#60a5fa" },
  { key: "study",    label: "勉強",       color: "#22c55e" },
  { key: "meal",     label: "ご飯",       color: "#f59e0b" },
  { key: "activity", label: "習い事",     color: "#a855f7" },
  { key: "free",     label: "自由時間",   color: "#ec4899" },
  { key: "sleep",    label: "睡眠",       color: "#6366f1" },
  { key: "bath",     label: "お風呂",     color: "#06b6d4" },
  { key: "travel",   label: "移動",       color: "#94a3b8" },
  { key: "event",    label: "イベント",   color: "#ef4444" },
  { key: "custom",   label: "カスタム",   color: "#0ea5e9" },
] as const;

type Entry = {
  id: string;
  date: string;
  category: string;
  label: string | null;
  color: string;
  start_time: string;
  end_time: string;
  activity_id: string | null;
  notes: string | null;
  travel_before_min: number;
  travel_after_min: number;
};

type StudyLog = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number;
  content: string | null;
  subject_id: string | null;
};
type Subject = { id: string; name: string; color: string };

type Activity = {
  id: string;
  name: string;
  color: string;
  category: string;
  default_duration_min: number;
  location: string | null;
};

const HOUR_PX = 56; // height per hour
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function TodayPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<string>(() => localDateStr());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [reflection, setReflection] = useState<string>("");
  const [reflecting, setReflecting] = useState(false);
  const reflectFn = async ({ data }: { data: { date: string } }) => {
    // 該当日のセグメント/学習ログを取得してNanoで要約
    const [{ data: es }, { data: ls }] = await Promise.all([
      supabase.from("today_entries").select("category,label,start_time,end_time").eq("user_id", user!.id).eq("date", data.date).order("start_time"),
      supabase.from("study_logs").select("duration_minutes,content,subjects(name)").eq("user_id", user!.id).eq("date", data.date),
    ]);
    const segments = ((es as any[]) ?? []).map((e) => `${e.start_time}-${e.end_time} ${e.category} ${e.label ?? ""}`).join("\n");
    const total = ((ls as any[]) ?? []).reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
    const subs = Array.from(new Set(((ls as any[]) ?? []).map((l) => l.subjects?.name).filter(Boolean))).join(", ");
    const summary = await nanoReflectDaily({ date: data.date, segments, studyTotalMin: total, subjects: subs });
    await supabase.from("daily_reflections").upsert({ user_id: user!.id, date: data.date, summary }, { onConflict: "user_id,date" });
    return { summary };
  };

  const load = async () => {
    if (!user) return;
    // Fetch entries for selected date AND the previous day (to render cross-midnight sleep).
    const prev = new Date(date + "T00:00:00"); prev.setDate(prev.getDate() - 1);
    const prevStr = prev.toISOString().slice(0, 10);
    const [{ data: es }, { data: as }, { data: ls }, { data: subs }] = await Promise.all([
      supabase.from("today_entries").select("*").eq("user_id", user.id).eq("date", date).order("start_time"),
      supabase.from("today_activities").select("*").eq("user_id", user.id).order("name"),
      supabase.from("study_logs").select("id,date,start_time,duration_minutes,content,subject_id").eq("user_id", user.id).eq("date", date),
      supabase.from("subjects").select("id,name,color").eq("user_id", user.id),
    ]);
    // Also fetch sleep that started yesterday and crosses midnight
    const { data: prevEs } = await supabase.from("today_entries").select("*").eq("user_id", user.id).eq("date", prevStr).eq("category", "sleep");
    const crossing = ((prevEs as any[]) ?? []).filter((e) => e.end_time <= e.start_time);
    setEntries([...((es as any[]) ?? []), ...crossing.map((e) => ({ ...e, _fromPrev: true }))]);
    setActivities((as as any[]) ?? []);
    setLogs((ls as any[]) ?? []);
    setSubjects((subs as any[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, date]);

  // Load saved reflection for date
  useEffect(() => {
    if (!user) { setReflection(""); return; }
    supabase.from("daily_reflections").select("summary").eq("user_id", user.id).eq("date", date).maybeSingle()
      .then(({ data }) => setReflection(data?.summary ?? ""));
  }, [user?.id, date]);

  const doReflect = async () => {
    setReflecting(true);
    try {
      const r = await reflectFn({ data: { date } });
      setReflection(r.summary);
    } catch (e: any) {
      toast.error(e.message ?? "AI失敗");
    } finally {
      setReflecting(false);
    }
  };

  // Convert entries into render segments (splitting cross-day blocks at midnight).
  const segments = useMemo(() => {
    type Seg = { id: string; entry: Entry; start: number; end: number };
    const out: Seg[] = [];
    for (const e of entries as (Entry & { _fromPrev?: boolean })[]) {
      const s = toMin(e.start_time), eN = toMin(e.end_time);
      if (eN > s && !e._fromPrev) {
        out.push({ id: e.id, entry: e, start: s, end: eN });
      } else if (eN <= s && !e._fromPrev) {
        // crosses midnight: today shows start→1440
        out.push({ id: e.id + "-a", entry: e, start: s, end: 1440 });
      } else if (e._fromPrev) {
        // yesterday's cross-midnight block shows 0→end on today
        out.push({ id: e.id + "-b", entry: e, start: 0, end: eN });
      }
    }
    // Merge study_logs into segments as "study" category
    for (const l of logs) {
      if (!l.start_time || !l.duration_minutes) continue;
      const s = toMin(l.start_time.slice(0, 5));
      const eN = Math.min(1440, s + l.duration_minutes);
      const subj = subjects.find((x) => x.id === l.subject_id);
      const color = subj?.color ?? "#22c55e";
      const label = (subj?.name ? subj.name + (l.content ? `：${l.content}` : "") : l.content) || "勉強";
      out.push({
        id: "log-" + l.id,
        entry: { id: "log-" + l.id, date: l.date, category: "study", label, color, start_time: l.start_time.slice(0, 5), end_time: fromMin(eN), activity_id: null, notes: null, travel_before_min: 0, travel_after_min: 0 },
        start: s, end: eN,
      });
    }
    return out.sort((a, b) => a.start - b.start);
  }, [entries, logs, subjects]);

  // Build full-day blocks including gray "未割当"
  const blocks = useMemo(() => {
    const out: Array<{ kind: "entry" | "gap"; start: number; end: number; data?: Entry; segId?: string }> = [];
    let cursor = 0;
    for (const seg of segments) {
      if (seg.start > cursor) out.push({ kind: "gap", start: cursor, end: seg.start });
      out.push({ kind: "entry", start: seg.start, end: seg.end, data: seg.entry, segId: seg.id });
      cursor = Math.max(cursor, seg.end);
    }
    if (cursor < 1440) out.push({ kind: "gap", start: cursor, end: 1440 });
    return out;
  }, [segments]);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const seg of segments) {
      const d = seg.end - seg.start;
      map.set(seg.entry.category, (map.get(seg.entry.category) ?? 0) + d);
    }
    const used = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return { map, used, unassigned: 1440 - used };
  }, [segments]);

  const removeEntry = async (id: string) => {
    if (id.startsWith("log-")) {
      toast.info("勉強記録は「勉強記録」画面から削除してください");
      return;
    }
    await supabase.from("today_entries").delete().eq("id", id);
    setEntries((p) => p.filter((e) => e.id !== id));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarClock className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Today</h1>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 ml-auto" />
        <Button variant="outline" onClick={() => setSchoolOpen(true)}><School className="h-4 w-4 mr-1" />学校テンプレ</Button>
        <Button variant="outline" onClick={() => setActOpen(true)}><Sparkles className="h-4 w-4 mr-1" />習い事登録</Button>
        <Button variant="outline" onClick={doReflect} disabled={reflecting} title="今日の学習ログ・タイムラインを元に、AIが『今日できたこと/次の一手』を要約します">
          <Brain className="h-4 w-4 mr-1" />{reflecting ? "AI考え中..." : "今日の振り返り (AI)"}
        </Button>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />追加</Button>
      </div>
      <ChromeAiStatusBadge />

      {reflection && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Brain className="h-4 w-4 text-primary" />AIによる振り返り</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap leading-relaxed">{reflection}</CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>タイムライン（24h）</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="relative border-t">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="flex border-b border-border/50" style={{ height: HOUR_PX }}>
                  <div className="w-14 shrink-0 text-xs text-muted-foreground px-2 pt-1 tabular-nums border-r">{String(h).padStart(2, "0")}:00</div>
                  <div className="flex-1" />
                </div>
              ))}
              {/* overlay blocks absolutely positioned */}
              <div className="absolute inset-0 left-14">
                {blocks.map((b, i) => {
                  const top = (b.start / 60) * HOUR_PX;
                  const h = ((b.end - b.start) / 60) * HOUR_PX;
                  if (b.kind === "gap") {
                    return (
                      <div key={i} className="absolute left-1 right-1 bg-muted/30 border border-dashed border-border rounded"
                        style={{ top, height: h }} />
                    );
                  }
                  const e = b.data!;
                  const isLog = (b.segId || "").startsWith("log-");
                  return (
                    <div key={i}
                      className="absolute left-1 right-1 rounded-lg shadow-sm border text-white text-xs p-2 overflow-hidden group"
                      style={{ top, height: h, background: e.color, borderColor: e.color }}>
                      <div className="font-semibold truncate flex items-center gap-1">
                        {isLog && <BookOpen className="h-3 w-3 shrink-0" />}
                        {e.label || CATEGORIES.find(c => c.key === e.category)?.label}
                      </div>
                      <div className="opacity-90 tabular-nums">{e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}</div>
                      {!isLog && (
                        <button onClick={() => removeEntry(e.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-black/30 hover:bg-black/50 rounded p-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>サマリー</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {CATEGORIES.map((c) => {
              const m = totals.map.get(c.key) ?? 0;
              if (!m) return null;
              return (
                <div key={c.key} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
                  <span className="flex-1">{c.label}</span>
                  <span className="tabular-nums text-muted-foreground">{Math.floor(m / 60)}h {m % 60}m</span>
                </div>
              );
            })}
            <div className="border-t my-2" />
            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-sm bg-muted" />
              <span className="flex-1">未割当</span>
              <span className="tabular-nums text-muted-foreground">{Math.floor(totals.unassigned / 60)}h {totals.unassigned % 60}m</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddEntryDialog open={addOpen} onOpenChange={setAddOpen} activities={activities} date={date} onCreated={load} />
      <ActivitiesDialog open={actOpen} onOpenChange={setActOpen} activities={activities} reload={load} />
      <SchoolTemplateDialog open={schoolOpen} onOpenChange={setSchoolOpen} date={date} subjects={subjects} onCreated={load} />
    </div>
  );
}

function AddEntryDialog({ open, onOpenChange, activities, date, onCreated }:
  { open: boolean; onOpenChange: (v: boolean) => void; activities: Activity[]; date: string; onCreated: () => void; }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("quick");
  const [category, setCategory] = useState<string>("study");
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [activityId, setActivityId] = useState<string>("");
  const [travelBefore, setTravelBefore] = useState(0);
  const [travelAfter, setTravelAfter] = useState(0);

  const submit = async () => {
    if (!user) return;
    if (toMin(end) <= toMin(start) && category !== "sleep") {
      return toast.error("終了時刻は開始より後にしてください（睡眠のみ翌日跨ぎ可）");
    }
    const cat = CATEGORIES.find(c => c.key === category)!;
    let color: string = cat.color;
    let lbl: string = label || cat.label;
    if (activityId) {
      const a = activities.find(x => x.id === activityId);
      if (a) { color = a.color; lbl = a.name; }
    }
    const { error } = await supabase.from("today_entries").insert({
      user_id: user.id, date, category, label: lbl, color,
      start_time: start, end_time: end, activity_id: activityId || null,
      travel_before_min: travelBefore, travel_after_min: travelAfter,
    });
    if (error) return toast.error(error.message);
    toast.success("追加しました");
    onOpenChange(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>予定を追加</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="quick">クイック</TabsTrigger>
            <TabsTrigger value="activity">習い事</TabsTrigger>
          </TabsList>
          <TabsContent value="quick" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>カテゴリ</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />{c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ラベル（任意）</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例: 数学の宿題" />
            </div>
          </TabsContent>
          <TabsContent value="activity" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>習い事</Label>
              <Select value={activityId} onValueChange={(v) => { setActivityId(v); setCategory("activity"); }}>
                <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                <SelectContent>
                  {activities.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm" style={{ background: a.color }} />{a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>移動(前) 分</Label>
                <Input type="number" min={0} value={travelBefore} onChange={(e) => setTravelBefore(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>移動(後) 分</Label>
                <Input type="number" min={0} value={travelAfter} onChange={(e) => setTravelAfter(Number(e.target.value) || 0)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>開始</Label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>終了</Label>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>追加</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- School Template Dialog ---------- */
type Period = { type: "lesson" | "break" | "lunch" | "custom"; name: string; start: string; end: string; subject?: string };

function SchoolTemplateDialog({ open, onOpenChange, date, subjects, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; date: string; subjects: Subject[]; onCreated: () => void;
}) {
  const { user } = useAuth();
  const [departHome, setDepartHome] = useState("07:30");
  const [arriveSchool, setArriveSchool] = useState("08:10");
  const [departSchool, setDepartSchool] = useState("15:30");
  const [arriveHome, setArriveHome] = useState("16:00");
  const [periods, setPeriods] = useState<Period[]>([
    { type: "lesson", name: "1限", start: "08:30", end: "09:20", subject: "" },
    { type: "lesson", name: "2限", start: "09:30", end: "10:20", subject: "" },
    { type: "break", name: "休み時間", start: "10:20", end: "10:35" },
    { type: "lesson", name: "3限", start: "10:35", end: "11:25", subject: "" },
    { type: "lesson", name: "4限", start: "11:35", end: "12:25", subject: "" },
    { type: "lunch", name: "昼食", start: "12:25", end: "13:10" },
    { type: "lesson", name: "5限", start: "13:15", end: "14:05", subject: "" },
    { type: "lesson", name: "6限", start: "14:15", end: "15:05", subject: "" },
  ]);

  const addPeriod = () => setPeriods((p) => [...p, { type: "lesson", name: `${p.length + 1}限`, start: "13:00", end: "13:50", subject: "" }]);
  const delPeriod = (i: number) => setPeriods((p) => p.filter((_, idx) => idx !== i));
  const updPeriod = (i: number, patch: Partial<Period>) => setPeriods((p) => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const apply = async () => {
    if (!user) return;
    const rows: any[] = [];
    // 出発→学校到着 = 移動
    rows.push({ user_id: user.id, date, category: "travel", label: "登校", color: "#94a3b8", start_time: departHome, end_time: arriveSchool });
    for (const p of periods) {
      const cat = p.type === "lesson" ? "school" : p.type === "lunch" ? "meal" : p.type === "break" ? "school" : "school";
      const color = p.type === "lesson" ? "#60a5fa" : p.type === "lunch" ? "#f59e0b" : "#93c5fd";
      let label = p.name;
      if (p.type === "lesson" && p.subject) label = `${p.name}・${p.subject}`;
      rows.push({ user_id: user.id, date, category: cat, label, color, start_time: p.start, end_time: p.end });
    }
    // 下校移動
    rows.push({ user_id: user.id, date, category: "travel", label: "下校", color: "#94a3b8", start_time: departSchool, end_time: arriveHome });
    const { error } = await supabase.from("today_entries").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} 件追加しました`);
    onOpenChange(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>学校テンプレ適用</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>家を出発</Label><Input type="time" value={departHome} onChange={(e) => setDepartHome(e.target.value)} /></div>
            <div><Label>学校到着</Label><Input type="time" value={arriveSchool} onChange={(e) => setArriveSchool(e.target.value)} /></div>
            <div><Label>学校出発</Label><Input type="time" value={departSchool} onChange={(e) => setDepartSchool(e.target.value)} /></div>
            <div><Label>帰宅</Label><Input type="time" value={arriveHome} onChange={(e) => setArriveHome(e.target.value)} /></div>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">時程</h3>
              <Button size="sm" variant="outline" onClick={addPeriod}><Plus className="h-3 w-3 mr-1" />追加</Button>
            </div>
            <div className="space-y-1.5 max-h-[40vh] overflow-auto pr-1">
              {periods.map((p, i) => (
                <div key={i} className="flex gap-1 items-center bg-muted/30 rounded p-1.5">
                  <Select value={p.type} onValueChange={(v) => updPeriod(i, { type: v as any })}>
                    <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lesson">授業</SelectItem>
                      <SelectItem value="break">休み時間</SelectItem>
                      <SelectItem value="lunch">昼食</SelectItem>
                      <SelectItem value="custom">その他</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="h-8 flex-1" placeholder="名前" value={p.name} onChange={(e) => updPeriod(i, { name: e.target.value })} />
                  {p.type === "lesson" && (
                    <Input className="h-8 w-28" placeholder="教科" list={`subjs-${i}`} value={p.subject || ""} onChange={(e) => updPeriod(i, { subject: e.target.value })} />
                  )}
                  <datalist id={`subjs-${i}`}>{subjects.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                  <Input className="h-8 w-24" type="time" value={p.start} onChange={(e) => updPeriod(i, { start: e.target.value })} />
                  <Input className="h-8 w-24" type="time" value={p.end} onChange={(e) => updPeriod(i, { end: e.target.value })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => delPeriod(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={apply}>テンプレ適用（{periods.length + 2}件追加）</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivitiesDialog({ open, onOpenChange, activities, reload }:
  { open: boolean; onOpenChange: (v: boolean) => void; activities: Activity[]; reload: () => void; }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#a855f7");
  const [duration, setDuration] = useState(60);

  const add = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("today_activities").insert({
      user_id: user.id, name: name.trim(), color, category: "lesson", default_duration_min: duration,
    });
    if (error) return toast.error(error.message);
    setName(""); reload();
  };
  const del = async (id: string) => { await supabase.from("today_activities").delete().eq("id", id); reload(); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>習い事 登録</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="名前" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded border" />
            <Input type="number" className="w-20" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} />
            <Button onClick={add}>追加</Button>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-auto">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded border">
                <span className="h-4 w-4 rounded" style={{ background: a.color }} />
                <span className="flex-1 text-sm">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.default_duration_min}分</span>
                <Button size="icon" variant="ghost" onClick={() => del(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {activities.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">まだ登録がありません</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}