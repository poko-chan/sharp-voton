import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Paperclip, Loader2, X, Trash2, Plus, MessageSquare, Pencil, ChevronDown, Brain, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getStudyContext, listTutorThreads, createTutorThread, renameTutorThread, deleteTutorThread,
} from "@/lib/tutor.functions";
import { isAiUsable, createAiSession } from "@/lib/ai-provider";
import { AiUnavailable } from "@/components/AiUnavailable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Attachment = { url: string; name: string; type: string };
type ThinkingStep = { label: string; detail?: string; done: boolean };
type Msg = { id: string; role: string; content: string; attachments: Attachment[]; created_at: string; thread_id: string | null; thinking?: ThinkingStep[] };
type Thread = { id: string; title: string; updated_at: string; created_at: string };

const TOOL_MARKER = "TOOL: get_study_context";
const NO_TOOL_MARKER = "TOOL: none";

/** AIに見せてよい情報の種類 */
const SCOPE_DEFS = [
  { key: "study", label: "学習時間・科目", desc: "直近30日の勉強時間と科目別の内訳" },
  { key: "goals", label: "学習目標", desc: "進行中の目標と達成度" },
  { key: "weak", label: "苦手トピック", desc: "間違いの多い単元" },
  { key: "notes", label: "学習メモ", desc: "直近の勉強記録の内容" },
  { key: "exams", label: "試験・タスク", desc: "近い試験の予定とやること" },
  { key: "flashcards", label: "暗記カード", desc: "間違えやすいカード" },
  { key: "markon", label: "Markon成績", desc: "演習パックの得点履歴" },
] as const;
type ScopeKey = (typeof SCOPE_DEFS)[number]["key"];
const SCOPES_LS = "ai.tutor.scopes";

function loadScopes(): ScopeKey[] {
  if (typeof window === "undefined") return SCOPE_DEFS.map((s) => s.key);
  try {
    const raw = window.localStorage.getItem(SCOPES_LS);
    if (!raw) return SCOPE_DEFS.map((s) => s.key);
    const arr = JSON.parse(raw) as string[];
    return SCOPE_DEFS.map((s) => s.key).filter((k) => arr.includes(k));
  } catch { return SCOPE_DEFS.map((s) => s.key); }
}

const detectSystem = () =>
  `あなたはAIチャットのアシスタントです。次のツールが使えます。

- get_study_context: ユーザーの学習時間・登録科目・進行中の目標・苦手トピック・試験予定・暗記カード・演習成績などの学習データを取得します。

ユーザーの直近の発言が、学習状況（勉強時間、進捗、苦手分野、目標の達成度、試験対策など）に関する質問や、それを踏まえたアドバイスを求めるものであれば、説明を一切せず1行だけ次を出力してください:
${TOOL_MARKER}

そうでなければ、説明を一切せず1行だけ次を出力してください:
${NO_TOOL_MARKER}

他の文章は絶対に出力しないでください。`;

const answerSystem = (displayName: string, ctx: any | null) =>
  `あなたは${displayName}さん専属の優しいAIチャットアシスタントです。日本語で答え、まずヒントを与え段階的に解説してください。マークダウンを使い、画像が添付されていればその内容を読み取り解説します。
${
  ctx
    ? `
【生徒の学習状況（直近30日・ツールで取得済み）】
${ctx.totalMinutes30d !== null ? `- 学習時間: ${ctx.totalMinutes30d ?? 0}分 / 活動日: ${ctx.activeDays30d ?? 0}日
- 登録科目: ${(ctx.subjectsRegistered ?? []).join("、") || "なし"}
- よく勉強: ${(ctx.topSubjects ?? []).map((s: any) => `${s.name}(${s.minutes}分)`).join("、") || "—"}` : ""}
${(ctx.weakTopics ?? []).length ? `- 苦手トピック: ${ctx.weakTopics.map((w: any) => `${w.topic}(${w.wrong}/${w.total}誤)`).join("、")}` : ""}
${(ctx.activeGoals ?? []).length ? `- 進行中の目標: ${ctx.activeGoals.map((g: any) => `${g.title}(${g.progress_minutes}/${g.target_minutes}分)`).join("、")}` : ""}
${(ctx.upcomingExams ?? []).length ? `- 近い試験: ${ctx.upcomingExams.map((e: any) => `${e.title}(${e.date ?? "日付未定"})`).join("、")}` : ""}
${(ctx.examTodos ?? []).length ? `- 試験に向けた未完了タスク: ${ctx.examTodos.join("、")}` : ""}
${(ctx.hardCards ?? []).length ? `- 苦手な暗記カード: ${ctx.hardCards.map((c: any) => `${c.front}(誤${c.wrong})`).join("、")}` : ""}
${(ctx.markonRecent ?? []).length ? `- Markon直近の成績: ${ctx.markonRecent.map((m: any) => `${m.score}/${m.total}`).join("、")}` : ""}
${ctx.recentNotes ? `- 直近の学習メモ:\n${ctx.recentNotes}` : ""}

