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
import { Plus, Trash2, Save, FileText, ChevronRight, FlagOff, Image as ImageIcon, Power, Download, UserCog, BarChart3, KeyRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/makron/admin")({ component: AdminPage });

const TYPES = [
  { v: "single", l: "単一選択" }, { v: "multi", l: "複数選択" },
  { v: "text", l: "言葉での回答" }, { v: "written", l: "記述" }, { v: "file", l: "ファイル提出" },
] as const;

function AdminPage() {
  const { user, isAdmin } = useAuth();
  const [canCreate, setCanCreate] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [tempList, setTempList] = useState<any[]>([]);

  const loadUnits = async () => {
    const { data } = await (supabase as any).from("makron_units").select("*").order("order_idx").order("created_at");
    setUnits(data ?? []);
  };
  const loadQuestions = async (unitId: string) => {
    const { data } = await (supabase as any).from("makron_questions").select("*").eq("unit_id", unitId).order("order_idx").order("created_at");
    setQuestions(data ?? []);
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

  useEffect(() => { loadUnits(); loadPending(); loadReports(); }, []);
  useEffect(() => { if (selUnit) loadQuestions(selUnit); }, [selUnit]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: tmp } = await (supabase as any).from("temp_question_creators").select("expires_at").eq("user_id", user.id).gt("expires_at", new Date().toISOString()).maybeSingle();
      setCanCreate(isAdmin || !!tmp);
    })();
  }, [user?.id, isAdmin]);

  const loadAnalytics = async () => {
    const { data } = await (supabase as any).rpc("admin_makron_analytics");
    setAnalytics(data ?? []);
  };
  const loadUsersAndTemp = async () => {
    const [{ data: u }, { data: t }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url").limit(200),
      (supabase as any).from("temp_question_creators").select("*, profile:profiles!temp_question_creators_user_id_fkey(username, display_name)").gt("expires_at", new Date().toISOString()),
    ]);
    setAllUsers(u ?? []);
    setTempList(t ?? []);
  };

  if (!canCreate) {
    return (
      <MakronShell back="/makron" title="管理者画面">
        <div className="p-10 text-center text-sm text-muted-foreground">
          この画面は管理者または問題作成権限を持つユーザーのみ利用できます。
        </div>
      </MakronShell>
    );
  }

  // Create unit
  const [uTitle, setUTitle] = useState(""); const [uSubj, setUSubj] = useState(""); const [uField, setUField] = useState(""); const [uUnit, setUUnit] = useState(""); const [uDesc, setUDesc] = useState("");
  const createUnit = async () => {
    if (!uTitle.trim()) return;
    const { error } = await (supabase as any).from("makron_units").insert({
      title: uTitle, subject: uSubj || null, field: uField || null, unit: uUnit || null,
      description: uDesc || null, created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    setUTitle(""); setUSubj(""); setUField(""); setUUnit(""); setUDesc("");
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
  const [draft, setDraft] = useState<any | null>(null);

  const uploadImage = async (file: File) => {
    const path = `admin/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("makron-files").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("makron-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    setDraft((d: any) => ({ ...d, image_url: data?.signedUrl ?? path }));
  };

  const saveQuestion = async () => {
    if (!draft || !draft.prompt.trim()) return toast.error("問題文を入力してください");
    const payload = {
      ...draft,
      options: (draft.options ?? []).filter((o: string) => o && o.trim()),
      correct_options: draft.correct_options ?? [],
      accepted_answers: (draft.accepted_answers ?? []).filter((s: string) => s && s.trim()),
    };
    const { error } = draft.id
      ? await (supabase as any).from("makron_questions").update(payload).eq("id", draft.id)
      : await (supabase as any).from("makron_questions").insert(payload);
    if (error) return toast.error(error.message);
    setDraft(null); loadQuestions(selUnit!); toast.success("保存しました");
  };
  const delQuestion = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await (supabase as any).from("makron_questions").delete().eq("id", id);
    loadQuestions(selUnit!);
  };

  // Manual grading
  const [gradeFor, setGradeFor] = useState<any | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeComment, setGradeComment] = useState("");
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
        <Tabs defaultValue="units" onValueChange={(v) => { if (v === "analytics") loadAnalytics(); if (v === "users") loadUsersAndTemp(); }}>
          <TabsList>
            <TabsTrigger value="units">単元・問題</TabsTrigger>
            <TabsTrigger value="grading">手動採点 ({pending.length})</TabsTrigger>
            <TabsTrigger value="reports">報告 ({reports.filter(r => r.status === "open").length})</TabsTrigger>
            {isAdmin && <TabsTrigger value="users"><UserCog className="h-3 w-3 mr-1" />ユーザー</TabsTrigger>}
            {isAdmin && <TabsTrigger value="analytics"><BarChart3 className="h-3 w-3 mr-1" />分析</TabsTrigger>}
          </TabsList>

          <TabsContent value="units" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 space-y-2">
                <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />新しい単元</div>
                <Input placeholder="タイトル" value={uTitle} onChange={(e) => setUTitle(e.target.value)} />
                <div className="grid grid-cols-3 gap-1">
                  <Input placeholder="教科" value={uSubj} onChange={(e) => setUSubj(e.target.value)} />
                  <Input placeholder="分野" value={uField} onChange={(e) => setUField(e.target.value)} />
                  <Input placeholder="ユニット" value={uUnit} onChange={(e) => setUUnit(e.target.value)} />
                </div>
                <Textarea rows={2} placeholder="説明（任意）" value={uDesc} onChange={(e) => setUDesc(e.target.value)} />
                <Button onClick={createUnit} className="w-full">作成</Button>
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
                    <div key={q.id} className="flex items-center gap-1 border rounded p-2 text-sm">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{q.type}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10">{q.points}点</span>
                      <span className="flex-1 min-w-0 truncate">{q.prompt}</span>
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

                    <div className="flex gap-2">
                      <Button onClick={saveQuestion}><Save className="h-4 w-4 mr-1" />{draft.id ? "更新" : "作成"}</Button>
                      <Button variant="ghost" onClick={() => setDraft(null)}>キャンセル</Button>
                    </div>
                  </Card>
                )}
              </Card>
            )}
          </TabsContent>

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
        </Tabs>
      </div>
    </MakronShell>
  );
}