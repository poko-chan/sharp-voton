import { QUESTION_COLUMNS, loadQuestionKeys } from "@/lib/makron-questions";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, FileText, ChevronRight, FlagOff, Image as ImageIcon, Power, Tags, Pencil, Flag, ExternalLink, Package } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { GRADES } from "@/lib/makron-grades";


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
  const [selSubj, setSelSubj] = useState<string | null>(null);
  const [newSubj, setNewSubj] = useState("");
  const [newField, setNewField] = useState("");
  const [selUnit, setSelUnit] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportDetail, setReportDetail] = useState<any | null>(null);
  const [reportFilter, setReportFilter] = useState<"open" | "all">("open");
  const [uTitle, setUTitle] = useState("");
  const [uSubjectId, setUSubjectId] = useState<string>("");
  const [uFieldId, setUFieldId] = useState<string>("");
  const [uDesc, setUDesc] = useState("");
  const [draft, setDraft] = useState<any | null>(null);
  // パック管理
  const [packs, setPacks] = useState<any[]>([]);
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pGrade, setPGrade] = useState("");
  const [pSubj, setPSubj] = useState("");
  const [pField, setPField] = useState("");
  const [pUnit, setPUnit] = useState("");


  const loadLabels = async () => {
    const { data } = await (supabase as any).from("makron_units").select("*").order("order_idx").order("created_at");
    setUnits(data ?? []);
    const { data: s } = await (supabase as any).from("makron_subjects").select("*").order("order_idx").order("name");
    setSubjects(s ?? []);
    const { data: f } = await (supabase as any).from("makron_fields").select("*").order("order_idx").order("name");
    setFields(f ?? []);
  };
  const loadQuestions = async (unitId: string) => {
    const { data } = await (supabase as any).from("makron_questions").select(QUESTION_COLUMNS).eq("unit_id", unitId).order("order_idx").order("created_at");
    setQuestions(data ?? []);
  };
  const loadReports = async () => {
    const { data } = await (supabase as any).from("makron_reports")
      .select("*, question:makron_questions(id, prompt, type, options, explanation, unit_id, pack_id, image_url)")
      .order("created_at", { ascending: false }).limit(200);
    setReports(data ?? []);
  };

  const loadPacks = async () => {
    const { data } = await (supabase as any).from("makron_packs")
      .select("*, qcount:makron_questions(count)")
      .order("created_at", { ascending: false });
    setPacks(data ?? []);
  };

  useEffect(() => { loadLabels(); loadReports(); loadPacks(); }, []);
  useEffect(() => { if (selUnit) loadQuestions(selUnit); }, [selUnit]);


  if (!user) {
    return <MakronShell back="/makron/units" title="管理者画面"><div className="p-6 text-sm">ログインしてください</div></MakronShell>;
  }
  if (!isAdmin) {
    return <MakronShell back="/makron/units" title="管理者画面"><div className="p-6 text-sm text-muted-foreground">この画面は管理者のみ利用できます。</div></MakronShell>;
  }

  // ---- ラベル管理（教科 / 分野 / 単元） ----
  const addSubject = async () => {
    if (!newSubj.trim()) return;
    const { error } = await (supabase as any).from("makron_subjects").insert({ name: newSubj.trim() });
    if (error) return toast.error(error.message);
    setNewSubj(""); loadLabels();
  };
  const renameSubject = async (id: string, current: string) => {
    const name = prompt("教科の新しい名前", current);
    if (!name || name === current) return;
    const { error } = await (supabase as any).from("makron_subjects").update({ name }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("更新しました"); loadLabels();
  };
  const delSubject = async (id: string) => {
    if (!confirm("教科を削除すると関連分野も削除されます")) return;
    await (supabase as any).from("makron_subjects").delete().eq("id", id);
    if (selSubj === id) setSelSubj(null);
    loadLabels();
  };
  const addField = async () => {
    if (!newField.trim() || !selSubj) return;
    const { error } = await (supabase as any).from("makron_fields").insert({ name: newField.trim(), subject_id: selSubj });
    if (error) return toast.error(error.message);
    setNewField(""); loadLabels();
  };
  const renameField = async (id: string, current: string) => {
    const name = prompt("分野の新しい名前", current);
    if (!name || name === current) return;
    const { error } = await (supabase as any).from("makron_fields").update({ name }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("更新しました"); loadLabels();
  };
  const delField = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await (supabase as any).from("makron_fields").delete().eq("id", id);
    loadLabels();
  };
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
    toast.success("単元を作成しました"); loadLabels();
  };
  const deleteUnit = async (id: string) => {
    if (!confirm("この単元と中の問題をすべて削除しますか？")) return;
    const { error } = await (supabase as any).from("makron_units").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selUnit === id) setSelUnit(null);
    loadLabels();
  };

  // ---- 問題編集（追加はパック画面から） ----
  const uploadImage = async (file: File) => {
    const path = `q/${user?.id}/${Date.now()}-${file.name}`;
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
    const { error } = await (supabase as any).from("makron_questions").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    setDraft(null); loadQuestions(selUnit!);
    toast.success("保存しました");
  };
  const delQuestion = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await (supabase as any).from("makron_questions").delete().eq("id", id);
    loadQuestions(selUnit!);
  };

  const subjFields = fields.filter((f) => f.subject_id === selSubj);
  const visibleReports = reports.filter((r) => reportFilter === "all" || r.status === "open");

  return (
    <MakronShell back="/makron/units" title="管理者画面">
      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="labels">
          <TabsList>
            <TabsTrigger value="labels"><Tags className="h-3 w-3 mr-1" />ラベル管理</TabsTrigger>
            <TabsTrigger value="questions">問題一覧</TabsTrigger>
            <TabsTrigger value="reports"><Flag className="h-3 w-3 mr-1" />報告 ({reports.filter((r) => r.status === "open").length})</TabsTrigger>
          </TabsList>

          {/* ---------------- ラベル管理 ---------------- */}
          <TabsContent value="labels" className="space-y-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Tags className="h-3 w-3" />教科 → 分野 → 単元 の順に作成します。単元を開くとパック（問題のまとまり）を追加できます。
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 space-y-2">
                <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />教科</div>
                <div className="flex gap-1">
                  <Input placeholder="例：数学" value={newSubj} onChange={(e) => setNewSubj(e.target.value)} />
                  <Button onClick={addSubject}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1 max-h-80 overflow-auto">
                  {subjects.map((s) => (
                    <div key={s.id} className={`flex items-center gap-1 p-2 rounded cursor-pointer ${selSubj === s.id ? "bg-primary/10" : "hover:bg-accent"}`} onClick={() => setSelSubj(s.id)}>
                      <span className="flex-1 truncate">{s.name}</span>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); renameSubject(s.id, s.name); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); delSubject(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {subjects.length === 0 && <div className="text-xs text-muted-foreground">教科がまだありません</div>}
                </div>
              </Card>

              <Card className="p-4 space-y-2">
                <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />分野
                  {selSubj && <span className="text-[10px] text-muted-foreground">（{subjects.find((s) => s.id === selSubj)?.name}）</span>}
                </div>
                {!selSubj && <div className="text-xs text-muted-foreground">左から教科を選択してください</div>}
                {selSubj && (
                  <>
                    <div className="flex gap-1">
                      <Input placeholder="例：代数" value={newField} onChange={(e) => setNewField(e.target.value)} />
                      <Button onClick={addField}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="space-y-1 max-h-80 overflow-auto">
                      {subjFields.map((f) => (
                        <div key={f.id} className="flex items-center gap-1 p-2 rounded hover:bg-accent">
                          <span className="flex-1 truncate">{f.name}</span>
                          <Button size="sm" variant="ghost" onClick={() => renameField(f.id, f.name)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delField(f.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      {subjFields.length === 0 && <div className="text-xs text-muted-foreground">この教科にはまだ分野がありません</div>}
                    </div>
                  </>
                )}
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 space-y-2">
                <div className="font-bold flex items-center gap-1"><Plus className="h-4 w-4" />新しい単元</div>
                <Input placeholder="タイトル（単元名）" value={uTitle} onChange={(e) => setUTitle(e.target.value)} />
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
                <Textarea rows={2} placeholder="説明（任意）" value={uDesc} onChange={(e) => setUDesc(e.target.value)} />
                <Button onClick={createUnit} className="w-full" disabled={!uTitle.trim()}>作成</Button>
              </Card>

              <Card className="p-4 space-y-2 max-h-96 overflow-auto">
                <div className="font-bold">単元一覧</div>
                {units.map((u) => (
                  <div key={u.id} className="flex items-center gap-1 p-2 rounded hover:bg-accent">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u.title}</div>
                      <div className="text-[10px] text-muted-foreground">{[u.subject, u.field].filter(Boolean).join(" / ") || "未分類"}</div>
                    </div>
                    <Link to="/makron/unit/$unitId" params={{ unitId: u.id }}>
                      <Button size="sm" variant="outline" title="パックを管理">パック<ChevronRight className="h-3 w-3" /></Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => deleteUnit(u.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {units.length === 0 && <div className="text-xs text-muted-foreground">まだ単元がありません</div>}
              </Card>
            </div>
          </TabsContent>

          {/* ---------------- 問題一覧 ---------------- */}
          <TabsContent value="questions" className="space-y-3">
            <Card className="p-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">単元:</span>
              <Select value={selUnit ?? ""} onValueChange={(v) => setSelUnit(v)}>
                <SelectTrigger className="w-72"><SelectValue placeholder="単元を選択" /></SelectTrigger>
                <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground ml-auto">問題の追加はパック画面から行います。</span>
            </Card>

            {selUnit && (
              <Card className="p-4 space-y-3">
                <div className="font-bold">問題一覧 ({questions.length})</div>
                <div className="space-y-1 max-h-[50vh] overflow-auto">
                  {questions.length === 0 && <div className="text-xs text-muted-foreground">この単元にはまだ問題がありません</div>}
                  {questions.map((q) => (
                    <div key={q.id} className={`flex items-center gap-1 border rounded p-2 text-sm ${q.is_active === false ? "opacity-50 line-through" : ""}`}>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{q.type}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10">{q.points}点</span>
                      <span className="flex-1 min-w-0 truncate">{q.prompt}</span>
                      <Button size="sm" variant="ghost" title={q.is_active === false ? "有効化" : "停止"} onClick={async () => {
                        await (supabase as any).from("makron_questions").update({ is_active: q.is_active === false }).eq("id", q.id);
                        loadQuestions(selUnit!);
                      }}><Power className={`h-4 w-4 ${q.is_active === false ? "text-muted-foreground" : "text-success"}`} /></Button>
                      <Button size="sm" variant="ghost" onClick={async () => { try { const k = await loadQuestionKeys(q.id); setDraft({ ...q, options: q.options ?? [], ...k }); } catch (e: any) { toast.error(e.message); } }}>編集</Button>
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
                      <Button onClick={saveQuestion}><Save className="h-4 w-4 mr-1" />更新</Button>
                      <Button variant="ghost" onClick={() => setDraft(null)}>キャンセル</Button>
                    </div>
                  </Card>
                )}
              </Card>
            )}
          </TabsContent>

          {/* ---------------- 報告 ---------------- */}
          <TabsContent value="reports" className="space-y-2">
            <Card className="p-3 flex items-center gap-2">
              <span className="text-sm font-bold">表示:</span>
              <Select value={reportFilter} onValueChange={(v) => setReportFilter(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">未対応のみ</SelectItem>
                  <SelectItem value="all">すべて</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">{visibleReports.length} 件</span>
            </Card>
            {visibleReports.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">報告はありません</Card>}
            {visibleReports.map((r) => (
              <Card key={r.id} className={`p-3 ${r.status === "open" ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-600">{r.category}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ja-JP")}</span>
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setReportDetail(r)}>詳細</Button>
                    {r.status === "open" ? (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await (supabase as any).from("makron_reports").update({ status: "closed" }).eq("id", r.id); loadReports();
                      }}><FlagOff className="h-3 w-3 mr-1" />対応済みにする</Button>
                    ) : <span className="text-[10px] text-muted-foreground self-center px-2">対応済</span>}
                  </div>
                </div>
                <div className="text-sm mt-1 truncate">{r.question?.prompt ?? "(問題が削除されました)"}</div>
              </Card>
            ))}

            <Dialog open={!!reportDetail} onOpenChange={(v) => !v && setReportDetail(null)}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
                <DialogHeader><DialogTitle>報告の詳細</DialogTitle></DialogHeader>
                {reportDetail && (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-600">{reportDetail.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${reportDetail.status === "open" ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success"}`}>
                        {reportDetail.status === "open" ? "未対応" : "対応済"}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">{new Date(reportDetail.created_at).toLocaleString("ja-JP")}</span>
                    </div>

                    <Card className="p-3 space-y-1">
                      <div className="text-[11px] text-muted-foreground">対象の問題</div>
                      <div className="whitespace-pre-wrap">{reportDetail.question?.prompt ?? "(削除済み)"}</div>
                      {reportDetail.question?.image_url && <img src={reportDetail.question.image_url} alt="" className="max-h-40 border rounded" />}
                      {(reportDetail.question?.options ?? []).length > 0 && (
                        <ul className="text-xs pl-4 list-disc">
                          {reportDetail.question.options.map((o: string, i: number) => <li key={i}>{o}</li>)}
                        </ul>
                      )}
                      {reportDetail.question?.explanation && (
                        <div className="text-xs text-muted-foreground">解説: {reportDetail.question.explanation}</div>
                      )}
                      {reportDetail.question?.unit_id && (
                        <Link to="/makron/unit/$unitId" params={{ unitId: reportDetail.question.unit_id }}>
                          <Button size="sm" variant="outline" className="mt-1"><ExternalLink className="h-3 w-3 mr-1" />単元を開く</Button>
                        </Link>
                      )}
                    </Card>

                    {reportDetail.suggested_answer && (
                      <div><div className="text-[11px] text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />提案された修正</div>
                        <div className="whitespace-pre-wrap">{reportDetail.suggested_answer}</div></div>
                    )}
                    {reportDetail.note && (
                      <div><div className="text-[11px] text-muted-foreground">コメント</div>
                        <div className="whitespace-pre-wrap">{reportDetail.note}</div></div>
                    )}
                    <div className="text-[11px] text-muted-foreground">報告者ID: {reportDetail.user_id?.slice(0, 8)}…</div>

                    <div className="flex gap-2">
                      {reportDetail.question?.id && (
                        <Button size="sm" onClick={async () => {
                          try {
                            const { data } = await (supabase as any).from("makron_questions").select(QUESTION_COLUMNS).eq("id", reportDetail.question.id).maybeSingle();
                            if (!data) return toast.error("問題が見つかりません");
                            const k = await loadQuestionKeys(data.id);
                            setSelUnit(data.unit_id);
                            setDraft({ ...data, options: data.options ?? [], ...k });
                            setReportDetail(null);
                            toast.info("「問題一覧」タブで編集できます");
                          } catch (e: any) { toast.error(e.message); }
                        }}><Pencil className="h-3 w-3 mr-1" />この問題を修正</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={async () => {
                        const next = reportDetail.status === "open" ? "closed" : "open";
                        await (supabase as any).from("makron_reports").update({ status: next }).eq("id", reportDetail.id);
                        setReportDetail({ ...reportDetail, status: next }); loadReports();
                      }}><FlagOff className="h-3 w-3 mr-1" />{reportDetail.status === "open" ? "対応済みにする" : "未対応に戻す"}</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </MakronShell>
  );
}
