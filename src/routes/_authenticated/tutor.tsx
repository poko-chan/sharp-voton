import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Send, Paperclip, Loader2, X, Trash2, Plus, MessageSquare, Pencil, ChevronDown,
  Brain, Search, RotateCcw, PanelLeftClose, PanelLeft, Settings2, Copy, Check, Square,
  Download, ArrowDown, SlidersHorizontal, Eye, EyeOff, Layers, Globe, GlobeLock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  getStudyContext, listTutorThreads, createTutorThread, renameTutorThread, deleteTutorThread,
} from "@/lib/tutor.functions";
import { webSearch, fetchPage, type WebResult } from "@/lib/websearch.functions";
import { isAiUsable, createAiSession } from "@/lib/ai-provider";
import { buildBudgetedHistory } from "@/lib/ai-quality";
import { AiUnavailable } from "@/components/AiUnavailable";
import { AiStatusBadge } from "@/components/ChromeAiStatusBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AiActionCard } from "@/components/ai/AiActionCard";
import { ChatSettingsPanel } from "@/components/ai/ChatSettingsPanel";
import { VoiceMicButton } from "@/components/VoiceMicButton";
import {
  SCOPE_DEFS, loadPrefs, savePrefs, relevantScopes, LENGTH_RULE, TONE_RULE,
  needsWebSearch, buildSearchQuery,
  type ChatPrefs, type ScopeKey,
} from "@/lib/tutor-prefs";
import { detectAiAction, applyAiAction, fetchSubjectNames, looksLikeActionRequest, parseCommonActionRequest, type AiAction } from "@/lib/ai-actions";


type Attachment = { url: string; name: string; type: string };
type ThinkingStep = { label: string; detail?: string; done: boolean };
type Msg = { id: string; role: string; content: string; attachments: Attachment[]; created_at: string; thread_id: string | null; thinking?: ThinkingStep[] };
type Thread = { id: string; title: string; updated_at: string; created_at: string };

const QUICK_PROMPTS = [
  { title: "今日の勉強計画", body: "今日の勉強計画を、優先順位つきで考えて" },
  { title: "苦手を分析", body: "最近の学習記録から、私の苦手と対策を教えて" },
  { title: "考え方を教わる", body: "この問題の考え方だけヒントで教えて：" },
  { title: "学習を記録する", body: "今日、数学を30分勉強したので記録して" },
];

const answerSystem = (displayName: string, prefs: ChatPrefs, ctx: any | null, web: WebResult[] = []) =>
  `あなたは${displayName}さん専属の学習アシスタントです。

【回答のルール】
- 日本語で、結論 → 理由・考え方の順に書く。前置きや自己紹介はしない。
- ${LENGTH_RULE[prefs.length]}
- ${TONE_RULE[prefs.tone]}
- ${prefs.directAnswer ? "答えを先に示し、そのあと理由と確認ポイントを説明する。" : "いきなり答えを出さず、ヒント → 考え方 → 最後に答え合わせの順で導く。"}
- 手順は番号付きリスト、比較は箇条書きで整理する。マークダウンの見出し(#)は使わない。
- わからないことは推測せず「情報が足りない」と伝え、確認したい点を1つだけ質問する。
- 画像が添付されていれば、その内容を読み取って解説する。
${
  web.length
    ? `
【Webで調べた最新情報（これを最優先の根拠にすること）】
${web.map((r, i) => `[${i + 1}] ${r.title}（${r.source}）: ${r.snippet}`).join("\n")}

- 事実・数値・固有名詞は必ず上の資料に基づいて答え、資料にない事実は「調べた範囲では確認できませんでした」と正直に書く。
- 根拠にした資料は文中で [1] のように番号で示す。出典URLの一覧は書かなくてよい（画面に自動表示されます）。
`
    : ""
}
${
  ctx

    ? `