これらを踏まえ、生徒の弱点に寄り添ったアドバイスをしてください。`
    : ""
}`;


function TutorPage() {
  const { user } = useAuth();
  const listFn = useServerFn(listTutorThreads);
  const createFn = useServerFn(createTutorThread);
  const renameFn = useServerFn(renameTutorThread);
  const deleteFn = useServerFn(deleteTutorThread);
  const ctxFn = useServerFn(getStudyContext);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [canAi, setCanAi] = useState<boolean>(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [showThinking, setShowThinking] = useState(true);
  useEffect(() => { isAiUsable().then(setCanAi); }, []);

  const addStep = (label: string) => setThinkingSteps((prev) => [...prev, { label, done: false }]);
  const finishLastStep = () => setThinkingSteps((prev) => prev.map((s, i) => (i === prev.length - 1 ? { ...s, done: true } : s)));

  const loadThreads = useCallback(async () => {
    try {
      const data = (await listFn()) as Thread[];
      setThreads(data);
      if (!activeId && data.length > 0) setActiveId(data[0].id);
    } catch (e: any) { toast.error(e.message); }
  }, [listFn, activeId]);

  const loadMsgs = useCallback(async (tid: string | null) => {
    if (!user || !tid) { setMsgs([]); return; }
    const { data } = await supabase
      .from("tutor_messages").select("*")
      .eq("user_id", user.id).eq("thread_id", tid)
      .order("created_at");
    setMsgs((data as any) ?? []);
  }, [user]);

  useEffect(() => { loadThreads(); }, [user]);
  useEffect(() => { loadMsgs(activeId); }, [activeId, loadMsgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, streaming]);

  const newChat = async () => {
    try {
      const row = (await createFn({ data: {} })) as Thread;
      setThreads((t) => [row, ...t]);
      setActiveId(row.id);
      setMsgs([]);
    } catch (e: any) { toast.error(e.message); }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    setUploading(true);
    try {
      const ups: Attachment[] = [];
      for (const file of Array.from(e.target.files)) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("tutor-files").upload(path, file);
        if (error) throw error;
        const { signedUrl } = await import("@/lib/storage-url");
        const url = await signedUrl("tutor-files", path);
        ups.push({ url, name: file.name, type: file.type });
      }
      setPending((p) => [...p, ...ups]);
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const send = async () => {
    if (!user || (!input.trim() && pending.length === 0) || busy) return;
    setBusy(true);
    setThinkingSteps([]);
    try {
      // 必要ならスレッド作成
      let tid = activeId;
      let isNew = false;
      if (!tid) {
        const title = (input.trim() || "新しいチャット").slice(0, 40);
        const row = (await createFn({ data: { title } })) as Thread;
        tid = row.id;
        isNew = true;
        setThreads((t) => [row, ...t]);
        setActiveId(tid);
      }

      const userMsg = { user_id: user.id, role: "user", content: input.trim(), attachments: pending, thread_id: tid };
      const { data: ins } = await supabase.from("tutor_messages").insert(userMsg).select().single();
      const insMsg = ins as unknown as Msg;
      const nextMsgs = ins ? [...msgs, insMsg] : msgs;
      if (ins) setMsgs(nextMsgs);
      setInput(""); setPending([]);

      const displayName = user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "生徒";

      // 会話履歴をテキストに変換（画像は URL を会話に含めて参照させる）
      const history = nextMsgs.map((m) => {
        const imgs = (m.attachments ?? []).filter((a) => a.type.startsWith("image/"));
        const imgNote = imgs.length ? `\n[添付画像: ${imgs.map((a) => a.name).join(", ")}]` : "";
        return `${m.role === "user" ? "ユーザー" : "アシスタント"}: ${m.content}${imgNote}`;
      }).join("\n\n");

      // 1) ツールが必要かどうかをモデルに判断させる（テキストプロトコル）
      addStep("質問を確認しています…");
      let ctx: any = null;
      const detectSession = await createAiSession({ system: detectSystem() });
      let decision = "";
      try {
        decision = await detectSession.prompt(history + "\n\nアシスタント:");
      } finally { detectSession.destroy(); }
      finishLastStep();

      if (decision.trim().toUpperCase().startsWith(TOOL_MARKER.toUpperCase())) {
        addStep("学習データを取得しています…");
        try { ctx = await ctxFn(); } catch { /* ツール失敗時はデータなしで続行 */ }
        finishLastStep();
      }

      // 2) 最終回答をストリーミング生成
      addStep("回答を組み立てています…");
      const answerSession = await createAiSession({ system: answerSystem(displayName, ctx) });
      let text = "";
      setStreaming("");
      try {
        text = await answerSession.promptStreaming(history + "\n\nアシスタント:", (partial) => setStreaming(partial));
      } finally { answerSession.destroy(); }
      finishLastStep();

      await supabase.from("tutor_messages").insert({
        user_id: user.id, role: "assistant", content: text, attachments: [], thread_id: tid,
      });
      // タイトルを最初のメッセージから自動生成（新規チャットのみ）
      if (isNew && userMsg.content) {
        const auto = userMsg.content.slice(0, 30);
        await renameFn({ data: { id: tid, title: auto } });
      }
      await loadMsgs(tid);
      await loadThreads();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); setStreaming(""); setThinkingSteps([]); }
  };

  const submitRename = async (id: string) => {
    if (!renameTitle.trim()) { setRenamingId(null); return; }
    try {
      await renameFn({ data: { id, title: renameTitle.trim() } });
      setThreads((t) => t.map((x) => (x.id === id ? { ...x, title: renameTitle.trim() } : x)));
    } catch (e: any) { toast.error(e.message); }
    finally { setRenamingId(null); }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFn({ data: { id: deleteTarget.id } });
      setThreads((t) => t.filter((x) => x.id !== deleteTarget.id));
      if (activeId === deleteTarget.id) {
        setActiveId(null); setMsgs([]);
      }
      toast.success("チャットを削除しました");
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-primary" /> AIチャット</h1>
          <p className="text-sm text-muted-foreground">新しいチャットごとに会話が保存されます</p>
        </div>
      </div>
      {!canAi && <div className="mb-3"><AiUnavailable feature="AIチャット" /></div>}

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 h-[calc(100vh-10rem)]">
        {/* スレッドサイドバー */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-2 border-b">
            <Button onClick={newChat} className="w-full" size="sm"><Plus className="h-4 w-4 mr-1" /> 新しいチャット</Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {threads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">まだチャットがありません</p>}
            {threads.map((t) => (
              <div
                key={t.id}
                className={`group rounded-lg px-2 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                  activeId === t.id ? "bg-primary/15 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveId(t.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                {renamingId === t.id ? (
                  <Input
                    autoFocus
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onBlur={() => submitRename(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(t.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="h-6 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate">{t.title}</span>
                )}
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded"
                  onClick={(e) => { e.stopPropagation(); setRenamingId(t.id); setRenameTitle(t.title); }}
                  title="名前変更"
                ><Pencil className="h-3 w-3" /></button>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 text-destructive rounded"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                  title="削除"
                ><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </Card>

        {/* チャット本体 */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!activeId && msgs.length === 0 && (
              <div className="h-full grid place-items-center text-center text-muted-foreground">
                <div>
                  <Sparkles className="h-10 w-10 mx-auto mb-2 text-primary/50" />
                  <p className="text-sm">質問を入力すると新しいチャットが始まります</p>
                </div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 prose prose-sm dark:prose-invert ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {(m.attachments ?? []).map((a, i) => (
                    a.type.startsWith("image/")
                      ? <img key={i} src={a.url} alt={a.name} className="max-h-48 rounded mb-1" />
                      : <a key={i} href={a.url} target="_blank" className="text-xs underline">{a.name}</a>
                  ))}
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-muted rounded-2xl px-4 py-2 space-y-2">
                  {thinkingSteps.length > 0 && (
                    <Collapsible open={showThinking} onOpenChange={setShowThinking}>
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
                        <Brain className="h-3.5 w-3.5" />
                        <span>思考プロセス</span>
                        <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showThinking ? "rotate-180" : ""}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 space-y-1 border-l-2 border-primary/30 pl-2">
                        {thinkingSteps.map((step, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {step.done ? (
                              <Search className="h-3 w-3 text-primary" />
                            ) : (
                              <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            )}
                            <span>{step.label}</span>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  <div className="prose prose-sm dark:prose-invert">
                    {streaming ? (
                      <>
                        <ReactMarkdown>{streaming}</ReactMarkdown>
                        <span className="inline-block w-2 h-4 align-middle bg-primary/70 animate-pulse rounded-sm" />
                      </>
                    ) : (
                      thinkingSteps.length === 0 && <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {pending.length > 0 && (
            <div className="border-t p-2 flex flex-wrap gap-2">
              {pending.map((a, i) => (
                <div key={i} className="relative">
                  {a.type.startsWith("image/")
                    ? <img src={a.url} className="h-16 w-16 object-cover rounded" />
                    : <div className="h-16 px-2 grid place-items-center bg-muted rounded text-xs">{a.name}</div>}
                  <button onClick={() => setPending(pending.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}

          <form className="border-t p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input type="file" ref={fileRef} className="hidden" multiple accept="image/*,.pdf" onChange={onUpload} />
            <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Textarea
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="例: この問題の解き方を教えて"
              className="min-h-[44px] max-h-32 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            />
            <Button type="submit" disabled={busy || !canAi}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </form>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>チャットを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title ?? ""}」とそのメッセージをすべて削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >削除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/tutor")({ component: TutorPage });
