import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Save, FileText, ChevronRight, FlagOff, Image as ImageIcon, Power, Download, BarChart3, Check, X, CalendarDays } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/admin")({ component: AdminPage });

const TYPES = [
  { v: "single", l: "単一選択" }, { v: "multi", l: "複数選択" },
  { v: "text", l: "言葉での回答" }, { v: "written", l: "記述" }, { v: "file", l: "ファイル提出" },
] as const;

function AdminPage() {
  const { user, isAdmin } = useAuth();
  const [units, setUnits] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [pendingQs, setPendingQs] = useState<any[]>([]);
  // NOTE: ALL hooks must be declared BEFORE any early return to keep hook order
  // stable across renders (React error #310 otherwise).
  const [uTitle, setUTitle] = useState("");
  const [uSubjectId, setUSubjectId] = useState<string>("");
  const [uFieldId, setUFieldId] = useState<string>("");
  const [uDesc, setUDesc] = useState("");
  const [draft, setDraft] = useState<any | null>(null);
  const [gradeFor, setGradeFor] = useState<any | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeComment, setGradeComment] = useState("");

  const loadUnits = async () => {
    const { data } = await (supabase as any).from("makron_units").select("*").order("order_idx").order("created_at");
    setUnits(data ?? []);
    const { data: s } = await (supabase as any).from("makron_subjects").select("*").order("order_idx").order("name");
    setSubjects(s ?? []);
    const { data: f } = await (supabase as any).from("makron_fields").select("*").order("order_idx").order("name");
    setFields(f ?? []);
  };
  const loadQuestions = async (unitId: string) => {
    const { data } = await (supabase as any).from("makron_questions").select("*").eq("unit_id", unitId).order("order_idx").order("created_at");
    setQuestions(data ?? []);
  };
  const loadPendingQs = async () => {
    const { data } = await (supabase as any).from("makron_questions")
      .select("*, unit:makron_units(title, subject, field, unit), profile:profiles!makron_questions_created_by_fkey(username, display_name)")
      .eq("status", "pending").order("submitted_at", { ascending: false });
    setPendingQs(data ?? []);
  };
  const loadPending = async () => {
    const { data } = await (supabase as any).from("makron_answers")
      .select("*, question:makron_questions(prompt, points, grading), session:makron_sessions(user_id, started_at)")
      .is("manual_score", null);
    setPending((data ?? []).filter((r: any) => r.question?.grading === "manual"));
  };
  const loadReports = async () => {
    const { data } = await (supabase as any).from("makron_reports")
      .select("*, question:makron_questions(prompt)").order("created_at", { ascending: false }).limit(100);
    setReports(data ?? []);
  };

  useEffect(() => { loadUnits(); loadPending(); loadReports(); loadPendingQs(); }, []);
  useEffect(() => { if (selUnit) loadQuestions(selUnit); }, [selUnit]);

  const loadAnalytics = async () => {
    const { data } = await (supabase as any).rpc("admin_makron_analytics");
    setAnalytics(data ?? []);
  };

  // 問題作成・編集は管理者のみ
  if (!user) {
    return <MakronShell back="/makron" title="管理者画面"><div className="p-6 text-sm">ログインしてください</div></MakronShell>;
  }
  if (!isAdmin) {
    return <MakronShell back="/makron" title="管理者画面"><div className="p-6 text-sm text-muted-foreground">この画面は管理者のみ利用できます。</div></MakronShell>;
  }

  // Create unit (admin only)
  const createUnit = async () => {
    if (!uTitle.trim()) return;
    const sub = subjects.find((s) => s.id === uSubjectId);
    const fld = fields.find((f) => f.id === uFieldId);
    const { error } = await (supabase as any).from("makron_units").insert({
      title: uTitle,
      subject_id: uSubjectId || null,
      field_id: uFieldId || null,
      subject: sub?.name ?? null,
      field: fld?.name ?? null,
      unit: uTitle,
      description: uDesc || null,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    setUTitle(""); setUSubjectId(""); setUFieldId(""); setUDesc("");
    toast.success("単元を作成しました"); loadUnits();
  };
  const deleteUnit = async (id: string) => {
    if (!confirm("この単元と中の問題をすべて削除しますか？")) return;
    const { error } = await (supabase as any).from("makron_units").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selUnit === id) setSelUnit(null);
    loadUnits();
  };

  // Question editor
  const blank = () => ({
    unit_id: selUnit, prompt: "", image_url: "", type: "single",
    options: ["", "", "", ""], correct_options: [], accepted_answers: [],
    model_answer: "", explanation: "", hint_text: "", is_active: true, points: 10, grading: "auto", order_idx: 100,
  });

  const uploadImage = async (file: File) => {
    const path = `admin/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("makron-files").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("makron-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    setDraft((d: any) => ({ ...d, image_url: data?.signedUrl ?? path }));
  };

  const saveQuestion = async () => {
    if (!draft || !draft.prompt.trim()) return toast.error("問題文を入力してください");
    const { id, created_at, updated_at, status, created_by, submitted_at, reviewed_at, reviewed_by, unit, profile, ...rest } = draft;
    const payload = {
      ...rest,
      options: (rest.options ?? []).filter((o: string) => o && o.trim()),
      correct_options: rest.correct_options ?? [],
      accepted_answers: (rest.accepted_answers ?? []).filter((s: string) => s && s.trim()),
    };
    const { error } = id
      ? await (supabase as any).from("makron_questions").update(payload).eq("id", id)
      : await (supabase as any).from("makron_questions").insert(payload);
    if (error) return toast.error(error.message);
    setDraft(null); loadQuestions(selUnit!); loadPendingQs();
    toast.success(isAdmin ? "保存しました（公式）" : "申請しました。管理者の承認をお待ちください");
  };
  const delQuestion = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await (supabase as any).from("makron_questions").delete().eq("id", id);
    loadQuestions(selUnit!);
  };

  // Manual grading
  const loadSubmissionSession = async (sessionId: string) => {
    const { data } = await (supabase as any).from("makron_answers")
      .select("*, question:makron_questions(prompt, points, grading, model_answer)").eq("session_id", sessionId);
    setSubmissions(data ?? []);
  };
  const submitGrade = async () => {
    if (!gradeFor) return;
    await (supabase as any).from("makron_answers").update({
      manual_score: gradeScore, manual_comment: gradeComment || null, awarded_points: gradeScore,
    }).eq("id", gradeFor.id);
    toast.success("採点しました"); setGradeFor(null); loadPending();
  };

  return (
    <MakronShell back="/makron" title="管理者画面">
      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="units" onValueChange={(v) => { if (v === "analytics") loadAnalytics(); if (v === "approve") loadPendingQs(); }}>
          <TabsList>
            <TabsTrigger value="units">単元・問題</TabsTrigger>
            <TabsTrigger value="approve">問題承認 ({pendingQs.length})</TabsTrigger>
            <TabsTrigger value="grading">手動採点 ({pending.length})</TabsTrigger>
            <TabsTrigger value="reports">報告 ({reports.filter(r => r.status === "open").length})</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="h-3 w-3 mr-1" />分析</TabsTrigger>
            <TabsTrigger value="daily"><CalendarDays className="h-3 w-3 mr-1" />デイリー</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 space-y-2">
                <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />新しい単元</div>
                <Input placeholder="タイトル（ユニット名）" value={uTitle} onChange={(e) => setUTitle(e.target.value)} />
                <div className="grid grid-cols-2 gap-1">
                  <Select value={uSubjectId} onValueChange={(v) => { setUSubjectId(v); setUFieldId(""); }}>
                    <SelectTrigger><SelectValue placeholder="教科を選択" /></SelectTrigger>
                    <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={uFieldId} onValueChange={setUFieldId} disabled={!uSubjectId}>
                    <SelectTrigger><SelectValue placeholder="分野を選択" /></SelectTrigger>
                    <SelectContent>{fields.filter((f: any) => f.subject_id === uSubjectId).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="text-[10px] text-muted-foreground">教科・分野ラベルは <a href="/makron/labels" className="underline">ラベル管理</a> から追加してください。</div>
                <Textarea rows={2} placeholder="説明（任意）" value={uDesc} onChange={(e) => setUDesc(e.target.value)} />
                <Button onClick={createUnit} className="w-full" disabled={!uTitle.trim()}>作成</Button>
              </Card>
              <Card className="p-4 space-y-2 max-h-96 overflow-auto">
                <div className="font-bold">単元一覧</div>
                {units.map((u) => (
                  <div key={u.id} className={`flex items-center gap-1 p-2 rounded ${selUnit === u.id ? "bg-primary/10" : "hover:bg-accent"} cursor-pointer`}>
                    <button className="flex-1 min-w-0 text-left" onClick={() => setSelUnit(u.id)}>
                      <div className="font-medium truncate flex items-center gap-1">{u.title} <ChevronRight className="h-3 w-3" /></div>
                      <div className="text-[10px] text-muted-foreground">{[u.subject, u.field, u.unit].filter(Boolean).join(" / ")}</div>
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => deleteUnit(u.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {units.length === 0 && <div className="text-xs text-muted-foreground">まだ単元がありません</div>}
              </Card>
            </div>

            {selUnit && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold">問題一覧 ({questions.length})</div>
                  <Button size="sm" onClick={() => setDraft(blank())}><Plus className="h-4 w-4 mr-1" />問題を追加</Button>
                </div>
                <div className="space-y-1 max-h-72 overflow-auto">
                  {questions.map((q) => (
                    <div key={q.id} className={`flex items-center gap-1 border rounded p-2 text-sm ${q.is_active === false ? "opacity-50 line-through" : ""}`}>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{q.type}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10">{q.points}点</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${q.status === 'approved' ? 'bg-success/15 text-success' : q.status === 'rejected' ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600'}`}>
                        {q.status === 'approved' ? '公式' : q.status === 'rejected' ? '却下' : '申請中'}
                      </span>
                      <span className="flex-1 min-w-0 truncate">{q.prompt}</span>
                      <Button size="sm" variant="ghost" title={q.is_active === false ? "有効化" : "停止"} onClick={async () => {
                        await (supabase as any).from("makron_questions").update({ is_active: q.is_active === false }).eq("id", q.id);
                        loadQuestions(selUnit!);
                      }}><Power className={`h-4 w-4 ${q.is_active === false ? "text-muted-foreground" : "text-success"}`} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDraft({ ...q, options: q.options ?? [], correct_options: q.correct_options ?? [], accepted_answers: q.accepted_answers ?? [] })}>編集</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                {draft && (
                  <Card className="p-4 space-y-3 bg-muted/30">
                    <Textarea placeholder="問題文" value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} rows={3} />
                    <div className="grid md:grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs">タイプ</label>
                        <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v, options: ["single","multi"].includes(v) ? (draft.options.length ? draft.options : ["","","",""]) : [], correct_options: [] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs">配点</label>
                        <Input type="number" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-xs">採点方式</label>
                        <Select value={draft.grading} onValueChange={(v) => setDraft({ ...draft, grading: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto" disabled={!["single","multi","text"].includes(draft.type)}>自動</SelectItem>
                            <SelectItem value="manual">手動</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3" />画像（任意）</label>
                      <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                      {draft.image_url && <img src={draft.image_url} alt="" className="max-h-32 mt-1 border rounded" />}
                    </div>

                    {(draft.type === "single" || draft.type === "multi") && (
                      <div className="space-y-1">
                        <label className="text-xs">選択肢（チェックで正解を選択）</label>
                        {draft.options.map((o: string, i: number) => {
                          const checked = draft.correct_options.includes(o);
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <input type={draft.type === "single" ? "radio" : "checkbox"} checked={checked && !!o} onChange={() => {
                                if (!o) return;
                                if (draft.type === "single") setDraft({ ...draft, correct_options: [o] });
                                else setDraft({ ...draft, correct_options: checked ? draft.correct_options.filter((x: string) => x !== o) : [...draft.correct_options, o] });
                              }} />
                              <Input value={o} onChange={(e) => {
                                const opts = [...draft.options]; const prev = opts[i]; opts[i] = e.target.value;
                                const co = draft.correct_options.map((x: string) => x === prev ? e.target.value : x);
                                setDraft({ ...draft, options: opts, correct_options: co });
                              }} />
                              <Button size="sm" variant="ghost" onClick={() => {
                                const opts = draft.options.filter((_: any, j: number) => j !== i);
                                setDraft({ ...draft, options: opts, correct_options: draft.correct_options.filter((x: string) => x !== draft.options[i]) });
                              }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          );
                        })}
                        <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}><Plus className="h-3 w-3 mr-1" />選択肢追加</Button>
                      </div>
                    )}

                    {draft.type === "text" && (
                      <div>
                        <label className="text-xs">正答（複数可、1行1つ。大文字小文字・前後空白は無視）</label>
                        <Textarea rows={3} value={(draft.accepted_answers ?? []).join("\n")} onChange={(e) => setDraft({ ...draft, accepted_answers: e.target.value.split("\n") })} />
                      </div>
                    )}

                    <div>
                      <label className="text-xs">模範解答（記述・ファイル用 / 任意）</label>
                      <Textarea rows={2} value={draft.model_answer ?? ""} onChange={(e) => setDraft({ ...draft, model_answer: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs">解説（任意）</label>
                      <Textarea rows={2} value={draft.explanation ?? ""} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs">ヒント（任意・コインで生徒に開示）</label>
                      <Textarea rows={2} placeholder="生徒がヒント券を消費すると表示されます。AIは使わず、ここに作成者が記入。" value={draft.hint_text ?? ""} onChange={(e) => setDraft({ ...draft, hint_text: e.target.value })} />
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={draft.is_active !== false} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                      この問題を有効にする（オフにすると生徒に表示されません）
                    </label>

                    <div className="flex gap-2">
                      <Button onClick={saveQuestion}><Save className="h-4 w-4 mr-1" />{draft.id ? "更新" : "作成"}</Button>
                      <Button variant="ghost" onClick={() => setDraft(null)}>キャンセル</Button>
                    </div>
                  </Card>
                )}
              </Card>
            )}
          </TabsContent>

          {isAdmin && (
          <TabsContent value="approve" className="space-y-3">
            {pendingQs.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">承認待ちの問題はありません</Card>}
            {pendingQs.map((q: any) => (
              <Card key={q.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">申請中</span>
                  <span className="text-muted-foreground">単元: {q.unit?.title}</span>
                  <span className="text-muted-foreground">作成者: {q.profile?.display_name ?? q.profile?.username ?? q.created_by?.slice(0,8)}</span>
                  <span className="text-muted-foreground ml-auto">{q.submitted_at ? new Date(q.submitted_at).toLocaleString("ja-JP") : ""}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{q.prompt}</div>
                {q.image_url && <img src={q.image_url} alt="" className="max-h-32 border rounded" />}
                {(q.options ?? []).length > 0 && (
                  <ul className="text-xs pl-4 list-disc">
                    {q.options.map((o: string, i: number) => (
                      <li key={i} className={q.correct_options?.includes(o) ? "text-success font-bold" : ""}>{o}{q.correct_options?.includes(o) && " ✓"}</li>
                    ))}
                  </ul>
                )}
                {q.explanation && <div className="text-xs text-muted-foreground">解説: {q.explanation}</div>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    const { error } = await (supabase as any).rpc("admin_review_question", { _question_id: q.id, _approve: true });
                    if (error) return toast.error(error.message);
                    toast.success("公式承認しました"); loadPendingQs(); if (selUnit && selUnit === q.unit_id) loadQuestions(selUnit);
                  }}><Check className="h-3 w-3 mr-1" />承認</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const { error } = await (supabase as any).rpc("admin_review_question", { _question_id: q.id, _approve: false });
                    if (error) return toast.error(error.message);
                    toast.success("却下しました"); loadPendingQs(); if (selUnit && selUnit === q.unit_id) loadQuestions(selUnit);
                  }}><X className="h-3 w-3 mr-1" />却下</Button>
                </div>
              </Card>
            ))}
          </TabsContent>
          )}

          <TabsContent value="grading" className="space-y-3">
            {pending.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">採点待ちはありません</Card>}
            {pending.map((p) => (
              <Card key={p.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.question?.prompt}</div>
                  <div className="text-[10px] text-muted-foreground">配点 {p.question?.points} 点</div>
                </div>
                <Button size="sm" onClick={() => { setGradeFor(p); setGradeScore(0); setGradeComment(""); }}>採点</Button>
              </Card>
            ))}
            {gradeFor && (
              <Card className="p-4 space-y-2 border-primary/40">
                <div className="font-bold">採点: {gradeFor.question?.prompt}</div>
                <div className="text-xs">生徒の解答: <span className="whitespace-pre-wrap">{JSON.stringify(gradeFor.answer)}</span></div>
                {gradeFor.file_url && <div className="text-xs">提出ファイル: {gradeFor.file_url}</div>}
                <div className="flex gap-2 items-center">
                  <label className="text-xs">点数</label>
                  <Input type="number" value={gradeScore} onChange={(e) => setGradeScore(Number(e.target.value) || 0)} className="w-24" />
                  <span className="text-xs">/ {gradeFor.question?.points}</span>
                </div>
                <Textarea placeholder="講評（任意）" value={gradeComment} onChange={(e) => setGradeComment(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={submitGrade}>確定</Button>
                  <Button variant="ghost" onClick={() => setGradeFor(null)}>キャンセル</Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-2">
            {reports.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">報告はありません</Card>}
            {reports.map((r) => (
              <Card key={r.id} className={`p-3 ${r.status === "open" ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-600">{r.category}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ja-JP")}</span>
                  {r.status === "open" ? (
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => {
                      await (supabase as any).from("makron_reports").update({ status: "closed" }).eq("id", r.id); loadReports();
                    }}><FlagOff className="h-3 w-3 mr-1" />対応済み</Button>
                  ) : <span className="ml-auto text-[10px] text-muted-foreground">対応済</span>}
                </div>
                <div className="text-sm mt-1 truncate">{r.question?.prompt ?? "(問題が削除されました)"}</div>
                {r.suggested_answer && <div className="text-xs mt-1"><FileText className="inline h-3 w-3 mr-0.5" />提案: {r.suggested_answer}</div>}
                {r.note && <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{r.note}</div>}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">問題別の挑戦数・正答率・いいね・平均難易度。CSV出力可能。</div>
                <Button size="sm" variant="outline" onClick={() => {
                  const header = ["問題ID","問題文","挑戦数","正解数","正答率%","いいね","平均難易度"];
                  const rows = analytics.map((r) => [r.question_id, (r.prompt ?? "").replace(/\n/g, " "), r.attempts, r.correct, r.accuracy, r.likes, r.avg_difficulty]);
                  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `makron-analytics-${Date.now()}.csv`; a.click();
                }}><Download className="h-3 w-3 mr-1" />CSV出力</Button>
              </div>
              <Card className="divide-y max-h-[60vh] overflow-auto">
                {analytics.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">データがありません</div>}
                {analytics.map((r: any) => (
                  <div key={r.question_id} className="p-3 text-sm">
                    <div className="font-medium truncate">{r.prompt}</div>
                    <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                      <span>挑戦 {r.attempts}</span>
                      <span>正解 {r.correct}</span>
                      <span className={Number(r.accuracy) < 30 ? "text-destructive font-bold" : ""}>正答率 {r.accuracy}%</span>
                      <span>👍 {r.likes}</span>
                      <span>難度 {Number(r.avg_difficulty).toFixed(1)}/5</span>
                    </div>
                  </div>
                ))}
              </Card>
          </TabsContent>
          <TabsContent value="daily" className="space-y-3">
            <DailySetEditor />
          </TabsContent>
        </Tabs>
      </div>
    </MakronShell>
  );
}

function DailySetEditor() {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [qs, setQs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const loadAll = async () => {
    const { data } = await (supabase as any).from("makron_questions")
      .select("id, prompt, points, status, is_active")
      .eq("status", "approved").eq("is_active", true)
      .order("created_at", { ascending: false }).limit(500);
    setQs(data ?? []);
    const { data: cur } = await (supabase as any).from("makron_daily_sets").select("question_ids").eq("date", date).maybeSingle();
    setSelected((cur?.question_ids as string[]) ?? []);
    const { data: rec } = await (supabase as any).rpc("admin_list_daily_sets", { _limit: 14 });
    setRecent(rec ?? []);
  };
  useEffect(() => { loadAll(); }, [date]);

  const toggle = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const save = async () => {
    const { error } = await (supabase as any).rpc("admin_set_daily_set", { _date: date, _question_ids: selected });
    if (error) return toast.error(error.message);
    toast.success(`${date} のデイリー(${selected.length}問)を保存しました`);
    loadAll();
  };
  const filtered = qs.filter((q) => !search || (q.prompt ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-bold">対象日:</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <span className="text-xs text-muted-foreground">選択中: <span className="font-bold text-foreground">{selected.length}</span> 問</span>
        <Button size="sm" className="ml-auto" onClick={save}><Save className="h-3 w-3 mr-1" />保存</Button>
      </Card>
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-3 space-y-2">
          <div className="font-bold text-sm">問題を選ぶ（承認済み）</div>
          <Input placeholder="検索" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-[55vh] overflow-auto divide-y">
            {filtered.map((q) => (
              <label key={q.id} className={`flex items-center gap-2 p-2 cursor-pointer text-sm ${selected.includes(q.id) ? "bg-primary/10" : "hover:bg-accent/40"}`}>
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{q.points}点</span>
                <span className="flex-1 min-w-0 truncate">{q.prompt}</span>
              </label>
            ))}
            {filtered.length === 0 && <div className="text-xs text-muted-foreground p-3">該当なし</div>}
          </div>
        </Card>
        <Card className="p-3 space-y-2">
          <div className="font-bold text-sm">直近のデイリー</div>
          <div className="max-h-[55vh] overflow-auto divide-y">
            {recent.length === 0 && <div className="text-xs text-muted-foreground p-3">まだ登録なし</div>}
            {recent.map((r: any) => (
              <div key={r.date} className="flex items-center gap-2 py-2 text-sm">
                <span className="tabular-nums">{r.date}</span>
                <span className="text-[10px] text-muted-foreground">{r.num_questions}問</span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setDate(String(r.date).slice(0,10))}>編集</Button>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">
            ※ 設定しない日は、自動で承認済み問題10問が選ばれます。
          </div>
        </Card>
      </div>
    </div>
  );
}


