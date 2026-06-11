import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScratchPad } from "@/components/makron/ScratchPad";
import { ChevronLeft, ChevronRight, Flag, NotebookPen, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/session/$sessionId")({ component: SessionPage });

type Q = {
  id: string; prompt: string; image_url: string | null; type: "single"|"multi"|"text"|"written"|"file";
  options: string[]; correct_options: string[]; accepted_answers: string[];
  model_answer: string | null; explanation: string | null; points: number; grading: "auto"|"manual";
};

function SessionPage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [showPad, setShowPad] = useState(false);
  const padInit = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await (supabase as any).from("makron_sessions").select("*").eq("id", sessionId).maybeSingle();
      if (!s) return;
      setSession(s);
      padInit.current = s.scratchpad ?? null;
      const { data: qs } = await (supabase as any).from("makron_questions").select("*").eq("unit_id", s.unit_id).neq("is_active", false).order("order_idx").order("created_at");
      setQuestions((qs ?? []) as Q[]);
      const { data: aRows } = await (supabase as any).from("makron_answers").select("*").eq("session_id", sessionId);
      const a: Record<string, any> = {}, f: Record<string, string> = {};
      for (const r of aRows ?? []) {
        a[r.question_id] = r.answer;
        if (r.file_url) f[r.question_id] = r.file_url;
      }
      setAnswers(a); setFiles(f);
    })();
  }, [sessionId]);

  const q = questions[idx];
  const setAns = (val: any) => setAnswers((p) => ({ ...p, [q.id]: val }));

  const saveCurrent = async () => {
    if (!q) return;
    const val = answers[q.id];
    let auto: boolean | null = null;
    if (q.grading === "auto") {
      if (q.type === "single") auto = !!val && (q.correct_options ?? [])[0] === val;
      else if (q.type === "multi") {
        const v = Array.isArray(val) ? [...val].sort() : [];
        const c = [...(q.correct_options ?? [])].sort();
        auto = v.length === c.length && v.every((x, i) => x === c[i]);
      } else if (q.type === "text") {
        const s = String(val ?? "").trim().toLowerCase();
        auto = (q.accepted_answers ?? []).some((a) => a.trim().toLowerCase() === s);
      }
    }
    const pts = auto === true ? q.points : (auto === false ? 0 : null);
    await (supabase as any).from("makron_answers").upsert({
      session_id: sessionId, question_id: q.id, answer: val ?? null,
      file_url: files[q.id] ?? null, auto_correct: auto, awarded_points: pts,
    }, { onConflict: "session_id,question_id" });
  };

  const goto = async (newIdx: number) => { await saveCurrent(); setIdx(newIdx); };

  const finish = async () => {
    await saveCurrent();
    const { error } = await (supabase as any).rpc("finalize_makron_session", { _session_id: sessionId });
    if (error) return toast.error(error.message);
    nav({ to: "/makron/result/$sessionId", params: { sessionId } });
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${sessionId}/${q.id}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("makron-files").upload(path, file);
    if (error) return toast.error(error.message);
    setFiles((p) => ({ ...p, [q.id]: path }));
    toast.success("アップロードしました");
  };

  const saveScratchpad = async (dataUrl: string) => {
    await (supabase as any).from("makron_sessions").update({ scratchpad: dataUrl }).eq("id", sessionId);
    toast.success("計算用紙を保存しました");
  };

  if (!session || !q) return <MakronShell back="/makron"><div className="p-8 text-muted-foreground">読み込み中...</div></MakronShell>;

  return (
    <MakronShell
      back="/makron"
      title={`問題 ${idx + 1} / ${questions.length}`}
      subtitle={`配点: ${q.points} 点`}
      right={<Button size="sm" variant={showPad ? "default" : "outline"} onClick={() => setShowPad((v) => !v)}><NotebookPen className="h-4 w-4 mr-1" />計算用紙</Button>}
    >
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Card className="p-5 space-y-4">
          <div className="text-lg whitespace-pre-wrap">{q.prompt}</div>
          {q.image_url && <img src={q.image_url} alt="" className="max-h-80 rounded border" />}

          {q.type === "single" && (
            <RadioGroup value={answers[q.id] ?? ""} onValueChange={setAns} className="grid gap-2">
              {q.options.map((o, i) => (
                <Label key={i} className="flex items-center gap-2 border rounded p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value={o} /><span>{o}</span>
                </Label>
              ))}
            </RadioGroup>
          )}
          {q.type === "multi" && (
            <div className="grid gap-2">
              {q.options.map((o, i) => {
                const cur = (answers[q.id] as string[]) ?? [];
                const checked = cur.includes(o);
                return (
                  <Label key={i} className="flex items-center gap-2 border rounded p-3 cursor-pointer hover:bg-accent">
                    <Checkbox checked={checked} onCheckedChange={(v) => {
                      const next = v ? [...cur, o] : cur.filter((x) => x !== o);
                      setAns(next);
                    }} />
                    <span>{o}</span>
                  </Label>
                );
              })}
            </div>
          )}
          {q.type === "text" && <Input value={answers[q.id] ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="回答を入力" />}
          {q.type === "written" && <Textarea rows={8} value={answers[q.id] ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="記述で解答" />}
          {q.type === "file" && (
            <div className="space-y-2">
              <Input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              {files[q.id] && <div className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" />提出済: {files[q.id].split("/").pop()}</div>}
            </div>
          )}
        </Card>

        {showPad && (
          <Card className="p-4">
            <ScratchPad initial={padInit.current} onSave={saveScratchpad} />
          </Card>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" disabled={idx === 0} onClick={() => goto(idx - 1)}><ChevronLeft className="h-4 w-4 mr-1" />前へ</Button>
          <div className="text-xs text-muted-foreground">{idx + 1} / {questions.length}</div>
          {idx + 1 < questions.length ? (
            <Button onClick={() => goto(idx + 1)}>次へ<ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button onClick={finish}><Flag className="h-4 w-4 mr-1" />提出して採点へ</Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 pt-2">
          {questions.map((_, i) => (
            <button key={i} onClick={() => goto(i)} className={`h-7 w-7 text-xs rounded border ${i === idx ? "bg-primary text-primary-foreground" : answers[questions[i].id] != null ? "bg-success/20" : ""}`}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </MakronShell>
  );
}