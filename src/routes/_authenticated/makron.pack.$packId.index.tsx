import { QUESTION_COLUMNS, loadQuestionKeys } from "@/lib/makron-questions";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Play, Plus, Save, Trash2, Settings, Image as ImageIcon, Power, BarChart3, Crown, ListChecks, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AiPackImportDialog } from "@/components/makron/AiPackImportDialog";

export const Route = createFileRoute("/_authenticated/makron/pack/$packId/")({ component: PackPage });

const TYPES = [
  { v: "single", l: "単一選択" }, { v: "multi", l: "複数選択" },
  { v: "text", l: "言葉での回答" }, { v: "written", l: "記述" },
  { v: "file", l: "ファイル提出" }, { v: "ocr", l: "手書き(OCR読み取り)" },
] as const;

function PackPage() {
  const { packId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const [pack, setPack] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [draft, setDraft] = useState<any | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [unitMeta, setUnitMeta] = useState<any>(null);

  const load = async () => {
    const { data: p } = await (supabase as any).from("makron_packs").select("*").eq("id", packId).maybeSingle();
    setPack(p);
    if (p?.unit_id) {
      const { data: u } = await (supabase as any).from("makron_units").select("id,title,subject,field,unit").eq("id", p.unit_id).maybeSingle();
      setUnitMeta(u);
    }
    const { data: qs } = await (supabase as any).from("makron_questions")
      .select(QUESTION_COLUMNS).eq("pack_id", packId).order("order_idx").order("created_at");
    setQuestions(qs ?? []);
  };
  useEffect(() => { load(); }, [packId]);

  const isOwner = pack && (pack.created_by === user?.id || isAdmin);

  const startSession = async () => {
    const { data, error } = await (supabase as any).rpc("makron_start_pack_session", { _pack_id: packId });
    if (error) return toast.error(error.message);
    nav({ to: "/makron/session/$sessionId", params: { sessionId: data } });
  };

  const saveSettings = async (patch: any) => {
    const { error } = await (supabase as any).from("makron_packs").update(patch).eq("id", packId);
    if (error) return toast.error(error.message);
    setPack({ ...pack, ...patch });
  };

  const blank = () => ({
    pack_id: packId, unit_id: pack?.unit_id, prompt: "", image_url: "", type: "single",
    options: ["", "", "", ""], correct_options: [], accepted_answers: [],
    model_answer: "", explanation: "", hint_text: "", is_active: true, points: 10, grading: "auto", order_idx: 100,
  });

  const uploadImage = async (file: File) => {
    const path = `q/${user?.id}/${packId}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("makron-files").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("makron-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    setDraft((d: any) => ({ ...d, image_url: data?.signedUrl ?? path }));
  };

  const saveQuestion = async () => {
    if (!draft || !draft.prompt.trim()) return toast.error("問題文を入力してください");
    const { id, created_at, updated_at, status, created_by, submitted_at, reviewed_at, reviewed_by, ...rest } = draft;
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
    setDraft(null); load();
    toast.success("保存しました");
  };

  const delQuestion = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await (supabase as any).from("makron_questions").delete().eq("id", id);
    load();
  };

  if (!pack) return <MakronShell back="/makron/units"><div className="p-8 text-muted-foreground">読み込み中…</div></MakronShell>;

  return (
    <MakronShell back="/makron/units" title={pack.title} subtitle={[pack.grade, unitMeta?.title].filter(Boolean).join(" / ") || undefined}>
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Card className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="font-bold text-lg flex items-center gap-2">{pack.title}</div>
            {pack.description && <div className="text-xs text-muted-foreground mt-0.5">{pack.description}</div>}
            <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
              <span><ListChecks className="h-3 w-3 inline mr-0.5" />{questions.length}問</span>
              {pack.grade && <span>{pack.grade}</span>}
              {pack.shuffle && <span>シャッフル</span>}
              {pack.question_limit && <span>{pack.question_limit}問出題</span>}
              {pack.max_attempts && <span>最大{pack.max_attempts}回</span>}
            </div>
          </div>
          <Button onClick={startSession} disabled={questions.length === 0}><Play className="h-4 w-4 mr-1" />演習開始</Button>
          {isOwner && (
            <Link to="/makron/pack/$packId/dashboard" params={{ packId }}>
              <Button variant="outline"><BarChart3 className="h-4 w-4 mr-1" />ダッシュボード</Button>
            </Link>
          )}

          {isOwner && (
            <Button variant="ghost" className="text-destructive" onClick={async () => {
              if (!confirm(`「${pack.title}」を完全に削除します。問題・履歴・回答もすべて消えます。よろしいですか？`)) return;
              const { error } = await (supabase as any).rpc("delete_makron_pack", { _pack_id: packId });
              if (error) return toast.error(error.message);
              toast.success("削除しました");
              nav({ to: "/makron" });
            }}><Trash2 className="h-4 w-4 mr-1" />パック削除</Button>
          )}
        </Card>

        {isOwner ? (
          <Tabs defaultValue="questions">
            <TabsList>
              <TabsTrigger value="questions">問題管理</TabsTrigger>
              <TabsTrigger value="settings"><Settings className="h-3 w-3 mr-1" />パック設定</TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="font-bold">問題一覧 ({questions.length})</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4 mr-1" />AI で一括追加</Button>
                  <Button size="sm" onClick={() => setDraft(blank())}><Plus className="h-4 w-4 mr-1" />問題を追加</Button>
                </div>
              </div>
              <div className="space-y-1 max-h-96 overflow-auto">
                {questions.map((q) => (
                  <div key={q.id} className={`flex items-center gap-1 border rounded p-2 text-sm ${q.is_active === false ? "opacity-50" : ""}`}>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{q.type}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10">{q.points}点</span>
                    <span className="flex-1 min-w-0 truncate">{q.prompt}</span>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await (supabase as any).from("makron_questions").update({ is_active: q.is_active === false }).eq("id", q.id);
                      load();
                    }}><Power className={`h-4 w-4 ${q.is_active === false ? "text-muted-foreground" : "text-success"}`} /></Button>
                    <Button size="sm" variant="ghost" onClick={async () => { try { const k = await loadQuestionKeys(q.id); setDraft({ ...q, options: q.options ?? [], ...k }); } catch (e: any) { toast.error(e.message); } }}>編集</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {questions.length === 0 && <div className="text-xs text-muted-foreground text-center p-6">問題はまだありません。上の「問題を追加」から作成してください。</div>}
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
                          <SelectItem value="auto" disabled={!["single","multi","text","ocr"].includes(draft.type)}>自動</SelectItem>
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
                  {(draft.type === "text" || draft.type === "ocr") && (
                    <div>
                      <label className="text-xs">正答（複数可、1行1つ。大文字小文字・前後空白は無視）{draft.type === "ocr" && " ※OCRで読み取った文字と照合します"}</label>
                      <Textarea rows={3} value={(draft.accepted_answers ?? []).join("\n")} onChange={(e) => setDraft({ ...draft, accepted_answers: e.target.value.split("\n") })} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs">模範解答（任意）</label>
                    <Textarea rows={2} value={draft.model_answer ?? ""} onChange={(e) => setDraft({ ...draft, model_answer: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs">解説（任意）</label>
                    <Textarea rows={2} value={draft.explanation ?? ""} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs">ヒント（任意。AIは使わず作成者が手書きで記入）</label>
                    <Textarea rows={2} value={draft.hint_text ?? ""} onChange={(e) => setDraft({ ...draft, hint_text: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={draft.is_active !== false} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                    この問題を有効にする
                  </label>
                  <div className="flex gap-2">
                    <Button onClick={saveQuestion}><Save className="h-4 w-4 mr-1" />{draft.id ? "更新" : "作成"}</Button>
                    <Button variant="ghost" onClick={() => setDraft(null)}>キャンセル</Button>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-3 mt-3">
              <Card className="p-4 space-y-3">
                <div className="font-bold">演習設定</div>
                <div><label className="text-xs">タイトル</label>
                  <Input value={pack.title ?? ""} onChange={(e) => setPack({ ...pack, title: e.target.value })} onBlur={() => saveSettings({ title: pack.title })} />
                </div>
                <div><label className="text-xs">説明</label>
                  <Textarea rows={2} value={pack.description ?? ""} onChange={(e) => setPack({ ...pack, description: e.target.value })} onBlur={() => saveSettings({ description: pack.description })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!pack.shuffle} onCheckedChange={(v) => saveSettings({ shuffle: v })} />
                  問題をシャッフルして出題
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!pack.skip_preview} onCheckedChange={(v) => saveSettings({ skip_preview: v })} />
                  演習開始前のプレビューを表示しない
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!pack.per_question_grading} onCheckedChange={(v) => saveSettings({ per_question_grading: v })} />
                  一問ごと採点モード（回答するとその場で正誤表示、前後移動と後回し不可）
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">出題数（空欄 = 全問）</label>
                    <Input type="number" min={0} value={pack.question_limit ?? ""} onChange={(e) => setPack({ ...pack, question_limit: e.target.value ? Number(e.target.value) : null })} onBlur={() => saveSettings({ question_limit: pack.question_limit })} />
                  </div>
                  <div>
                    <label className="text-xs">最大演習回数（空欄 = 無制限）</label>
                    <Input type="number" min={0} value={pack.max_attempts ?? ""} onChange={(e) => setPack({ ...pack, max_attempts: e.target.value ? Number(e.target.value) : null })} onBlur={() => saveSettings({ max_attempts: pack.max_attempts })} />
                  </div>
                  <div>
                    <label className="text-xs">合格点（空欄 = 合否なし）</label>
                    <Input type="number" min={0} value={pack.pass_score ?? ""} onChange={(e) => setPack({ ...pack, pass_score: e.target.value ? Number(e.target.value) : null })} onBlur={() => saveSettings({ pass_score: pack.pass_score })} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={pack.allow_all_mode !== false} onCheckedChange={(v) => saveSettings({ allow_all_mode: v })} />
                  出題数を設定していても「全問演習モード」を許可
                </label>
              </Card>

              {isAdmin && (
                <Card className="p-4 space-y-3 border-amber-500/40">
                  <div className="font-bold flex items-center gap-1"><Crown className="h-4 w-4 text-amber-500" />報酬設定（管理者のみ）</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs">1問あたりXP</label>
                      <Input type="number" min={0} value={pack.xp_per_question ?? 10} onChange={(e) => setPack({ ...pack, xp_per_question: Number(e.target.value) })} onBlur={() => saveSettings({ xp_per_question: pack.xp_per_question })} />
                    </div>
                    <div>
                      <label className="text-xs">1問あたりコイン</label>
                      <Input type="number" min={0} value={pack.coin_per_question ?? 1} onChange={(e) => setPack({ ...pack, coin_per_question: Number(e.target.value) })} onBlur={() => saveSettings({ coin_per_question: pack.coin_per_question })} />
                    </div>
                    <div>
                      <label className="text-xs">1人あたりXP上限（空欄 = 無制限）</label>
                      <Input type="number" value={pack.xp_cap_per_user ?? ""} onChange={(e) => setPack({ ...pack, xp_cap_per_user: e.target.value ? Number(e.target.value) : null })} onBlur={() => saveSettings({ xp_cap_per_user: pack.xp_cap_per_user })} />
                    </div>
                    <div>
                      <label className="text-xs">1人あたりコイン上限（空欄 = 無制限）</label>
                      <Input type="number" value={pack.coin_cap_per_user ?? ""} onChange={(e) => setPack({ ...pack, coin_cap_per_user: e.target.value ? Number(e.target.value) : null })} onBlur={() => saveSettings({ coin_cap_per_user: pack.coin_cap_per_user })} />
                    </div>
                    <div>
                      <label className="text-xs">報酬付与回数上限（空欄 = 無制限）</label>
                      <Input type="number" value={pack.reward_attempts_cap ?? ""} onChange={(e) => setPack({ ...pack, reward_attempts_cap: e.target.value ? Number(e.target.value) : null })} onBlur={() => saveSettings({ reward_attempts_cap: pack.reward_attempts_cap })} />
                    </div>
                  </div>


                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="p-6 text-sm text-muted-foreground text-center">問題内容は演習開始から確認できます。</Card>
        )}
      </div>
      <AiPackImportDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        mode="add"
        packId={packId}
        unit={unitMeta ? { id: unitMeta.id, title: unitMeta.title, subject: unitMeta.subject, field: unitMeta.field, unit: unitMeta.unit } : (pack ? { id: pack.unit_id } : null)}
        onDone={load}
      />
    </MakronShell>
  );
}