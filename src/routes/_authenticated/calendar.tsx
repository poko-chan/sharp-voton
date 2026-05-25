import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { localDateStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
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

  const planDates = new Set(plans.map((p) => p.date));
  const logDates = new Set(logs.map((l) => l.date));
  const evDates = new Set(events.map((e) => e.date));

  const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : "");

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">カレンダー</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            modifiers={{
              planned: (d) => planDates.has(localDateStr(d)),
              studied: (d) => logDates.has(localDateStr(d)),
              hasEvent: (d) => evDates.has(localDateStr(d)),
            }}
            modifiersClassNames={{
              planned: "ring-2 ring-warning",
              studied: "bg-primary/20 font-bold",
              hasEvent: "underline decoration-2 decoration-blue-500",
            }}
          />
        </Card>
        <div className="space-y-4">
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
            <h3 className="font-semibold mb-3">この日の予定</h3>
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
            <h3 className="font-semibold mb-3">イベント</h3>
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
            <h3 className="font-semibold mb-3">実績</h3>
            {dayLogs.length === 0 && <p className="text-sm text-muted-foreground">記録なし</p>}
            {dayLogs.map((l: any) => (
              <div key={l.id} className="text-sm py-1">
                {fmtTime(l.start_time) && <span className="text-muted-foreground mr-1">{fmtTime(l.start_time)}</span>}
                {l.subjects?.name ?? "—"} — {l.duration_minutes}分
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
