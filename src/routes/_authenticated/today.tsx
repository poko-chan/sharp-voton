import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, CalendarClock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { localDateStr } from "@/lib/date";

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
  const [addOpen, setAddOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: es }, { data: as }] = await Promise.all([
      supabase.from("today_entries").select("*").eq("user_id", user.id).eq("date", date).order("start_time"),
      supabase.from("today_activities").select("*").eq("user_id", user.id).order("name"),
    ]);
    setEntries((es as any[]) ?? []);
    setActivities((as as any[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, date]);

  const sorted = useMemo(() => [...entries].sort((a, b) => a.start_time.localeCompare(b.start_time)), [entries]);

  // Build full-day blocks including gray "未割当"
  const blocks = useMemo(() => {
    const out: Array<{ kind: "entry" | "gap"; start: number; end: number; data?: Entry }> = [];
    let cursor = 0;
    for (const e of sorted) {
      const s = toMin(e.start_time), eN = toMin(e.end_time);
      if (s > cursor) out.push({ kind: "gap", start: cursor, end: s });
      out.push({ kind: "entry", start: s, end: eN, data: e });
      cursor = Math.max(cursor, eN);
    }
    if (cursor < 1440) out.push({ kind: "gap", start: cursor, end: 1440 });
    return out;
  }, [sorted]);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of sorted) {
      const d = toMin(e.end_time) - toMin(e.start_time);
      map.set(e.category, (map.get(e.category) ?? 0) + d);
    }
    const used = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return { map, used, unassigned: 1440 - used };
  }, [sorted]);

  const removeEntry = async (id: string) => {
    await supabase.from("today_entries").delete().eq("id", id);
    setEntries((p) => p.filter((e) => e.id !== id));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarClock className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Today</h1>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 ml-auto" />
        <Button variant="outline" onClick={() => setActOpen(true)}><Sparkles className="h-4 w-4 mr-1" />習い事登録</Button>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />追加</Button>
      </div>

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
                  return (
                    <div key={i}
                      className="absolute left-1 right-1 rounded-lg shadow-sm border text-white text-xs p-2 overflow-hidden group"
                      style={{ top, height: h, background: e.color, borderColor: e.color }}>
                      <div className="font-semibold truncate">{e.label || CATEGORIES.find(c => c.key === e.category)?.label}</div>
                      <div className="opacity-90 tabular-nums">{e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}</div>
                      <button onClick={() => removeEntry(e.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-black/30 hover:bg-black/50 rounded p-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
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
    if (toMin(end) <= toMin(start)) return toast.error("終了時刻は開始より後にしてください");
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