import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ListTodo, Plus, Play, Trash2, Store, Clock, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useOrderedSubjects } from "@/lib/subjects";
import { useTimer } from "@/lib/timer-context";
import { useInstalledApps } from "@/lib/marketplace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/todo")({
  head: () => ({
    meta: [
      { title: "ToDoリスト | Study#" },
      { name: "description", content: "教科・目安時間・期日で学習タスクを管理し、タイマーと勉強記録に直結。" },
      { property: "og:title", content: "ToDoリスト | Study#" },
      { property: "og:description", content: "学習直結型のタスク管理アプリ。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodoPage,
});

type Todo = {
  id: string;
  title: string;
  note: string | null;
  subject_id: string | null;
  estimated_minutes: number | null;
  due_date: string | null;
  priority: string;
  is_completed: boolean;
  logged: boolean;
};

const PRI: Record<string, { label: string; cls: string }> = {
  high: { label: "高", cls: "bg-destructive/15 text-destructive" },
  medium: { label: "中", cls: "bg-primary/15 text-primary" },
  low: { label: "低", cls: "bg-muted text-muted-foreground" },
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const TABS = ["今日", "期限切れ", "近日", "完了済み", "すべて"] as const;

function TodoPage() {
  const { user } = useAuth();
  const { installed, loaded, install } = useInstalledApps();
  const { subjects } = useOrderedSubjects();
  const { start } = useTimer();
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("今日");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("none");
  const [mins, setMins] = useState("");
  const [due, setDue] = useState(today());
  const [priority, setPriority] = useState("medium");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("study_todos")
      .select("*")
      .eq("user_id", user.id)
      .order("is_completed")
      .order("due_date", { nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
    setTodos((data as Todo[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, [user]);

  const t0 = today();
  const filtered = useMemo(
    () =>
      todos.filter((t) => {
        if (tab === "完了済み") return t.is_completed;
        if (tab === "すべて") return true;
        if (t.is_completed) return false;
        if (tab === "今日") return !t.due_date || t.due_date === t0;
        if (tab === "期限切れ") return !!t.due_date && t.due_date < t0;
        return !!t.due_date && t.due_date > t0;
      }),
    [todos, tab, t0],
  );
  const todays = todos.filter((t) => t.due_date === t0 || (!t.due_date && !t.is_completed));
  const doneToday = todays.filter((t) => t.is_completed).length;
  const overdue = todos.filter((t) => !t.is_completed && t.due_date && t.due_date < t0).length;

  if (loaded && !installed.has("todo")) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card className="p-6 text-center space-y-3">
          <ListTodo className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-lg font-bold">ToDoリストはインストールされていません</h1>
          <p className="text-sm text-muted-foreground">アプリマーケットからインストールすると使えるようになります。</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => install("todo")}>今すぐインストール</Button>
            <Button variant="outline" asChild><Link to="/market"><Store className="mr-1 h-4 w-4" />マーケット</Link></Button>
          </div>
        </Card>
      </div>
    );
  }

  const add = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("study_todos").insert({
      user_id: user.id,
      title: title.trim(),
      subject_id: subject === "none" ? null : subject,
      estimated_minutes: mins ? Number(mins) : null,
      due_date: due || null,
      priority,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setMins("");
    void load();
  };

  const toggle = async (t: Todo) => {
    const done = !t.is_completed;
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, is_completed: done } : x)));
    await supabase
      .from("study_todos")
      .update({ is_completed: done, completed_at: done ? new Date().toISOString() : null })
      .eq("id", t.id);
  };

  const logIt = async (t: Todo) => {
    if (!user || !t.estimated_minutes) return;
    const { error } = await supabase.from("study_logs").insert({
      user_id: user.id,
      subject_id: t.subject_id,
      date: today(),
      duration_minutes: t.estimated_minutes,
      content: t.title,
    } as never);
    if (error) return toast.error(error.message);
    await supabase.from("study_todos").update({ logged: true }).eq("id", t.id);
    toast.success("勉強記録に登録しました");
    void load();
  };

  const remove = async (id: string) => {
    setTodos((p) => p.filter((x) => x.id !== id));
    await supabase.from("study_todos").delete().eq("id", id);
  };

  const startTimer = (t: Todo) => {
    start({ kind: "stopwatch", targetMs: 0, subjectId: t.subject_id ?? "", content: t.title, record: true, materialIds: [] });
    navigate({ to: "/timer" });
  };

  const subj = (id: string | null) => subjects.find((s) => s.id === id);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ListTodo className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">ToDoリスト</h1>
      </div>

      <Card className="p-4">
        <div className="flex justify-between text-sm mb-2">
          <span>今日の達成状況</span>
          <span className="font-semibold">{doneToday}/{todays.length}{overdue > 0 && <span className="ml-2 text-destructive">期限切れ {overdue}</span>}</span>
        </div>
        <Progress value={todays.length ? (doneToday / todays.length) * 100 : 0} />
      </Card>

      <Card className="p-4 space-y-2">
        <Input placeholder="例: 青チャート p.42〜45 例題3問" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="教科" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">教科なし</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={0} placeholder="目安(分)" value={mins} onChange={(e) => setMins(e.target.value)} />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">優先度: 高</SelectItem>
              <SelectItem value="medium">優先度: 中</SelectItem>
              <SelectItem value="low">優先度: 低</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" onClick={add} disabled={!title.trim()}><Plus className="mr-1 h-4 w-4" />タスクを追加</Button>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => <Button key={x} size="sm" variant={tab === x ? "default" : "outline"} onClick={() => setTab(x)}>{x}</Button>)}
      </div>

      <div className="space-y-2">
        {filtered.map((t) => {
          const s = subj(t.subject_id);
          const late = !t.is_completed && t.due_date && t.due_date < t0;
          return (
            <Card key={t.id} className={`p-3 flex gap-3 items-start ${t.is_completed ? "opacity-70" : ""}`}>
              <Checkbox className="mt-1" checked={t.is_completed} onCheckedChange={() => toggle(t)} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className={`font-medium ${t.is_completed ? "line-through" : ""}`}>{t.title}</div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                  {s && <span className="px-2 py-0.5 rounded-full" style={{ background: s.color + "33", color: s.color }}>{s.name}</span>}
                  <span className={`px-1.5 rounded ${PRI[t.priority]?.cls}`}>{PRI[t.priority]?.label}</span>
                  {t.estimated_minutes ? <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{t.estimated_minutes}分</span> : null}
                  {t.due_date && <span className={`inline-flex items-center gap-0.5 ${late ? "text-destructive" : ""}`}><CalendarDays className="h-3 w-3" />{t.due_date}</span>}
                </div>
                {t.is_completed && t.estimated_minutes && !t.logged && (
                  <Button size="sm" variant="outline" className="h-7 mt-1" onClick={() => logIt(t)}>🎉 {t.estimated_minutes}分を勉強記録に登録</Button>
                )}
              </div>
              {!t.is_completed && <Button size="icon" variant="ghost" aria-label="タイマーで始める" onClick={() => startTimer(t)}><Play className="h-4 w-4" /></Button>}
              <Button size="icon" variant="ghost" aria-label="削除" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">タスクはありません。</p>}
      </div>
    </div>
  );
}
