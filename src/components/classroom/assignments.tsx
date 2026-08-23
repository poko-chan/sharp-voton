import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { gradeSubmission } from "@/lib/classroom.functions";
import { submitQuiz } from "@/lib/classroom-posts.functions";
import { uploadClassroomFile, fileExt, type ClassroomAttachment } from "@/lib/classroom-files";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, ListChecks, X } from "lucide-react";
import { toast } from "sonner";
import { toast } from "sonner";

export function CreateAssignment({ classId, onCreated }: { classId: string; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [max, setMax] = useState(100);
  const [mode, setMode] = useState<"score" | "fixed" | "none">("score");
  const [fixed, setFixed] = useState(50);
  const [kind, setKind] = useState<"standard" | "quiz">("standard");
  const [allowedTypes, setAllowedTypes] = useState("");
  const [attachments, setAttachments] = useState<ClassroomAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [quiz, setQuiz] = useState<any[]>([]);

  const onFile = async (f: File) => {
    if (!user) return;
    setUploading(true);
    try { const a = await uploadClassroomFile(user.id, f); setAttachments((arr) => [...arr, a]); }
    catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };
  const addQ = () => setQuiz((q) => [...q, { id: crypto.randomUUID(), type: "short", question: "", answer: "", points: 1, options: [] }]);

  const submit = async () => {
    if (!title.trim()) return toast.error("タイトルを入力");
    if (kind === "quiz" && quiz.length === 0) return toast.error("問題を1つ以上追加してください");
    const payload: any = {
      class_id: classId, title: title.trim(), description: desc, max_points: max,
      due_at: due ? new Date(due).toISOString() : null, xp_mode: mode, fixed_xp: fixed,
      created_by: (await supabase.auth.getUser()).data.user!.id,
      attachments,
      kind,
      allowed_file_types: allowedTypes.trim() ? allowedTypes.split(",").map((s) => s.trim().toLowerCase().replace(/^\./, "")).filter(Boolean) : null,
      quiz_questions: kind === "quiz" ? quiz : null,
    };
    const { error } = await supabase.from("assignments").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("課題を作成しました");
    setOpen(false); setTitle(""); setDesc(""); setDue(""); setAttachments([]); setQuiz([]); setAllowedTypes("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />課題を作成</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>課題を作成</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>種別</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">標準課題（レポート・記述提出）</SelectItem>
                <SelectItem value="quiz">自動採点小テスト（選択式/短答式）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>タイトル</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>内容・指示</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>期限</Label><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div><Label>配点</Label><Input type="number" value={max} onChange={(e) => setMax(+e.target.value)} /></div>
          </div>

          {kind === "standard" && (
            <div>
              <Label>提出ファイル形式制限（カンマ区切り。空欄=制限なし）</Label>
              <Input value={allowedTypes} onChange={(e) => setAllowedTypes(e.target.value)} placeholder="pdf, docx, jpg" />
            </div>
          )}

          <div className="space-y-2">
            <Label>配布資料・添付ファイル</Label>
            <FileUploader onFile={onFile} uploading={uploading} />
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/40">
                    <span className="truncate">📎 {f.name}</span>
                    <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {kind === "quiz" && (
            <div className="space-y-2 border rounded p-3">
              <div className="flex items-center justify-between">
                <Label>問題</Label>
                <Button size="sm" variant="outline" onClick={addQ}><Plus className="h-3 w-3 mr-1" />問題追加</Button>
              </div>
              {quiz.length === 0 && <p className="text-xs text-muted-foreground">問題を追加してください</p>}
              {quiz.map((q, idx) => (
                <QuizQuestionEditor
                  key={q.id}
                  q={q}
                  index={idx}
                  onChange={(nq) => setQuiz((arr) => arr.map((x, i) => i === idx ? nq : x))}
                  onRemove={() => setQuiz((arr) => arr.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          )}

          <div>
            <Label>レベルへの加算方法</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score">採点点数 = XP</SelectItem>
                <SelectItem value="fixed">提出時に固定XPを付与</SelectItem>
                <SelectItem value="none">XP加算なし</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "fixed" && (
            <div><Label>固定XP</Label><Input type="number" value={fixed} onChange={(e) => setFixed(+e.target.value)} /></div>
          )}
          <Button onClick={submit} className="w-full" disabled={uploading}>作成して全員に配布</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuizQuestionEditor({ q, index, onChange, onRemove }: { q: any; index: number; onChange: (q: any) => void; onRemove: () => void }) {
  return (
    <div className="border rounded p-2 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Q{index + 1}</span>
        <button onClick={onRemove} className="text-destructive"><X className="h-3 w-3" /></button>
      </div>
      <Select value={q.type} onValueChange={(v) => onChange({ ...q, type: v, options: v === "choice" ? (q.options?.length ? q.options : ["", ""]) : [] })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="short">短答式</SelectItem>
          <SelectItem value="choice">選択式</SelectItem>
        </SelectContent>
      </Select>
      <Textarea value={q.question} onChange={(e) => onChange({ ...q, question: e.target.value })} placeholder="問題文" rows={2} className="text-xs" />
      {q.type === "choice" && (
        <div className="space-y-1">
          {(q.options ?? []).map((op: string, i: number) => (
            <div key={i} className="flex items-center gap-1">
              <Input value={op} onChange={(e) => {
                const arr = [...q.options]; arr[i] = e.target.value; onChange({ ...q, options: arr });
              }} placeholder={`選択肢${i + 1}`} className="h-7 text-xs" />
              <button onClick={() => onChange({ ...q, options: q.options.filter((_: any, j: number) => j !== i) })}><X className="h-3 w-3" /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onChange({ ...q, options: [...(q.options ?? []), ""] })}>+ 選択肢追加</Button>
        </div>
      )}
      <Input value={q.answer} onChange={(e) => onChange({ ...q, answer: e.target.value })} placeholder="正解（短答=正解文字列 / 選択=選択肢の文字列と完全一致）" className="h-7 text-xs" />
      <Input type="number" value={q.points} onChange={(e) => onChange({ ...q, points: +e.target.value })} placeholder="配点" className="h-7 text-xs w-20" />
    </div>
  );
}

// ============ Assignment Dialog ============
export function AssignmentDialog({ assignment, isTeacher, members, onClose }: any) {
  const { user } = useAuth();
  const grade = useServerFn(gradeSubmission);
  const submitQuizFn = useServerFn(submitQuiz);
  const [mySub, setMySub] = useState<any>(null);
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<ClassroomAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [quizAns, setQuizAns] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    if (isTeacher) {
      const { data } = await supabase.from("submissions").select("*").eq("assignment_id", assignment.id);
      setAllSubs(data ?? []);
    } else {
      const { data } = await supabase.from("submissions").select("*").eq("assignment_id", assignment.id).eq("user_id", user.id).maybeSingle();
      setMySub(data);
      setContent(data?.content ?? "");
      setFiles(((data?.attachments as any) ?? []) as ClassroomAttachment[]);
      const qa = (data?.quiz_answers as any) ?? null;
      if (qa?.answers) {
        const m: Record<string, string> = {};
        (qa.answers as any[]).forEach((a: any) => { m[a.questionId] = a.answer; });
        setQuizAns(m);
      }
    }
  };
  useEffect(() => { load(); }, [assignment.id, user, isTeacher]);

  const onFile = async (f: File) => {
    if (!user) return;
    const allowed: string[] | null = assignment.allowed_file_types ?? null;
    if (allowed && allowed.length > 0) {
      const ext = fileExt(f.name);
      if (!allowed.includes(ext)) return toast.error(`許可された形式: ${allowed.join(", ")}`);
    }
    if (f.size > 20 * 1024 * 1024) return toast.error("20MB以下にしてください");
    setUploading(true);
    try { const a = await uploadClassroomFile(user.id, f); setFiles((arr) => [...arr, a]); }
    catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!user) return;
    const payload: any = { assignment_id: assignment.id, user_id: user.id, content, attachments: files, submitted_at: new Date().toISOString() };
    if (assignment.xp_mode === "fixed" && !mySub) payload.xp_awarded = assignment.fixed_xp;
    const { error } = mySub
      ? await supabase.from("submissions").update({ content, attachments: files, submitted_at: new Date().toISOString() }).eq("id", mySub.id)
      : await supabase.from("submissions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("提出しました");
    load();
  };

  const submitQuizAns = async () => {
    const answers = (assignment.quiz_questions ?? []).map((q: any) => ({ questionId: q.id, answer: quizAns[q.id] ?? "" }));
    try {
      const r = await submitQuizFn({ data: { assignmentId: assignment.id, answers } });
      toast.success(`自動採点: ${r.earnedPts}/${r.totalPts}点（${r.score}/${assignment.max_points}）`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {assignment.kind === "quiz" ? <ListChecks className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5" />}
            {assignment.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {assignment.due_at ? `期限: ${new Date(assignment.due_at).toLocaleString("ja-JP")}` : "期限なし"} ・ 配点 {assignment.max_points}
            {assignment.allowed_file_types?.length > 0 && <> ・ 提出形式: {assignment.allowed_file_types.join(", ")}</>}
          </div>
          <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
          <AttachmentList attachments={assignment.attachments ?? []} />

          {!isTeacher && assignment.kind === "quiz" && (
            <Card className="p-4 space-y-3">
              <div className="font-semibold text-sm">小テスト{mySub?.graded_at && " (採点済)"}</div>
              {mySub?.graded_at && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-sm">
                  自動採点: <span className="font-bold">{mySub.score}/{assignment.max_points} 点</span> ・ XP {mySub.xp_awarded}
                </div>
              )}
              {(assignment.quiz_questions ?? []).map((q: any, i: number) => {
                const sub = mySub?.quiz_answers?.detail?.find((d: any) => d.questionId === q.id);
                return (
                  <div key={q.id} className="space-y-1">
                    <div className="text-sm font-medium">Q{i + 1}. {q.question} <span className="text-xs text-muted-foreground">({q.points}pt)</span></div>
                    {q.type === "choice" ? (
                      <div className="space-y-1">
                        {(q.options ?? []).map((op: string, j: number) => (
                          <label key={j} className="flex items-center gap-2 text-sm">
                            <input type="radio" name={q.id} value={op} checked={quizAns[q.id] === op} onChange={() => setQuizAns({ ...quizAns, [q.id]: op })} />
                            {op}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Input value={quizAns[q.id] ?? ""} onChange={(e) => setQuizAns({ ...quizAns, [q.id]: e.target.value })} />
                    )}
                    {sub && (
                      <div className={`text-xs ${sub.correct ? "text-emerald-600" : "text-red-600"}`}>
                        {sub.correct ? "✓ 正解" : `✗ 不正解（正解: ${sub.expected}）`}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button onClick={submitQuizAns}>{mySub ? "再提出して再採点" : "提出して自動採点"}</Button>
            </Card>
          )}

          {!isTeacher && assignment.kind !== "quiz" && (
            <Card className="p-4 space-y-2">
              <div className="font-semibold text-sm">あなたの提出</div>
              {mySub?.graded_at && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-sm">
                  <div>採点: <span className="font-bold">{mySub.score}/{assignment.max_points} 点</span> ・ 獲得XP: {mySub.xp_awarded}</div>
                  {mySub.feedback && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{mySub.feedback}</div>}
                </div>
              )}
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="解答や提出内容を入力" rows={5} />
              <FileUploader
                onFile={onFile}
                uploading={uploading}
                accept={assignment.allowed_file_types?.length ? assignment.allowed_file_types.map((t: string) => "." + t).join(",") : undefined}
              />
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/40">
                      <span className="truncate">📎 {f.name}</span>
                      <button onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={submit} disabled={uploading}>{mySub ? "更新して再提出" : "提出"}</Button>
            </Card>
          )}

          {isTeacher && (
            <Card className="p-4 space-y-3">
              <div className="font-semibold text-sm">提出一覧 ({allSubs.length}/{members.length}人)</div>
              {allSubs.length === 0 && <p className="text-xs text-muted-foreground">まだ提出はありません</p>}
              {allSubs.map((s) => {
                const m = members.find((mm: any) => mm.user_id === s.user_id);
                return <GradeRow key={s.id} sub={s} memberName={m?.profile?.display_name ?? m?.profile?.username ?? "?"} max={assignment.max_points} isQuiz={assignment.kind === "quiz"} onGrade={grade} reload={load} />;
              })}
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GradeRow({ sub, memberName, max, isQuiz, onGrade, reload }: any) {
  const [score, setScore] = useState<number>(sub.score ?? 0);
  const [fb, setFb] = useState<string>(sub.feedback ?? "");
  const save = async () => {
    try {
      await onGrade({ data: { submissionId: sub.id, score, feedback: fb } });
      toast.success(`${memberName} を採点しました`);
      reload();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="p-3 rounded border space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{memberName}{isQuiz && <span className="ml-2 text-xs text-primary">自動採点</span>}</div>
        <div className="text-xs text-muted-foreground">{new Date(sub.submitted_at).toLocaleString("ja-JP")}</div>
      </div>
      {sub.content && <p className="text-sm whitespace-pre-wrap bg-muted/30 p-2 rounded">{sub.content}</p>}
      <AttachmentList attachments={sub.attachments ?? []} />
      {isQuiz && sub.quiz_answers?.detail && (
        <div className="text-xs space-y-0.5 bg-muted/30 p-2 rounded">
          {sub.quiz_answers.detail.map((d: any, i: number) => (
            <div key={i} className={d.correct ? "text-emerald-600" : "text-red-600"}>
              {d.correct ? "✓" : "✗"} 回答: {d.userAnswer || "(無回答)"} {!d.correct && `／正解: ${d.expected}`}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input type="number" value={score} onChange={(e) => setScore(+e.target.value)} className="w-20 h-8" max={max} />
        <span className="text-xs text-muted-foreground">/ {max}</span>
        <Input value={fb} onChange={(e) => setFb(e.target.value)} placeholder="フィードバック（個別コメント）" className="h-8" />
        <Button size="sm" onClick={save}>採点</Button>
      </div>
      {sub.graded_at && <div className="text-[10px] text-emerald-600">採点済 ・ 付与XP {sub.xp_awarded}</div>}
    </div>
  );
}
