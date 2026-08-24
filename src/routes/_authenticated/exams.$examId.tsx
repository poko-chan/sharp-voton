import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exams/$examId")({ component: ExamDetail });

function ExamDetail() {
  const { examId } = Route.useParams();
  const { user } = useAuth();
  const [exam, setExam] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [studySubjects, setStudySubjects] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  const load = async () => {
    if (!user) return;
    const { data: e } = await (supabase as any).from("exams").select("*").eq("id", examId).maybeSingle();
    setExam(e);
    const { data: ss } = await (supabase as any).from("exam_subjects").select("*").eq("exam_id", examId).order("order_no").order("created_at");
    setSubjects(ss ?? []);
    if ((ss ?? []).length && !activeId) setActiveId(ss[0].id);
    const { data: subs } = await supabase.from("subjects").select("id,name,color").eq("user_id", user.id);
    setStudySubjects(subs ?? []);
  };
  useEffect(() => { load(); }, [examId, user?.id]);

  const addSubject = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any).from("exam_subjects").insert({
      exam_id: examId, user_id: user.id, name: "新しい教科", max_score: 100, order_no: subjects.length,
    }).select("*").single();
    if (error) return toast.error(error.message);
    setSubjects([...subjects, data]); setActiveId(data.id);
  };

  if (!exam) return <div className="p-8 text-muted-foreground">読み込み中…</div>;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-4">
      <Link to="/exams"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />試験一覧</Button></Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">{exam.name}</h1>
        <span className="text-sm text-muted-foreground">{exam.start_date ?? ""}{exam.end_date && exam.end_date !== exam.start_date ? ` 〜 ${exam.end_date}` : ""}</span>
        <Button size="sm" className="ml-auto" onClick={addSubject}><Plus className="h-4 w-4 mr-1" />教科追加</Button>
      </div>

      {subjects.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">「教科追加」から科目を作成してください。</Card>
      ) : (
        <Tabs value={activeId} onValueChange={setActiveId}>
          <TabsList className="flex flex-wrap h-auto">
            {subjects.map((s) => <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>)}
          </TabsList>
          {subjects.map((s) => (
            <TabsContent key={s.id} value={s.id}>
              <SubjectEditor subject={s} studySubjects={studySubjects} onChanged={load} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function SubjectEditor({ subject, studySubjects, onChanged }: { subject: any; studySubjects: any[]; onChanged: () => void }) {
  const [s, setS] = useState<any>(subject);
  useEffect(() => { setS(subject); }, [subject.id]);

  const save = async (patch: any) => {
    const next = { ...s, ...patch }; setS(next);
    const { error } = await (supabase as any).from("exam_subjects").update(patch).eq("id", s.id);
    if (error) toast.error(error.message);
  };
  const remove = async () => {
    if (!confirm("この教科を削除しますか？")) return;
    await (supabase as any).from("exam_subjects").delete().eq("id", s.id);
    onChanged();
  };

  const toggleStudy = (id: string) => {
    const cur: string[] = s.study_subject_ids ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    save({ study_subject_ids: next });
  };

  return (
    <Card className="p-4 space-y-4 mt-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>教科名</Label><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} onBlur={(e) => save({ name: e.target.value })} /></div>
        <div><Label>試験日</Label><Input type="date" value={s.exam_date ?? ""} onChange={(e) => save({ exam_date: e.target.value || null })} /></div>
        <div><Label>順番</Label><Input type="number" value={s.order_no} onChange={(e) => save({ order_no: Number(e.target.value) })} /></div>
        <div><Label>試験時間（分）</Label><Input type="number" value={s.duration_min ?? ""} onChange={(e) => save({ duration_min: e.target.value ? Number(e.target.value) : null })} /></div>
        <div><Label>満点</Label><Input type="number" value={s.max_score} onChange={(e) => save({ max_score: Number(e.target.value) })} /></div>
        <div><Label>目標点</Label><Input type="number" value={s.target_score ?? ""} onChange={(e) => save({ target_score: e.target.value ? Number(e.target.value) : null })} /></div>
      </div>

      <div>
        <Label>換算する勉強教科（複数選択可）</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {studySubjects.length === 0 && <span className="text-xs text-muted-foreground">勉強教科は /study から追加してください</span>}
          {studySubjects.map((ss) => {
            const on = (s.study_subject_ids ?? []).includes(ss.id);
            return (
              <button key={ss.id} type="button" onClick={() => toggleStudy(ss.id)}
                className={`text-xs px-3 py-1 rounded-full border ${on ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                {on && <Check className="inline h-3 w-3 mr-1" />}{ss.name}
              </button>
            );
          })}
        </div>
      </div>

      <TodoList subjectId={s.id} />

      <div className="border-t pt-3 space-y-3">
        <div className="font-semibold">試験後の記入</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>自分の点数</Label><Input type="number" value={s.actual_score ?? ""} onChange={(e) => save({ actual_score: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>勉強時間 満足度 (1-10)</Label><Input type="number" min={1} max={10} value={s.time_satisfaction ?? ""} onChange={(e) => save({ time_satisfaction: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>勉強内容 満足度 (1-10)</Label><Input type="number" min={1} max={10} value={s.content_satisfaction ?? ""} onChange={(e) => save({ content_satisfaction: e.target.value ? Number(e.target.value) : null })} /></div>
        </div>
        <div><Label>振り返り</Label><Textarea rows={4} value={s.reflection ?? ""} onChange={(e) => setS({ ...s, reflection: e.target.value })} onBlur={(e) => save({ reflection: e.target.value || null })} /></div>
      </div>

      <div className="flex justify-end"><Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" />教科削除</Button></div>
    </Card>
  );
}

function TodoList({ subjectId }: { subjectId: string }) {
  const { user } = useAuth();
  const [todos, setTodos] = useState<any[]>([]);
  const [text, setText] = useState("");

  const load = async () => {
    const { data } = await (supabase as any).from("exam_todos").select("*").eq("exam_subject_id", subjectId).order("order_no").order("created_at");
    setTodos(data ?? []);
  };
  useEffect(() => { load(); }, [subjectId]);

  const add = async () => {
    if (!text.trim() || !user) return;
    const { error } = await (supabase as any).from("exam_todos").insert({
      exam_subject_id: subjectId, user_id: user.id, text: text.trim(), order_no: todos.length,
    });
    if (error) return toast.error(error.message);
    setText(""); load();
  };
  const toggle = async (id: string) => {
    const { error } = await (supabase as any).rpc("complete_exam_todo", { _id: id });
    if (error) return toast.error(error.message);
    load();
  };
  const del = async (id: string) => { await (supabase as any).from("exam_todos").delete().eq("id", id); load(); };

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="font-semibold">やることリスト</div>
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="例：ワーク p.20-30" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button size="sm" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <ul className="space-y-1">
        {todos.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
            <span className={t.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{t.text}</span>
            <button onClick={() => del(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}