【生徒の学習状況（直近30日・許可された情報のみ）】
${ctx.totalMinutes30d !== null ? `- 学習時間: ${ctx.totalMinutes30d ?? 0}分 / 活動日: ${ctx.activeDays30d ?? 0}日
- 登録科目: ${(ctx.subjectsRegistered ?? []).join("、") || "なし"}
- よく勉強: ${(ctx.topSubjects ?? []).map((s: any) => `${s.name}(${s.minutes}分)`).join("、") || "—"}` : ""}
${(ctx.weakTopics ?? []).length ? `- 苦手トピック: ${ctx.weakTopics.map((w: any) => `${w.topic}(${w.wrong}/${w.total}誤)`).join("、")}` : ""}
${(ctx.activeGoals ?? []).length ? `- 進行中の目標: ${ctx.activeGoals.map((g: any) => `${g.title}(${g.progress_minutes}/${g.target_minutes}分)`).join("、")}` : ""}
${(ctx.upcomingExams ?? []).length ? `- 近い試験: ${ctx.upcomingExams.map((e: any) => `${e.title}(${e.date ?? "日付未定"})`).join("、")}` : ""}
${(ctx.examTodos ?? []).length ? `- 未完了タスク: ${ctx.examTodos.join("、")}` : ""}
${(ctx.hardCards ?? []).length ? `- 苦手な暗記カード: ${ctx.hardCards.map((c: any) => `${c.front}(復習${c.reviews}回)`).join("、")}` : ""}
${(ctx.markonRecent ?? []).length ? `- Markon直近: ${ctx.markonRecent.map((m: any) => `${m.pack}(${m.attempts}回)`).join("、")}` : ""}
${ctx.recentNotes ? `- 直近の学習メモ:\n${ctx.recentNotes}` : ""}

これらを踏まえ、具体的で実行できるアドバイスをしてください。`
    : ""
}`;

function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
        catch { toast.error("コピーできませんでした"); }
      }}
    >
      {done ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}{done ? "コピーしました" : label}
    </button>
  );
}

