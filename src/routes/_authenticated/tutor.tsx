import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Paperclip, Loader2, X, Trash2, Plus, MessageSquare, Pencil, ChevronDown, Brain, Search, ShieldCheck, Database, RotateCcw, BookOpen, Target, CalendarDays, NotebookTabs, ChartNoAxesColumnIncreasing } from "lucide-react";
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
import { AiStatusBadge } from "@/components/ChromeAiStatusBadge";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AiActionCard } from "@/components/ai/AiActionCard";
import { detectAiAction, applyAiAction, fetchSubjectNames, looksLikeActionRequest, parseCommonActionRequest, type AiAction } from "@/lib/ai-actions";
import { Switch } from "@/components/ui/switch";


type Attachment = { url: string; name: string; type: string };
type ThinkingStep = { label: string; detail?: string; done: boolean };
type Msg = { id: string; role: string; content: string; attachments: Attachment[]; created_at: string; thread_id: string | null; thinking?: ThinkingStep[] };
type Thread = { id: string; title: string; updated_at: string; created_at: string };

/** AIに見せてよい情報の種類 */
const SCOPE_DEFS = [
  { key: "study", label: "学習時間と教科", desc: "直近30日の学習時間、活動日数、よく勉強した教科", icon: ChartNoAxesColumnIncreasing },
  { key: "goals", label: "学習目標", desc: "進行中の目標、目標時間、現在の進み具合", icon: Target },
  { key: "weak", label: "苦手な内容", desc: "間違いが多い単元やトピック", icon: Brain },
  { key: "notes", label: "学習記録の内容", desc: "最近勉強した内容や自分で残したメモ", icon: NotebookTabs },
  { key: "exams", label: "試験とやること", desc: "これからの試験日程と未完了タスク", icon: CalendarDays },
  { key: "flashcards", label: "暗記カード", desc: "復習回数や忘れやすいカード", icon: BookOpen },
  { key: "markon", label: "Markon演習", desc: "最近取り組んだパックと挑戦回数", icon: Database },
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

function relevantScopes(text: string, allowed: ScopeKey[]): ScopeKey[] {
  const rules: Record<ScopeKey, RegExp> = {
    study: /(勉強時間|学習時間|勉強量|学習状況|最近|科目|教科|頑張|進捗|振り返)/,
    goals: /(目標|ゴール|達成|進捗|計画|プラン)/,
    weak: /(苦手|弱点|間違|ミス|復習|伸ば)/,
    notes: /(学習記録|勉強記録|メモ|最近|振り返)/,
    exams: /(試験|テスト|受験|課題|タスク|予定|期限|勉強計画)/,
    flashcards: /(暗記|カード|覚え|単語|復習)/,
    markon: /(Markon|マクロン|演習|パック|正答|成績)/i,
  };
  const personal = /(私|自分|ぼく|僕|わたし|おすすめ|何をすべき|どう勉強|アドバイス)/.test(text);
  return allowed.filter((key) => rules[key].test(text) || (personal && ["study", "goals", "weak"].includes(key)));
}

const QUICK_PROMPTS = ["今日の勉強計画を考えて", "最近の学習から苦手を教えて", "この問題の考え方を教えて", "今日、数学を30分勉強したので記録して"];

const answerSystem = (displayName: string, ctx: any | null) =>
  `あなたは${displayName}さん専属の優しい学習アシスタントです。

【回答のルール】
- 日本語で、結論 → 理由・考え方の順に簡潔に書く。前置きや自己紹介はしない。
- 手順が必要なときは番号付きリスト、比較は箇条書き、数式は必要最小限で。
- 長さは目安300〜600字。冗長な繰り返しや同じ内容の言い換えをしない。
- わからないことは推測せず「情報が足りない」と伝え、確認したい点を1つだけ質問する。
- 答えを丸写しさせず、まずヒント → 次に考え方 → 最後に答え合わせの流れにする。
- 画像が添付されていれば、その内容を読み取って解説する。
- マークダウンの見出し(#)は使わず、太字・リストで整理する。
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
${(ctx.hardCards ?? []).length ? `- 苦手な暗記カード: ${ctx.hardCards.map((c: any) => `${c.front}(復習${c.reviews}回)`).join("、")}` : ""}
${(ctx.markonRecent ?? []).length ? `- Markon直近の演習: ${ctx.markonRecent.map((m: any) => `${m.pack}(${m.attempts}回挑戦)`).join("、")}` : ""}
${ctx.recentNotes ? `- 直近の学習メモ:\n${ctx.recentNotes}` : ""}

これらを踏まえ、生徒の弱点に寄り添った具体的なアドバイスをしてください。`
    : ""
}`;



/** 思考プロセス（生成後も残る詳細ログ） */
function ThinkingBlock({
  steps, defaultOpen = false, onOpenChange, live = false,
}: {
  steps: ThinkingStep[];
  defaultOpen?: boolean;
  onOpenChange?: (v: boolean) => void;
  live?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (live) setOpen(defaultOpen); }, [defaultOpen, live]);
  return (
    <Collapsible
      open={open}
      onOpenChange={(v) => { setOpen(v); onOpenChange?.(v); }}
      className="not-prose mb-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5"
    >
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span>思考プロセス（{steps.length}ステップ）</span>
        <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 space-y-1.5 border-l-2 border-primary/30 pl-2">
        {steps.map((step, i) => (
          <div key={i} className="text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              {step.done ? <Search className="h-3 w-3 text-primary" /> : <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              <span>{step.label}</span>
            </div>
            {step.detail && <div className="pl-4.5 ml-1 text-muted-foreground whitespace-pre-wrap">{step.detail}</div>}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

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
  const [scopes, setScopes] = useState<ScopeKey[]>(() => loadScopes());
  const [engineLabel, setEngineLabel] = useState<string>("");
  const [proposedAction, setProposedAction] = useState<AiAction | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const stepsRef = useRef<ThinkingStep[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => { isAiUsable().then(setCanAi); }, []);
  useEffect(() => {
    import("@/lib/ai-provider").then(({ resolveAiTarget }) =>
      resolveAiTarget().then((t) => setEngineLabel(t.engine === "none" ? "" : `${t.modelLabel}`)),
    );
  }, [canAi]);

  const toggleScope = (k: ScopeKey) => {
    setScopes((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      try { window.localStorage.setItem(SCOPES_LS, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const syncSteps = () => setThinkingSteps([...stepsRef.current]);
  const addStep = (label: string, detail?: string) => {
    stepsRef.current = [...stepsRef.current, { label, detail, done: false }];
    syncSteps();
  };
  const finishLastStep = (detail?: string) => {
    stepsRef.current = stepsRef.current.map((s, i) =>
      i === stepsRef.current.length - 1 ? { ...s, done: true, detail: detail ?? s.detail } : s,
    );
    syncSteps();
  };


  const loadThreads = useCallback(async () => {
    try {
      const data = (await listFn()) as Thread[];
      setThreads(data);
      if (!activeId && data.length > 0) setActiveId(data[0].id);
    } catch (e: any) { toast.error(e.message); }
  }, [listFn, activeId]);

  const loadMsgs = useCallback(async (tid: string | null) => {
    if (!user || !tid) { setMsgs([]); return; }
    setMessageLoading(true);
    const { data, error } = await supabase
      .from("tutor_messages").select("*")
      .eq("user_id", user.id).eq("thread_id", tid)
      .order("created_at");
    if (activeIdRef.current === tid) {
      if (error) setFlowError("会話履歴を読み込めませんでした。もう一度お試しください。");
      else setMsgs((data as any) ?? []);
      setMessageLoading(false);
    }
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
    const runId = ++runIdRef.current;
    const originalInput = input;
    const originalPending = [...pending];
    setBusy(true);
    setFlowError(null);
    stepsRef.current = [];
    setThinkingSteps([]);
    setShowThinking(true);
    setProposedAction(null);

    const t0 = Date.now();
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

      const userMsg = { user_id: user.id, role: "user", content: originalInput.trim(), attachments: originalPending, thread_id: tid };
      const { data: ins, error: insertError } = await supabase.from("tutor_messages").insert(userMsg).select().single();
      if (insertError || !ins) throw new Error("メッセージを保存できませんでした。入力内容はそのまま残しています。");
      const insMsg = ins as unknown as Msg;
      const nextMsgs = [...msgs, insMsg];
      if (activeIdRef.current === tid) setMsgs(nextMsgs);
      setInput(""); setPending([]);

      if (looksLikeActionRequest(userMsg.content)) {
        addStep("登録内容を確認しています", "内容を確認したあと、許可した場合だけ保存します。");
        const subs = await fetchSubjectNames(user.id);
        let action = parseCommonActionRequest(userMsg.content, subs.map((s) => s.name));
        if (!action) action = await detectAiAction(userMsg.content, subs.map((s) => s.name));
        finishLastStep(action ? "確認カードを作成しました" : "登録に必要な情報が足りませんでした");
        if (runId === runIdRef.current && activeIdRef.current === tid) {
          setProposedAction(action);
          if (!action) setFlowError("登録内容を読み取れませんでした。日付・教科・時間を含めて、もう一度入力してください。");
        }
        return;
      }

      const displayName = user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "生徒";

      // 会話履歴をテキストに変換（画像は URL を会話に含めて参照させる）
      const history = nextMsgs.map((m) => {
        const imgs = (m.attachments ?? []).filter((a) => a.type.startsWith("image/"));
        const imgNote = imgs.length ? `\n[添付画像: ${imgs.map((a) => a.name).join(", ")}]` : "";
        return `${m.role === "user" ? "ユーザー" : "アシスタント"}: ${m.content}${imgNote}`;
      }).join("\n\n");

      addStep(
        "使用するAIを決めています",
        `${engineLabel || "端末内AI"} を使用します。参照を許可した情報: ${
          scopes.length ? scopes.map((k) => SCOPE_DEFS.find((s) => s.key === k)?.label).join("、") : "なし"
        }`,
      );
      finishLastStep();

      let ctx: any = null;
      const requestedScopes = relevantScopes(userMsg.content, scopes);
      const needsCtx = requestedScopes.length > 0;

      if (needsCtx) {
        addStep("学習情報を確認しています", requestedScopes.map((k) => SCOPE_DEFS.find((s) => s.key === k)?.label).join("、"));
        try { ctx = await ctxFn({ data: { scopes: requestedScopes } }); } catch { setFlowError("一部の学習情報を取得できなかったため、会話内容だけで回答します。"); }
        finishLastStep(
          ctx
            ? [
                ctx.totalMinutes30d !== null ? `学習時間 ${ctx.totalMinutes30d}分 / ${ctx.activeDays30d}日` : null,
                (ctx.activeGoals ?? []).length ? `目標 ${ctx.activeGoals.length}件` : null,
                (ctx.weakTopics ?? []).length ? `苦手 ${ctx.weakTopics.length}件` : null,
                (ctx.upcomingExams ?? []).length ? `試験 ${ctx.upcomingExams.length}件` : null,
                (ctx.hardCards ?? []).length ? `苦手カード ${ctx.hardCards.length}件` : null,
                (ctx.markonRecent ?? []).length ? `Markon成績 ${ctx.markonRecent.length}件` : null,
              ].filter(Boolean).join(" / ") || "参照できるデータはありませんでした"
            : "取得に失敗したため、会話だけで回答します",
        );
      }

      // 2) 最終回答をストリーミング生成
      addStep("回答を組み立てています", "取得した情報とこれまでの会話をもとに、段階的な説明を作成中です。");
      const answerSession = await createAiSession({ system: answerSystem(displayName, ctx) });
      let text = "";
      setStreaming("");
      try {
        text = await answerSession.promptStreaming(history + "\n\nアシスタント:", (partial) => {
          if (runId === runIdRef.current && activeIdRef.current === tid) setStreaming(partial);
        });
      } finally { answerSession.destroy(); }
      if (!text.trim()) throw new Error("AIから回答を受け取れませんでした。もう一度お試しください。");
      finishLastStep(`${text.length}文字を生成しました（所要 ${Math.round((Date.now() - t0) / 1000)}秒）`);

      const { error: answerSaveError } = await supabase.from("tutor_messages").insert({
        user_id: user.id, role: "assistant", content: text, attachments: [], thread_id: tid,
        thinking: stepsRef.current as any,
      } as any);
      if (answerSaveError) throw new Error("回答は生成できましたが、会話履歴に保存できませんでした。");
      // タイトルを最初のメッセージから自動生成（新規チャットのみ）
      if (isNew && userMsg.content) {
        const auto = userMsg.content.slice(0, 30);
        await renameFn({ data: { id: tid, title: auto } });
      }
      if (activeIdRef.current === tid) await loadMsgs(tid);
      await loadThreads();

    } catch (e: any) {
      const message = e?.message || "回答を生成できませんでした。";
      setFlowError(message);
      if (!input && originalInput) setInput(originalInput);
      if (pending.length === 0 && originalPending.length) setPending(originalPending);
      toast.error(message);
    } finally {
      if (runId === runIdRef.current) {
        setBusy(false); setStreaming(""); stepsRef.current = []; setThinkingSteps([]);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
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
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-primary" /> AIチャット</h1>
          <p className="text-sm text-muted-foreground">
            新しいチャットごとに会話が保存されます{engineLabel && ` ・ 使用中のAI: ${engineLabel}`}
          </p>
        </div>
        <AiStatusBadge />
      </div>
      {!canAi && <div className="mb-3"><AiUnavailable feature="AIチャット" /></div>}

      <Card className="mb-3 overflow-hidden border-primary/15 bg-gradient-to-r from-primary/[0.06] via-background to-background">
        <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setScopeOpen((v) => !v)}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">AIに許可する学習情報</span>
            <span className="block truncate text-xs text-muted-foreground">{scopes.length}種類を許可中・質問に必要な情報だけ端末内AIへ渡します</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${scopeOpen ? "rotate-180" : ""}`} />
        </button>
        {scopeOpen && (
          <div className="border-t px-3 pb-3 pt-2">
            <div className="mb-2 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              許可した情報も常に読むわけではありません。たとえば「今日の計画」には目標や試験を使い、「英語を訳して」など通常の質問には学習情報を使いません。情報は回答作成だけに使われます。
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SCOPE_DEFS.map((s) => {
                const on = scopes.includes(s.key);
                const Icon = s.icon;
                return (
                  <label key={s.key} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${on ? "border-primary/30 bg-primary/[0.06]" : "bg-background/70"}`}>
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{s.label}</span><span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{s.desc}</span></span>
                    <Switch checked={on} onCheckedChange={() => toggleScope(s.key)} aria-label={`${s.label}の参照許可`} />
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </Card>


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
                onClick={() => { if (!busy) setActiveId(t.id); }}
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
            {messageLoading && <div className="h-full grid place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />会話を読み込んでいます</div></div>}
            {!messageLoading && msgs.length === 0 && (
              <div className="h-full grid place-items-center text-center text-muted-foreground">
                <div className="max-w-lg">
                  <Sparkles className="h-10 w-10 mx-auto mb-2 text-primary/50" />
                  <p className="font-semibold text-foreground">知りたいことを、そのまま話してください</p>
                  <p className="mt-1 text-sm">普通の質問はすぐ回答し、記録の依頼は保存前に必ず確認します。</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((prompt) => <button key={prompt} onClick={() => { setInput(prompt); inputRef.current?.focus(); }} className="rounded-xl border bg-background px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-primary/[0.04]">{prompt}</button>)}
                  </div>
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
                  {m.role !== "user" && (m.thinking ?? []).length > 0 && (
                    <ThinkingBlock steps={m.thinking ?? []} defaultOpen={false} />
                  )}
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-muted rounded-2xl px-4 py-2 space-y-2">
                  {thinkingSteps.length > 0 && (
                    <ThinkingBlock steps={thinkingSteps} defaultOpen={showThinking} onOpenChange={setShowThinking} live />
                  )}

                  <div className="prose prose-sm dark:prose-invert">
                    {streaming ? (
                      <ReactMarkdown>{streaming + "▍"}</ReactMarkdown>
                    ) : (
                      thinkingSteps.length === 0 && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />回答を準備しています…</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {proposedAction && (
              <div className="flex justify-start">
                <div className="max-w-[85%] w-full">
                  <AiActionCard
                    action={proposedAction}
                    onCancel={() => setProposedAction(null)}
                    onApprove={async (a) => {
                      try {
                        const msg = await applyAiAction(a, user!.id);
                        toast.success(msg);
                        setProposedAction(null);
                      } catch (e: any) { toast.error(e.message ?? "登録に失敗しました"); }
                    }}
                  />
                </div>
              </div>
            )}
            {flowError && !busy && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl border border-destructive/25 bg-destructive/[0.04] p-3 text-sm">
                  <p>{flowError}</p>
                  {input.trim() && <Button variant="outline" size="sm" className="mt-2" onClick={() => void send()}><RotateCcw className="h-3.5 w-3.5" />もう一度送る</Button>}
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
              ref={inputRef}
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? "回答が終わるまでお待ちください" : "質問や「数学を30分記録して」と入力"}
              className="min-h-[44px] max-h-32 resize-none"
              disabled={busy}
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
