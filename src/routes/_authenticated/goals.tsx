import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Plus, Trash2, Check, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

type Goal = {
  id: string; title: string; description: string | null;
  target_minutes: number; deadline: string | null; done: boolean; created_at: string;
  scope: "all" | "manual"; progress_minutes: number;
  count_from: string | null;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [form, setForm] = useState<{
    title: string; description: string; target_minutes: number; deadline: string; scope: "all" | "manual"; count_from: string;
  }>({ title: "", description: "", target_minutes: 600, deadline: "", scope: "all", count_from: toLocalInput(new Date().toISOString()) });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const list = ((data as unknown) ?? []) as Goal[];
    setGoals(list);
    const { data: logs } = await supabase.from("study_logs").select("date, duration_minutes, created_at").eq("user_id", user.id);
    const map: Record<string, number> = {};
    list.forEach((g) => {
      if (g.scope === "manual") {
        map[g.id] = g.progress_minutes ?? 0;
      } else {
        const since = new Date(g.count_from ?? g.created_at);
        const total = (logs ?? []).filter((l) => new Date(l.created_at) >= since)
          .reduce((s: number, l) => s + (l.duration_minutes ?? 0), 0);
        map[g.id] = total;
      }
    });
    setProgress(map);
  };
  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user || !form.title.trim()) return;
    const { error } = await supabase.from("goals").insert({
      user_id: user.id, title: form.title, description: form.description || null,
      target_minutes: form.target_minutes, deadline: form.deadline || null,
      scope: form.scope, progress_minutes: 0,
      count_from: fromLocalInput(form.count_from),
    } as never);
    if (error) return toast.error(error.message);
    setForm({ title: "", description: "", target_minutes: 600, deadline: "", scope: "all", count_from: toLocalInput(new Date().toISOString()) });
    load(); toast.success("目標を作成しました🎯");
  };

  const toggle = async (g: Goal) => {
    await supabase.from("goals").update({ done: !g.done }).eq("id", g.id); load();
  };
  const remove = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await supabase.from("goals").delete().eq("id", id); load();
  };
  const addManual = async (g: Goal, mins: number) => {
    if (!mins) return;
    const newVal = (g.progress_minutes ?? 0) + mins;
    const { error } = await supabase.from("goals").update({ progress_minutes: newVal } as never).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success(`+${mins}分記録しました`);
    load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="text-primary" /> 学習目標</h1>
        <p className="text-muted-foreground text-sm">目標を立てて達成度を可視化しましょう。</p>
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">新しい目標</h3>
        <div><Label>タイトル</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例: 数学IIIを2週間でマスター" /></div>
        <div><Label>詳細(任意)</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>目標学習時間(分)</Label><Input type="number" value={form.target_minutes} onChange={(e) => setForm({ ...form, target_minutes: +e.target.value })} /></div>
          <div><Label>期限(任意)</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>計測開始日時</Label>
            <Input type="datetime-local" value={form.count_from} onChange={(e) => setForm({ ...form, count_from: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">この日時以降の学習が「全学習記録」モードでカウントされます。</p>
          </div>
        </div>
        <div>
          <Label>進捗の計測方法</Label>
          <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as "all" | "manual" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全ての学習記録の時間で計測</SelectItem>
              <SelectItem value="manual">この目標に個別に記録した時間で計測</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />追加</Button>
      </Card>

      <div className="space-y-3">
        {goals.length === 0 && <p className="text-muted-foreground text-sm">まだ目標がありません。</p>}
        {goals.map((g) => {
          const cur = progress[g.id] ?? 0;
          const pct = Math.min(100, Math.round((cur / Math.max(1, g.target_minutes)) * 100));
          return (
            <GoalCard
              key={g.id} g={g} cur={cur} pct={pct}
              onToggle={() => toggle(g)} onRemove={() => remove(g.id)}
              onAddManual={(m) => addManual(g, m)}
              onSaved={load}
            />
          );
        })}
      </div>
    </div>
  );
}

function GoalCard({ g, cur, pct, onToggle, onRemove, onAddManual, onSaved }: {
  g: Goal; cur: number; pct: number;
  onToggle: () => void; onRemove: () => void;
  onAddManual: (m: number) => void; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(g.target_minutes);
  const [deadline, setDeadline] = useState(g.deadline ?? "");
  const [countFrom, setCountFrom] = useState(toLocalInput(g.count_from ?? g.created_at));

  const save = async () => {
    const { error } = await supabase.from("goals").update({
      target_minutes: target,
      deadline: deadline || null,
      count_from: fromLocalInput(countFrom),
    } as never).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("更新しました");
    setEditing(false);
    onSaved();
  };

  const daysLeft = g.deadline
    ? Math.ceil((new Date(g.deadline + "T23:59:59").getTime() - Date.now()) / 86400000)
    : null;
  const remain = Math.max(0, g.target_minutes - cur);
  const needPerDay = daysLeft && daysLeft > 0 ? Math.ceil(remain / daysLeft) : null;
  const complete = pct >= 100;

  return (
    <Card className={`relative overflow-hidden p-5 liquid-card ${g.done ? "opacity-60" : ""}`}>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.14]"
        style={{
          background: complete
            ? "radial-gradient(600px 180px at 100% 0%, oklch(0.75 0.2 150), transparent 65%)"
            : "radial-gradient(600px 180px at 100% 0%, oklch(0.62 0.22 275), transparent 65%)",
        }}
      />
      <div className="relative flex flex-col sm:flex-row items-start gap-5">
        <div className="shrink-0 mx-auto sm:mx-0">
          <RadialGauge
            value={pct}
            size={124}
            thickness={12}
            ticks={10}
            from={complete ? "oklch(0.78 0.19 150)" : "oklch(0.75 0.17 200)"}
            to={complete ? "oklch(0.62 0.2 160)" : "oklch(0.6 0.22 275)"}
            label={<span className="text-2xl">{pct}%</span>}
            sub={complete ? "達成！" : `残り ${remain}分`}
          />
        </div>

        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-lg flex items-center gap-2 flex-wrap">
                <span className="truncate">{g.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-muted/60 text-muted-foreground font-normal">
                  {g.scope === "manual" ? "個別記録" : "全学習記録"}
                </span>
                {complete && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-bold inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />達成
                  </span>
                )}
              </div>
              {g.description && <div className="text-sm text-muted-foreground mt-1">{g.description}</div>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} title="編集"><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant={g.done ? "secondary" : "outline"} onClick={onToggle} title="完了にする"><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={onRemove} title="削除"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold tabular-nums">{cur} / {g.target_minutes} 分</span>
              <span className="text-muted-foreground tabular-nums">{pct}%</span>
            </div>
            <PowerBar
              value={pct}
              height={18}
              from={complete ? "oklch(0.8 0.18 150)" : "oklch(0.78 0.16 200)"}
              to={complete ? "oklch(0.62 0.2 160)" : "oklch(0.6 0.22 275)"}
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
            {daysLeft !== null && (
              <span className={`px-2 py-1 rounded-full border inline-flex items-center gap-1 ${
                daysLeft < 0 ? "bg-destructive/10 text-destructive border-destructive/30"
                : daysLeft <= 3 ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                : "bg-muted text-muted-foreground border-border"}`}>
                <CalendarClock className="h-3 w-3" />
                {daysLeft < 0 ? `期限を ${Math.abs(daysLeft)} 日超過` : `期限まで ${daysLeft} 日`}
              </span>
            )}
            {needPerDay !== null && !complete && (
              <span className="px-2 py-1 rounded-full border bg-primary/10 text-primary border-primary/25 inline-flex items-center gap-1">
                <Flame className="h-3 w-3" />1日 {needPerDay} 分ペースで達成
              </span>
            )}
            {g.scope === "all" && g.count_from && (
              <span className="px-2 py-1 rounded-full border bg-muted text-muted-foreground">
                開始 {new Date(g.count_from).toLocaleString("ja-JP")}
              </span>
            )}
          </div>

          {editing && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border p-3 bg-muted/30">
              <div><Label className="text-xs">目標時間(分)</Label><Input type="number" value={target} onChange={(e) => setTarget(+e.target.value)} /></div>
              <div><Label className="text-xs">期限</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">計測開始日時</Label><Input type="datetime-local" value={countFrom} onChange={(e) => setCountFrom(e.target.value)} /></div>
              <div className="col-span-2 flex gap-2">
                <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1" />保存</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}

          {g.scope === "manual" && !g.done && !editing && (
            <ManualAdder onAdd={(m) => onAddManual(m)} />
          )}
        </div>
      </div>
    </Card>
  );
}


function ManualAdder({ onAdd }: { onAdd: (m: number) => void }) {
  const [val, setVal] = useState(30);
  return (
    <div className="flex items-center gap-2 mt-3">
      <Input type="number" value={val} onChange={(e) => setVal(+e.target.value)} className="h-8 w-24 text-sm" />
      <span className="text-xs text-muted-foreground">分</span>
      <Button size="sm" variant="outline" onClick={() => onAdd(val)}>
        <Plus className="h-3.5 w-3.5 mr-1" />記録する
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });
