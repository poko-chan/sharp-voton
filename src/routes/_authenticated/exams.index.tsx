import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ClipboardList, BarChart3, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exams/")({ component: ExamsIndex });

function ExamsIndex() {
  const { user } = useAuth();
  const [series, setSeries] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [openExam, setOpenExam] = useState(false);
  const [openSeries, setOpenSeries] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: ss }, { data: es }] = await Promise.all([
      (supabase as any).from("exam_series").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("exams").select("*").eq("user_id", user.id).order("start_date", { ascending: false, nullsFirst: false }),
    ]);
    setSeries(ss ?? []);
    setExams(es ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const grouped = (sid: string | null) => exams.filter((e) => (e.series_id ?? null) === sid);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardList /> 試験</h1>
        <p className="text-sm text-muted-foreground">勉強時間と試験点数の関係を可視化します。</p>
        <div className="ml-auto flex gap-2">
          <Dialog open={openSeries} onOpenChange={setOpenSeries}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />シリーズ作成</Button></DialogTrigger>
            <SeriesDialog onSaved={() => { setOpenSeries(false); load(); }} />
          </Dialog>
          <Dialog open={openExam} onOpenChange={setOpenExam}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />試験を追加</Button></DialogTrigger>
            <ExamDialog series={series} onSaved={() => { setOpenExam(false); load(); }} />
          </Dialog>
        </div>
      </div>

      {series.map((s) => (
        <section key={s.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">{s.name}</h2>
            <div className="flex items-center gap-1">
              <Link to="/exams/series/$seriesId" params={{ seriesId: s.id }}>
                <Button size="sm" variant="ghost"><BarChart3 className="h-4 w-4 mr-1" />比較</Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (!confirm(`シリーズ「${s.name}」を削除しますか？（中の試験はシリーズなしになります）`)) return;
                  await (supabase as any).from("exams").update({ series_id: null }).eq("series_id", s.id);
                  const { error } = await (supabase as any).from("exam_series").delete().eq("id", s.id);
                  if (error) return toast.error(error.message);
                  toast.success("削除しました");
                  load();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ExamList items={grouped(s.id)} onDeleted={load} />
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="font-bold text-lg">単発の試験</h2>
        <ExamList items={grouped(null)} onDeleted={load} />
      </section>
    </div>
  );
}

function ExamList({ items, onDeleted }: { items: any[]; onDeleted: () => void }) {
  if (items.length === 0) return <Card className="p-4 text-center text-xs text-muted-foreground">試験はありません</Card>;
  const remove = async (e: any) => {
    if (!confirm(`試験「${e.name}」を削除しますか？（教科・やることも削除されます）`)) return;
    const { error } = await (supabase as any).from("exams").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("削除しました");
    onDeleted();
  };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((e) => (
        <Card key={e.id} className="p-3 hover:bg-accent/40 transition relative">
          <Link to="/exams/$examId" params={{ examId: e.id }} className="block pr-8">
            <div className="font-bold">{e.name}</div>
            <div className="text-xs text-muted-foreground">{e.start_date ?? "日程未設定"}{e.end_date && e.end_date !== e.start_date ? ` 〜 ${e.end_date}` : ""}</div>
            {e.note && <div className="text-xs mt-1 line-clamp-2">{e.note}</div>}
          </Link>
          <button
            aria-label="試験を削除"
            onClick={() => remove(e)}
            className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Card>
      ))}
    </div>
  );
}

function SeriesDialog({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const save = async () => {
    if (!name.trim() || !user) return;
    const { error } = await (supabase as any).from("exam_series").insert({ user_id: user.id, name: name.trim(), note: note || null });
    if (error) return toast.error(error.message);
    toast.success("作成しました"); onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>シリーズ作成</DialogTitle></DialogHeader>
      <div className="space-y-2">
        <Label>シリーズ名（例：定期テスト・実力テスト）</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Label>メモ</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <DialogFooter><Button onClick={save}>保存</Button></DialogFooter>
    </DialogContent>
  );
}

function ExamDialog({ series, onSaved }: { series: any[]; onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [seriesId, setSeriesId] = useState<string>("none");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const save = async () => {
    if (!name.trim() || !user) return;
    const { error } = await (supabase as any).from("exams").insert({
      user_id: user.id, name: name.trim(),
      series_id: seriesId === "none" ? null : seriesId,
      start_date: start || null, end_date: end || null,
    });
    if (error) return toast.error(error.message);
    toast.success("作成しました"); onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>試験を追加</DialogTitle></DialogHeader>
      <div className="space-y-2">
        <Label>試験名</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：1学期中間テスト" />
        <Label>シリーズ</Label>
        <Select value={seriesId} onValueChange={setSeriesId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">なし</SelectItem>
            {series.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>開始日</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>終了日</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
      </div>
      <DialogFooter><Button onClick={save}>保存</Button></DialogFooter>
    </DialogContent>
  );
}