function ThinkingBlock({
  steps, defaultOpen = false, onOpenChange, live = false,
}: { steps: ThinkingStep[]; defaultOpen?: boolean; onOpenChange?: (v: boolean) => void; live?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (live) setOpen(defaultOpen); }, [defaultOpen, live]);
  return (
    <Collapsible
      open={open}
      onOpenChange={(v) => { setOpen(v); onOpenChange?.(v); }}
      className="not-prose mb-2 rounded-xl border border-border/70 bg-muted/40 px-2.5 py-2"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span>思考プロセス（{steps.length}ステップ）</span>
        <ChevronDown className={`ml-auto h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5 border-l-2 border-primary/30 pl-2.5">
        {steps.map((step, i) => (
          <div key={i} className="text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              {step.done ? <Search className="h-3 w-3 text-primary" /> : <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              <span>{step.label}</span>
            </div>
            {step.detail && <div className="ml-1 whitespace-pre-wrap pl-4 text-muted-foreground">{step.detail}</div>}
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
  const searchFn = useServerFn(webSearch);
  const pageFn = useServerFn(fetchPage);

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
  const [canAi, setCanAi] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [showThinking, setShowThinking] = useState(true);
  const [engineLabel, setEngineLabel] = useState("");
  const [proposedAction, setProposedAction] = useState<AiAction | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<ChatPrefs>(() => loadPrefs());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [atBottom, setAtBottom] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stepsRef = useRef<ThinkingStep[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const cancelRef = useRef(false);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { savePrefs(prefs); }, [prefs]);
  useEffect(() => { isAiUsable().then(setCanAi); }, []);
  useEffect(() => {
    import("@/lib/ai-provider").then(({ resolveAiTarget }) =>
      resolveAiTarget().then((t) => setEngineLabel(t.engine === "none" ? "" : t.modelLabel)),
    );
  }, [canAi]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("ai.tutor.sidebar");
    if (saved !== null) setSidebarOpen(saved === "1");
    else setSidebarOpen(window.innerWidth >= 1024);
  }, []);
  const toggleSidebar = () => setSidebarOpen((v) => {
    try { window.localStorage.setItem("ai.tutor.sidebar", v ? "0" : "1"); } catch { /* noop */ }
    return !v;
  });

  const syncSteps = () => setThinkingSteps([...stepsRef.current]);
  const addStep = (label: string, detail?: string) => { stepsRef.current = [...stepsRef.current, { label, detail, done: false }]; syncSteps(); };
  const finishLastStep = (detail?: string) => {
    stepsRef.current = stepsRef.current.map((s, i) => (i === stepsRef.current.length - 1 ? { ...s, done: true, detail: detail ?? s.detail } : s));
    syncSteps();
  };

  const loadThreads = useCallback(async () => {
    try {
      const data = (await listFn()) as Thread[];
      setThreads(data);
      if (!activeIdRef.current && data.length > 0) setActiveId(data[0].id);
    } catch (e: any) { toast.error(e.message); }
  }, [listFn]);

  const loadMsgs = useCallback(async (tid: string | null) => {
    if (!user || !tid) { setMsgs([]); return; }
    setMessageLoading(true);
    const { data, error } = await supabase
      .from("tutor_messages").select("*").eq("user_id", user.id).eq("thread_id", tid).order("created_at");
    if (activeIdRef.current === tid) {
      if (error) setFlowError("会話履歴を読み込めませんでした。もう一度お試しください。");
      else setMsgs((data as any) ?? []);
      setMessageLoading(false);
    }
  }, [user]);

  useEffect(() => { loadThreads(); }, [user, loadThreads]);
  useEffect(() => { loadMsgs(activeId); }, [activeId, loadMsgs]);
  useEffect(() => { if (atBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, streaming, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  const newChat = async () => {
    if (busy) return;
    try {
      const row = (await createFn({ data: {} })) as Thread;
      setThreads((t) => [row, ...t]);
      setActiveId(row.id);
      setMsgs([]);
      setFlowError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e: any) { toast.error(e.message); }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    setUploading(true);
    try {
      const ups: Attachment[] = [];
      for (const file of Array.from(e.target.files)) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from("tutor-files").upload(path, file);
        if (error) throw error;
        const { signedUrl } = await import("@/lib/storage-url");
        ups.push({ url: await signedUrl("tutor-files", path), name: file.name, type: file.type });
      }
      setPending((p) => [...p, ...ups]);
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  /** 会話履歴（全メッセージ）からモデルに渡すテキストを作る */
  const buildHistory = (list: Msg[]) =>
    buildBudgetedHistory(
      list.map((m) => {
        const imgs = (m.attachments ?? []).filter((a) => a.type.startsWith("image/"));
        const imgNote = imgs.length ? `\n[添付画像: ${imgs.map((a) => a.name).join(", ")}]` : "";
        return { role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: `${m.content}${imgNote}` };
      }),
      { budget: 4000, keepRecent: 6 },
    );

  /** 回答生成の本体（送信・再生成の共通処理） */
  const generate = async (tid: string, history: Msg[], runId: number) => {
    if (!user) return;
    const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    const displayName = user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "生徒";
    const t0 = Date.now();

    addStep("使うAIを決めています", `${engineLabel || "端末内AI"} / 参照モード: ${
      prefs.lookup === "always" ? "いつも見る" : prefs.lookup === "never" ? "見ない" : "自動"
    } / 推論${prefs.passes}回`);
    finishLastStep();

    let ctx: any = null;
    const requested: ScopeKey[] =
      prefs.lookup === "never" ? []
        : prefs.lookup === "always" ? prefs.scopes
          : relevantScopes(lastUser, prefs.scopes);

    const doSearch = prefs.web === "on" || (prefs.web === "auto" && needsWebSearch(lastUser));
    // メッセージ内のURLを検出して直接読みに行く（どのサイトでも対応）
    const urlsInMsg = Array.from(new Set(lastUser.match(/https?:\/\/[^\s　)\]}>"'〈〉「」『』【】、。]+/g) ?? []))
      .filter((u) => !/\.(png|jpe?g|gif|webp|svg|mp4|mp3|pdf|zip)($|\?)/i.test(u))
      .slice(0, 2);
    if (requested.length > 0) {
      addStep("学習情報を確認しています", requested.map((k) => SCOPE_DEFS.find((s) => s.key === k)?.label).join("、"));
    }
    if (doSearch) addStep("Webで事実を確認しています", buildSearchQuery(lastUser));
    if (urlsInMsg.length > 0) addStep("ページを読んでいます", urlsInMsg.join("\n"));

    // 学習情報・Web検索・指定ページの取得は同時に行い、待ち時間を短くする
    const [ctxRes, webRes, pages] = await Promise.all([
      requested.length > 0 ? ctxFn({ data: { scopes: requested } }).catch(() => null) : Promise.resolve(null),
      doSearch
        ? searchFn({ data: { query: buildSearchQuery(lastUser) } }).catch(() => null)
        : Promise.resolve(null),
      Promise.all(urlsInMsg.map((u) => pageFn({ data: { url: u } }).catch(() => null))),
    ]);

    if (requested.length > 0) {
      ctx = ctxRes;
      if (!ctx) setFlowError("一部の学習情報を取得できなかったため、会話内容だけで回答します。");
      finishLastStep(
        ctx
          ? [
              ctx.totalMinutes30d !== null ? `学習時間 ${ctx.totalMinutes30d}分 / ${ctx.activeDays30d}日` : null,
              (ctx.activeGoals ?? []).length ? `目標 ${ctx.activeGoals.length}件` : null,
              (ctx.weakTopics ?? []).length ? `苦手 ${ctx.weakTopics.length}件` : null,
              (ctx.upcomingExams ?? []).length ? `試験 ${ctx.upcomingExams.length}件` : null,
              (ctx.hardCards ?? []).length ? `苦手カード ${ctx.hardCards.length}件` : null,
              (ctx.markonRecent ?? []).length ? `Markon ${ctx.markonRecent.length}件` : null,
            ].filter(Boolean).join(" / ") || "参照できるデータはありませんでした"
          : "取得に失敗したため、会話だけで回答します",
      );
    } else if (prefs.lookup === "never") {
      addStep("学習データは参照しません", "設定で「見ない」が選ばれています。");
      finishLastStep();
    }

    const webResults: WebResult[] = ((webRes as any)?.results ?? []) as WebResult[];
    // 指定されたページ本文を根拠の先頭に追加（ユーザーが明示した資料を最優先）
    const pageResults: WebResult[] = (pages ?? [])
      .filter((p: any) => p?.ok && p.text)
      .map((p: any) => ({
        title: p.title || p.finalUrl,
        snippet: String(p.text).slice(0, 1500),
        url: p.finalUrl,
        source: "指定ページ",
      }));
    if (urlsInMsg.length > 0) {
      const failed = (pages ?? []).filter((p: any) => !p?.ok);
      finishLastStep(
        pageResults.length
          ? pageResults.map((p) => `読み取り完了: ${p.title}`).join("\n")
          : failed.map((p: any) => p?.error ?? "読み取れませんでした").join("\n") || "読み取れませんでした",
      );
    }
    webResults.unshift(...pageResults);
    if (doSearch) {
      finishLastStep(
        webResults.length
          ? webResults.map((r, i) => `[${i + 1}] ${r.title}（${r.source}）`).join("\n")
          : "検索結果が見つからなかったため、AIの知識だけで答えます",
      );
    }

    const convo = buildHistory(history);
    const system = answerSystem(displayName, prefs, ctx, webResults);

    const session = await createAiSession({ system, task: "chat" });
    let text = "";
    setStreaming("");

    try {
      // 推論パス1: 考える骨組み（3回設定のときだけ）
      let plan = "";
      if (prefs.passes >= 3) {
        addStep("答えの骨組みを考えています", "何をどの順で説明すべきかを先に整理します。");
        const planner = await createAiSession({ task: "reasoning", system });
        try {
          plan = await planner.prompt(`${convo}\n\n上の質問に答える前に、回答に必ず含めるべき要点を箇条書き3〜5個だけ書いてください。回答本文は書かないでください。`);
        } finally { planner.destroy(); }
        finishLastStep(plan.trim().slice(0, 400) || "要点を整理しました");
      }

      // 推論パス2: 下書き（2回以上）
      let draft = "";
      if (prefs.passes >= 2) {
        addStep("下書きを作成しています", "まず素早く下書きを書き、次に自己点検して仕上げます。");
        draft = await session.prompt(`${convo}${plan ? `\n\n【押さえる要点】\n${plan}` : ""}\n\nアシスタント:`);
        finishLastStep(`下書き ${draft.trim().length}文字`);
      }

      addStep(prefs.passes >= 2 ? "下書きを見直して仕上げています" : "回答を組み立てています",
        prefs.passes >= 2 ? "誤り・抜け・冗長さを自分でチェックして書き直します。" : "会話と学習情報をもとに説明を作成中です。");

      const finalPrompt = draft
        ? `${convo}\n\n【あなたが書いた下書き】\n${draft}\n\n下書きの誤り・説明の抜け・冗長な部分を自分で点検し、より正確でわかりやすい最終回答だけを書いてください。「下書き」への言及はしないこと。\n\nアシスタント:`
        : `${convo}\n\nアシスタント:`;

      text = await session.promptStreaming(finalPrompt, (partial) => {
        if (runId === runIdRef.current && activeIdRef.current === tid && !cancelRef.current) setStreaming(partial);
      });
    } finally { session.destroy(); }

    if (cancelRef.current && !text.trim()) throw new Error("生成を中断しました。");
    if (!text.trim()) throw new Error("AIから回答を受け取れませんでした。もう一度お試しください。");
    finishLastStep(`${text.length}文字を生成しました（所要 ${Math.round((Date.now() - t0) / 1000)}秒${cancelRef.current ? "・途中で中断" : ""}）`);

    const sources = webResults.length
      ? `\n\n---\n**参照した情報源**\n${webResults.map((r, i) => `${i + 1}. [${r.title}](${r.url}) — ${r.source}`).join("\n")}`
      : "";

    const { error } = await supabase.from("tutor_messages").insert({
      user_id: user.id, role: "assistant", content: text + sources, attachments: [], thread_id: tid,
      thinking: stepsRef.current as any,

    } as any);
    if (error) throw new Error("回答は生成できましたが、会話履歴に保存できませんでした。");
  };

  const send = async () => {
    if (!user || (!input.trim() && pending.length === 0) || busy) return;
    const runId = ++runIdRef.current;
    cancelRef.current = false;
    const originalInput = input;
    const originalPending = [...pending];
    let inputWasCleared = false;
    let insertedMessageId: string | null = null;
    let completedNormally = false;
    setBusy(true); setFlowError(null); setProposedAction(null);
    stepsRef.current = []; setThinkingSteps([]); setShowThinking(prefs.autoOpenThinking);

    try {
      let tid = activeId;
      let isNew = false;
      if (!tid) {
        const row = (await createFn({ data: { title: (input.trim() || "新しいチャット").slice(0, 40) } })) as Thread;
        tid = row.id; isNew = true;
        setThreads((t) => [row, ...t]);
        setActiveId(tid); activeIdRef.current = tid;
      }

      const userMsg = { user_id: user.id, role: "user", content: originalInput.trim(), attachments: originalPending, thread_id: tid };
      const { data: ins, error: insertError } = await supabase.from("tutor_messages").insert(userMsg).select().single();
      if (insertError || !ins) throw new Error("メッセージを保存できませんでした。入力内容はそのまま残しています。");
      const insMsg = ins as unknown as Msg;
      insertedMessageId = insMsg.id;
      const nextMsgs = [...msgs, insMsg];
      if (activeIdRef.current === tid) setMsgs(nextMsgs);
      setInput(""); setPending([]); inputWasCleared = true;

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
        completedNormally = true;
        return;
      }

      await generate(tid, nextMsgs, runId);
      completedNormally = true;

      if (isNew && userMsg.content) {
        try { await renameFn({ data: { id: tid, title: userMsg.content.slice(0, 30) } }); } catch { /* 回答は保存済み */ }
      }
      if (activeIdRef.current === tid) await loadMsgs(tid);
      await loadThreads();
    } catch (e: any) {
      const message = e?.message || "回答を生成できませんでした。";
      setFlowError(message);
      if (inputWasCleared && originalInput) setInput(originalInput);
      if (inputWasCleared && originalPending.length) setPending(originalPending);
      if (insertedMessageId && !completedNormally) {
        await supabase.from("tutor_messages").delete().eq("id", insertedMessageId).eq("user_id", user.id);
        setMsgs((c) => c.filter((m) => m.id !== insertedMessageId));
      }
      toast.error(message);
    } finally {
      if (runId === runIdRef.current) {
        setBusy(false); setStreaming(""); stepsRef.current = []; setThinkingSteps([]); cancelRef.current = false;
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  };

  /** 直前の回答を作り直す */
  const regenerate = async () => {
    if (!user || busy || !activeId) return;
    const last = [...msgs].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const runId = ++runIdRef.current;
    cancelRef.current = false;
    setBusy(true); setFlowError(null); setProposedAction(null);
    stepsRef.current = []; setThinkingSteps([]); setShowThinking(prefs.autoOpenThinking);
    try {
      await supabase.from("tutor_messages").delete().eq("id", last.id).eq("user_id", user.id);
      const trimmed = msgs.filter((m) => m.id !== last.id);
      setMsgs(trimmed);
      await generate(activeId, trimmed, runId);
      await loadMsgs(activeId);
    } catch (e: any) {
      setFlowError(e?.message ?? "作り直しに失敗しました");
      await loadMsgs(activeId);
    } finally {
      if (runId === runIdRef.current) { setBusy(false); setStreaming(""); stepsRef.current = []; setThinkingSteps([]); cancelRef.current = false; }
    }
  };

  const stopGeneration = () => { cancelRef.current = true; toast.info("生成を止めています…"); };

  const exportChat = () => {
    const title = threads.find((t) => t.id === activeId)?.title ?? "chat";
    const md = `# ${title}\n\n` + msgs.map((m) => `## ${m.role === "user" ? "自分" : "AI"}\n\n${m.content}\n`).join("\n");
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}.md`; a.click();
    URL.revokeObjectURL(url);
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
      if (activeId === deleteTarget.id) { setActiveId(null); setMsgs([]); }
      toast.success("チャットを削除しました");
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  const filteredThreads = useMemo(
    () => threads.filter((t) => !threadQuery || t.title.toLowerCase().includes(threadQuery.toLowerCase())),
    [threads, threadQuery],
  );


  const activeTitle = threads.find((t) => t.id === activeId)?.title ?? "新しいチャット";

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-background">
      {/* サイドバー */}
      <aside
        className={`flex h-full shrink-0 flex-col border-r bg-muted/40 transition-[width] duration-200 ${
          sidebarOpen ? "w-[264px]" : "w-0"
        } overflow-hidden`}
      >
        <div className="space-y-1.5 p-3">
          <div className="flex items-center gap-1">
            <button onClick={newChat}
              className="flex h-9 flex-1 items-center gap-2.5 rounded-lg border bg-background px-3 text-sm font-medium shadow-sm transition hover:bg-muted/70">
              <Plus className="h-4 w-4" />新しいチャット
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleSidebar} title="サイドバーを閉じる">
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={threadQuery} onChange={(e) => setThreadQuery(e.target.value)} placeholder="チャットを検索" className="h-8 rounded-lg border-0 bg-transparent pl-8 text-xs shadow-none focus-visible:ring-1" />
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {filteredThreads.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">チャットがありません</p>}
          {filteredThreads.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">履歴</p>}
          {filteredThreads.map((t) => (
            <div
              key={t.id}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                activeId === t.id ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              }`}
              onClick={() => { if (!busy) { setActiveId(t.id); setFlowError(null); } }}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
              {renamingId === t.id ? (
                <Input
                  autoFocus value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)}
                  onBlur={() => submitRename(t.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitRename(t.id); if (e.key === "Escape") setRenamingId(null); }}
                  className="h-6 text-xs" onClick={(e) => e.stopPropagation()}
                />
              ) : <span className="flex-1 truncate">{t.title}</span>}
              <button className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-background"
                onClick={(e) => { e.stopPropagation(); setRenamingId(t.id); setRenameTitle(t.title); }} title="名前を変える">
                <Pencil className="h-3 w-3" />
              </button>
              <button className="rounded p-1 text-destructive opacity-0 transition group-hover:opacity-100 hover:bg-destructive/15"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }} title="削除">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="p-2">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-background/60 hover:text-foreground" onClick={() => setSettingsOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />チャットの設定
          </button>
        </div>
      </aside>

      {/* メイン */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 px-3 py-2.5">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar} title="サイドバーを開く">
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{activeTitle}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {engineLabel || "端末内AI"} ・ {QUALITY_DEFS.find((q) => q.key === prefs.quality)?.label}
            </p>

          </div>
          <div className="ml-auto flex items-center gap-1">
            <AiStatusBadge />
            {msgs.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportChat} title="この会話を書き出す">
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)} title="設定">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {!canAi && <div className="border-b p-3"><AiUnavailable feature="AIチャット" /></div>}

        <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messageLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />会話を読み込んでいます
              </div>
            )}

            {!messageLoading && msgs.length === 0 && (
              <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">今日はどのようにお手伝いしましょうか？</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  質問にはすぐ答え、記録の依頼は保存前に確認します。
                </p>
                <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button key={p.title} onClick={() => { setInput(p.body); inputRef.current?.focus(); }}
                      className="group rounded-2xl border px-4 py-3.5 transition hover:bg-muted/60">
                      <span className="block text-sm font-medium">{p.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground transition group-hover:text-foreground/70">{p.body}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {msgs.map((m, i) => {
                const mine = m.role === "user";
                const isLastAssistant = !mine && i === msgs.length - 1;
                return (
                  <div key={m.id} className={`group flex ${mine ? "justify-end" : ""}`}>
                    <div className={mine ? "max-w-[80%]" : "min-w-0 flex-1"}>
                      {(m.attachments ?? []).map((a, k) => (
                        a.type.startsWith("image/")
                          ? <img key={k} src={a.url} alt={a.name} className="mb-1.5 max-h-56 rounded-xl border" />
                          : <a key={k} href={a.url} target="_blank" className="mb-1.5 block text-xs underline">{a.name}</a>
                      ))}
                      {!mine && (m.thinking ?? []).length > 0 && <ThinkingBlock steps={m.thinking ?? []} />}
                      <div className={
                        mine
                          ? "rounded-3xl bg-muted px-4 py-2.5 prose prose-sm dark:prose-invert max-w-none"
                          : "prose prose-sm dark:prose-invert max-w-none leading-relaxed"
                      }>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                      <div className={`mt-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 ${mine ? "justify-end" : ""}`}>
                        <CopyButton text={m.content} />
                        {mine && (
                          <button className="rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            onClick={() => { setInput(m.content); inputRef.current?.focus(); }}>
                            編集して送り直す
                          </button>
                        )}
                        {isLastAssistant && !busy && (
                          <button className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            onClick={() => void regenerate()}>
                            <RotateCcw className="h-3 w-3" />作り直す
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {busy && (
                <div className="flex">
                  <div className="min-w-0 flex-1">
                    {thinkingSteps.length > 0 && (
                      <ThinkingBlock steps={thinkingSteps} defaultOpen={showThinking} onOpenChange={setShowThinking} live />
                    )}
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {streaming ? <ReactMarkdown>{streaming + "▍"}</ReactMarkdown> : (
                        thinkingSteps.length === 0 && (
                          <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />回答を準備しています…
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {proposedAction && (
                <AiActionCard
                  action={proposedAction}
                  onCancel={() => setProposedAction(null)}
                  onApprove={async (a) => {
                    try { toast.success(await applyAiAction(a, user!.id)); setProposedAction(null); }
                    catch (e: any) { toast.error(e.message ?? "登録に失敗しました"); }
                  }}
                />
              )}

              {flowError && !busy && (
                <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-3 text-sm">
                  <p>{flowError}</p>
                  {input.trim() && (
                    <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => void send()}>
                      <RotateCcw className="h-3.5 w-3.5" />もう一度送る
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div ref={endRef} />
          </div>

          {!atBottom && (
            <button onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="sticky bottom-4 left-1/2 z-10 -ml-4 grid h-8 w-8 place-items-center rounded-full border bg-card shadow-md transition hover:bg-muted"
              title="最新へ">
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 入力欄 */}
        <div className="bg-background">
          <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2">
            {pending.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pending.map((a, i) => (
                  <div key={i} className="relative">
                    {a.type.startsWith("image/")
                      ? <img src={a.url} className="h-16 w-16 rounded-lg object-cover" />
                      : <div className="grid h-16 place-items-center rounded-lg bg-muted px-2 text-xs">{a.name}</div>}
                    <button onClick={() => setPending(pending.filter((_, j) => j !== i))}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void send(); }}
              className="rounded-3xl border bg-muted/50 transition focus-within:border-muted-foreground/30 focus-within:bg-muted/70">
              <input type="file" ref={fileRef} className="hidden" multiple accept="image/*,.pdf" onChange={onUpload} />
              <Textarea
                ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={busy ? "生成中です…" : "AIに質問する…（「数学を30分記録して」もOK）"}
                className="max-h-48 min-h-[52px] w-full resize-none border-0 bg-transparent px-4 pb-1 pt-3.5 text-base shadow-none focus-visible:ring-0"
                disabled={busy}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              />

              {/* コンポーザー内のコントロール行 */}
              <div className="flex flex-wrap items-center gap-1 px-2.5 pb-2.5">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground" disabled={uploading} onClick={() => fileRef.current?.click()} title="ファイルを添付">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>

                {/* 品質（Flash / Think / Pro） */}
                <div className="flex shrink-0 items-center rounded-full bg-background p-0.5 shadow-sm">
                  {QUALITY_DEFS.map((q) => {
                    const on = prefs.quality === q.key;
                    const Icon = q.key === "flash" ? Zap : q.key === "think" ? Brain : Gem;
                    return (
                      <button
                        key={q.key}
                        type="button"
                        title={q.desc}
                        onClick={() => setPrefs((p) => ({ ...p, quality: q.key }))}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />{q.label}
                      </button>
                    );
                  })}
                </div>

                <Chip
                  on={prefs.web === "on"}
                  icon={prefs.web === "on" ? Globe : GlobeLock}
                  label={prefs.web === "on" ? "Web検索: オン" : "Web検索: おまかせ"}
                  title="オンにすると毎回Webで事実を確認します。おまかせのときはAIが必要と判断したときだけ検索します。"
                  onClick={() => setPrefs((p) => ({ ...p, web: p.web === "on" ? "auto" : "on" }))}
                />

                <Chip
                  on={prefs.lookup === "on"}
                  icon={prefs.lookup === "on" ? Eye : EyeOff}
                  label={prefs.lookup === "on" ? "学習データ: オン" : "学習データ: オフ"}
                  title="AIがあなたの学習記録・目標などを参照するかどうか"
                  onClick={() => setPrefs((p) => ({ ...p, lookup: p.lookup === "on" ? "off" : "on" }))}
                />

                <Chip
                  on={prefs.length !== "normal"}
                  icon={AlignLeft}
                  label={prefs.length === "short" ? "短く" : prefs.length === "deep" ? "詳しく" : "標準の長さ"}
                  title="回答の長さ"
                  onClick={() => setPrefs((p) => ({ ...p, length: p.length === "short" ? "normal" : p.length === "normal" ? "deep" : "short" }))}
                />

                <Chip
                  on={prefs.directAnswer}
                  icon={prefs.directAnswer ? Lightbulb : GraduationCap}
                  label={prefs.directAnswer ? "答えを先に" : "ヒント重視"}
                  title="答えから教えるか、ヒントから導くか"
                  onClick={() => setPrefs((p) => ({ ...p, directAnswer: !p.directAnswer }))}
                />

                <Chip
                  on={prefs.autoOpenThinking}
                  icon={ScrollText}
                  label={prefs.autoOpenThinking ? "思考を表示" : "思考を隠す"}
                  title="生成中に思考プロセスを開いた状態にする"
                  onClick={() => setPrefs((p) => ({ ...p, autoOpenThinking: !p.autoOpenThinking }))}
                />

                <Chip
                  on={prefs.showSources}
                  icon={Link2}
                  label={prefs.showSources ? "出典あり" : "出典なし"}
                  title="回答の下に参照した情報源のリンクを付ける"
                  onClick={() => setPrefs((p) => ({ ...p, showSources: !p.showSources }))}
                />


                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <VoiceMicButton onResult={(t) => setInput((v) => (v ? `${v} ${t}` : t))} />
                  {busy ? (
                    <Button type="button" variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={stopGeneration} title="生成を止める">
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <button type="submit" disabled={!canAi || (!input.trim() && pending.length === 0)} title="送信"
                      className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background transition hover:opacity-85 disabled:opacity-30">
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="mt-2 flex items-center justify-center gap-2 px-1 text-[10px] text-muted-foreground">
              <span>AIの回答が必ず正しいとは限りません。大事な内容は確認してください。</span>
              <span className="hidden sm:inline">{input.length > 0 ? `${input.length}文字` : "Enterで送信"}</span>
            </div>
          </div>
        </div>
      </main>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>チャットの設定</SheetTitle>
            <SheetDescription>このチャットでAIがどう考えるか、何を見るかを決められます。</SheetDescription>
          </SheetHeader>
          <div className="mt-4 pb-8">
            <ChatSettingsPanel prefs={prefs} onChange={setPrefs} />
          </div>
        </SheetContent>
      </Sheet>

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
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/tutor")({ component: TutorPage });
