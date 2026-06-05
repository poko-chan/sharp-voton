import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BookOpen, Pencil, Save, X, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { localDateStr } from "@/lib/date";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { emitProfileChange } from "@/lib/profile-events";
import { Download, Upload } from "lucide-react";
import { VoiceMicButton } from "@/components/VoiceMicButton";

export const Route = createFileRoute("/_authenticated/study")({
  component: StudyPage,
});

interface Subject { id: string; name: string; color: string; }

function StudyPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [newColor, setNewColor] = useState("#10b981");
  const [date, setDate] = useState(localDateStr());
  const [startTime, setStartTime] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [duration, setDuration] = useState(30);
  const [content, setContent] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: s } = await supabase.from("subjects").select("*").eq("user_id", user.id).order("created_at");
    setSubjects(s ?? []);
    const { data: l } = await supabase.from("study_logs").select("*, subjects(id,name,color)").eq("user_id", user.id).order("date", { ascending: false }).order("start_time", { ascending: true }).limit(1000);
    setLogs(l ?? []);
    emitProfileChange();
  };

  useEffect(() => { load(); }, [user]);

  const addSubject = async () => {
    if (!user || !newSubject.trim()) return;
    const { error } = await supabase.from("subjects").insert({ user_id: user.id, name: newSubject.trim(), color: newColor });
    if (error) return toast.error(error.message);
    setNewSubject(""); load(); toast.success("教科を追加しました");
  };

  const delSubject = async (id: string) => {
    await supabase.from("subjects").delete().eq("id", id); load();
  };

  const addLog = async () => {
    if (!user) return;
    if (!subjectId) {
      toast.error("教科を選択してください");
      return;
    }
    if (duration > 400) {
      toast.error("学習時間は400分以下で入力してください。");
      return;
    }
    if (duration <= 0) {
      toast.error("学習時間は1分以上で入力してください。");
      return;
    }
    const { error } = await supabase.from("study_logs").insert({
      user_id: user.id, date, subject_id: subjectId,
      duration_minutes: duration, content,
      start_time: startTime || null,
    } as never);
    if (error) return toast.error(error.message);
    setContent(""); setDuration(30); setStartTime(""); load(); toast.success("記録しました🎉");
  };

  const delLog = async (id: string) => {
    await supabase.from("study_logs").delete().eq("id", id); load();
  };

  const bulkDelete = async (ids: string[]) => {
    const { error } = await supabase.from("study_logs").delete().in("id", ids);
    if (error) { toast.error(error.message); throw error; }
    toast.success(`${ids.length}件の記録を削除しました`);
    load();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const rows = [["date", "subject", "duration_minutes", "start_time", "content"]];
    logs.forEach((l: any) =>
      rows.push([
        l.date ?? "",
        l.subjects?.name ?? "",
        String(l.duration_minutes ?? 0),
        l.start_time ?? "",
        (l.content ?? "").replace(/"/g, '""'),
      ]),
    );
    const csv = rows
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-logs-${localDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSVをダウンロードしました");
  };

  const importCsv = async (file: File) => {
    if (!user) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast.error("CSVが空です");
    const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
    const idx = (k: string) => header.indexOf(k);
    const iDate = idx("date"), iSubj = idx("subject"), iDur = idx("duration_minutes"), iTime = idx("start_time"), iContent = idx("content");
    if (iDate < 0 || iSubj < 0 || iDur < 0) return toast.error("ヘッダに date, subject, duration_minutes が必要です");
    const subjMap = new Map(subjects.map((s) => [s.name, s.id] as const));
    const rows: any[] = [];
    for (const line of lines.slice(1)) {
      // simple CSV parse: handle quoted fields
      const cells: string[] = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') inQ = false;
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ",") { cells.push(cur); cur = ""; }
          else cur += c;
        }
      }
      cells.push(cur);
      const subjName = cells[iSubj]?.trim();
      let subjectId = subjMap.get(subjName);
      if (!subjectId && subjName) {
        const { data: ns } = await supabase.from("subjects").insert({ user_id: user.id, name: subjName, color: "#10b981" }).select("id").single();
        if (ns) {
          subjectId = ns.id;
          subjMap.set(subjName, ns.id);
        }
      }
      const dur = parseInt(cells[iDur] ?? "0", 10);
      if (!cells[iDate] || isNaN(dur)) continue;
      rows.push({
        user_id: user.id,
        date: cells[iDate].trim(),
        subject_id: subjectId ?? null,
        duration_minutes: Math.min(400, Math.max(1, dur)),
        start_time: iTime >= 0 ? (cells[iTime]?.trim() || null) : null,
        content: iContent >= 0 ? cells[iContent] : "",
      });
    }
    if (!rows.length) return toast.error("有効な行がありません");
    const { error } = await supabase.from("study_logs").insert(rows as never);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length}件を取り込みました`);
    load();
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen /> 勉強記録</h1>
          <p className="text-muted-foreground">毎日の学習内容を記録しよう（過去の日付も編集可）</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" />CSV出力
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />CSV取込
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold">教科</h3>
          <div className="flex gap-2">
            <Input placeholder="数学" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 w-12 rounded border" />
            <Button onClick={addSubject}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {subjects.map((s) => (
              <SubjectRow key={s.id} subject={s} onChanged={load} onDelete={() => delSubject(s.id)} />
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-3 lg:col-span-2">
          <h3 className="font-semibold">記録を追加</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>日付</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>開始時刻（任意）</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div>
              <Label>教科 <span className="text-destructive">*</span></Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="必須：選択してください" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!subjectId && (
                <p className="text-xs text-destructive mt-1">記録するには教科を選択してください</p>
              )}
            </div>
            <div>
              <Label>時間（分）<span className="text-destructive">*</span></Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(+e.target.value)} max={400} />
              {duration > 400 && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />400分を超える記録は受け付けません。
                </p>
              )}
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <Label>学習内容</Label>
                <VoiceMicButton onResult={(t) => setContent((c) => (c ? c + " " : "") + t)} />
              </div>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="今日の学習内容を記入...（マイクボタンで音声入力可）" />
            </div>
          </div>
          <Button onClick={addLog} className="w-full" disabled={!subjectId || duration <= 0 || duration > 400}>記録する</Button>
        </Card>
      </div>

      <DailyLogs logs={logs} onChange={load} onBulkDelete={bulkDelete} />
    </div>
  );
}

function DailyLogs({ logs, onChange, onBulkDelete }: { logs: any[]; onChange: () => void; onBulkDelete: (ids: string[]) => Promise<void> }) {
  // 日付ごとにグルーピング
  const byDate = new Map<string, any[]>();
  logs.forEach((l) => {
    const arr = byDate.get(l.date) ?? [];
    arr.push(l); byDate.set(l.date, arr);
  });
  const dates = Array.from(byDate.keys()); // 既に date desc 順
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    dates.slice(0, 3).forEach((d) => (o[d] = true));
    return o;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allIds = logs.map((l) => l.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  if (logs.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-sm">まだ記録がありません</p>
      </Card>
    );
  }

  const selectedTotal = logs.filter((l) => selected.has(l.id)).reduce((s, l) => s + (l.duration_minutes ?? 0), 0);

  return (
    <Card className="p-6 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h3 className="font-semibold">日別の記録</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            すべて選択
          </label>
          {someSelected && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  選択を削除 ({selected.size})
                </Button>
              }
              title={`${selected.size}件の学習記録を削除しますか？`}
              description="この操作は取り消せません。"
              scopeItems={[
                `学習記録 ${selected.size} 件`,
                `合計 ${Math.floor(selectedTotal / 60)}h ${selectedTotal % 60}m 分の記録`,
              ]}
              confirmLabel="まとめて削除"
              onConfirm={async () => {
                await onBulkDelete(Array.from(selected));
                setSelected(new Set());
              }}
            />
          )}
        </div>
      </div>
      {dates.map((d) => {
        const items = byDate.get(d)!;
        const total = items.reduce((s, x) => s + (x.duration_minutes ?? 0), 0);
        const isOpen = open[d] ?? false;
        const dt = new Date(d + "T00:00:00");
        const weekday = ["日","月","火","水","木","金","土"][dt.getDay()];
        const dayIds = items.map((i) => i.id);
        const daySelected = dayIds.every((id) => selected.has(id));
        return (
          <div key={d} className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-3 hover:bg-muted/40">
              <Checkbox
                checked={daySelected}
                onCheckedChange={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (daySelected) dayIds.forEach((id) => next.delete(id));
                    else dayIds.forEach((id) => next.add(id));
                    return next;
                  });
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={() => setOpen({ ...open, [d]: !isOpen })}
                className="flex-1 flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium">{d}</span>
                  <span className="text-xs text-muted-foreground">({weekday})</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {Math.floor(total / 60)}h {total % 60}m
                  </span>
                  <span className="text-muted-foreground">{items.length}件</span>
                </div>
              </button>
            </div>
            {isOpen && (
              <div className="p-3 pt-0 space-y-2 border-t bg-muted/10">
                {items.map((l: any) => (
                  <div key={l.id} className="flex items-start gap-2">
                    <Checkbox
                      className="mt-3"
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggle(l.id)}
                    />
                    <div className="flex-1">
                      <LogRow log={l} onChange={onChange} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function LogRow({ log, onChange }: { log: any; onChange: () => void }) {
  const [edit, setEdit] = useState(false);
  const [duration, setDuration] = useState(log.duration_minutes ?? 0);
  const [content, setContent] = useState(log.content ?? "");
  const [date, setDate] = useState(log.date);
  const [startTime, setStartTime] = useState(log.start_time ? String(log.start_time).slice(0, 5) : "");
  const [addMin, setAddMin] = useState(0);

  const save = async () => {
    const { error } = await supabase.from("study_logs").update({
      duration_minutes: duration, content, date,
      start_time: startTime || null,
    }).eq("id", log.id);
    if (error) return toast.error(error.message);
    toast.success("更新しました");
    setEdit(false); onChange();
  };

  const addMinutes = async () => {
    if (!addMin) return;
    const newDur = (log.duration_minutes ?? 0) + addMin;
    const { error } = await supabase.from("study_logs").update({ duration_minutes: newDur }).eq("id", log.id);
    if (error) return toast.error(error.message);
    toast.success(`+${addMin}分追加しました`);
    onChange();
  };

  const remove = async () => {
    if (!confirm("削除しますか？")) return;
    await supabase.from("study_logs").delete().eq("id", log.id);
    onChange();
  };

  if (edit) {
    return (
      <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">日付</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">開始時刻</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div><Label className="text-xs">時間(分)</Label><Input type="number" value={duration} onChange={(e) => setDuration(+e.target.value)} /></div>
        </div>
        <div><Label className="text-xs">内容</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} /></div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1" />保存</Button>
          <Button size="sm" variant="ghost" onClick={() => setEdit(false)}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="font-medium">{log.date}{log.start_time ? ` ${String(log.start_time).slice(0,5)}` : ""}</span>
          {log.subjects && (
            <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: log.subjects.color + "33", color: log.subjects.color }}>
              {log.subjects.name}
            </span>
          )}
          <span className="text-muted-foreground">{log.duration_minutes}分</span>
        </div>
        {log.content && <p className="mt-1 text-sm whitespace-pre-wrap">{log.content}</p>}
        <div className="flex items-center gap-2 mt-2">
          <Input type="number" value={addMin} onChange={(e) => setAddMin(+e.target.value)} className="h-7 w-20 text-xs" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addMinutes}>
            <Plus className="h-3 w-3 mr-1" />分を追加
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <button onClick={() => setEdit(true)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
        <button onClick={remove} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function SubjectRow({ subject, onChanged, onDelete }: { subject: Subject; onChanged: () => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const save = async () => {
    const { error } = await supabase.from("subjects").update({ name: name.trim() || subject.name, color }).eq("id", subject.id);
    if (error) return toast.error(error.message);
    toast.success("教科を更新しました");
    setEdit(false); onChanged();
  };
  if (edit) {
    return (
      <div className="flex items-center gap-1 p-2 rounded bg-muted/40">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded border shrink-0" />
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
        <button onClick={save} className="text-primary hover:opacity-70 p-1"><Save className="h-4 w-4" /></button>
        <button onClick={() => { setEdit(false); setName(subject.name); setColor(subject.color); }} className="text-muted-foreground hover:opacity-70 p-1"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between p-2 rounded hover:bg-muted group">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full" style={{ background: subject.color }} />
        <span>{subject.name}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setEdit(true)} className="text-muted-foreground hover:text-foreground p-1" title="編集"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="text-destructive hover:opacity-70 p-1" title="削除"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
