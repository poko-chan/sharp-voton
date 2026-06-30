import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronLeft, ChevronRight, Flag, NotebookPen, Upload, Bookmark, ThumbsUp, Lightbulb, Flag as FlagIcon, ScanText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "@/components/makron/ReportDialog";
import { MakronHandwriteOCR } from "@/components/makron/MakronHandwriteOCR";
import { useServerFn } from "@tanstack/react-start";
import { gradeWrittenAnswer } from "@/lib/grading.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/makron/session/$sessionId")({ component: SessionPage });

type Q = {
  id: string; prompt: string; image_url: string | null;
  type: "single"|"multi"|"text"|"written"|"file"|"ocr"|"numeric"|"long_text"|"fill_blank"|"ordering"|"matching";
  options: string[]; correct_options: string[]; accepted_answers: string[];
  model_answer: string | null; explanation: string | null; points: number; grading: "auto"|"manual";
  hint_text: string | null;
};

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SessionPage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [pack, setPack] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [allMode, setAllMode] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const padInit = useRef<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [reviewFlags, setReviewFlags] = useState<Set<string>>(new Set());
  const [hintShown, setHintShown] = useState<Set<string>>(new Set());
  const [hintTickets, setHintTickets] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [hintConfirmOpen, setHintConfirmOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const gradeFn = useServerFn(gradeWrittenAnswer);
  const [grading, setGrading] = useState(false);
  const [aiGrades, setAiGrades] = useState<Record<string, { score: number; rate: number; feedback: string; good: string[]; improve: string[] }>>({});
  const startedAtRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒`;

  useEffect(() => {
    (async () => {
      const { data: s } = await (supabase as any).from("makron_sessions").select("*").eq("id", sessionId).maybeSingle();
      if (!s) return;
      setSession(s);
      padInit.current = s.scratchpad ?? null;

      let p: any = null;
      if (s.pack_id) {
        const { data } = await (supabase as any).from("makron_packs").select("*").eq("id", s.pack_id).maybeSingle();
        p = data; setPack(p);
      }
      // 出題対象: question_ids（デイリー等）→ パック → 単元の順
      let qs: any[] | null = null;
      if (Array.isArray(s.question_ids) && s.question_ids.length > 0) {
        const r = await (supabase as any).from("makron_questions").select("*").in("id", s.question_ids);
        qs = r.data ?? [];
        // preserve given order
        const order = new Map<string, number>(s.question_ids.map((id: string, i: number) => [id, i]));
        qs!.sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      } else {
        const baseQuery = p
          ? (supabase as any).from("makron_questions").select("*").eq("pack_id", s.pack_id)
          : (supabase as any).from("makron_questions").select("*").eq("unit_id", s.unit_id).eq("status", "approved");
        const r = await baseQuery.neq("is_active", false).order("order_idx").order("created_at");
        qs = r.data ?? [];
      }
      let list = (qs ?? []) as Q[];
      if (p?.shuffle) list = shuffleArr(list);
      if (p?.question_limit && p.question_limit > 0 && (!s.all_mode)) list = list.slice(0, p.question_limit);
      setQuestions(list);

      if (p?.skip_preview) setShowPreview(false);

      // 途中保存はしない方針: 既存のDB回答は読み込まず、毎回新規に進めます。
      setAnswers({}); setFiles({});
      if (user) {
        const [{ data: bm }, { data: lk }, { data: inv }] = await Promise.all([
          (supabase as any).from("makron_bookmarks").select("question_id").eq("user_id", user.id),
          (supabase as any).from("makron_question_likes").select("question_id, liked").eq("user_id", user.id),
          (supabase as any).from("user_inventory").select("quantity").eq("user_id", user.id).eq("item_code", "hint_ticket").maybeSingle(),
        ]);
        setBookmarks(new Set((bm ?? []).map((r: any) => r.question_id)));
        setLikes(new Set((lk ?? []).filter((r: any) => r.liked).map((r: any) => r.question_id)));
        setHintTickets(inv?.quantity ?? 0);
      }
    })();
  }, [sessionId, user?.id]);

  const q = questions[idx];
  const setAns = (val: any) => setAnswers((p) => ({ ...p, [q.id]: val }));

  const toggleBookmark = async () => {
    if (!user || !q) return;
    if (bookmarks.has(q.id)) {
      await (supabase as any).from("makron_bookmarks").delete().eq("user_id", user.id).eq("question_id", q.id);
      setBookmarks((s) => { const n = new Set(s); n.delete(q.id); return n; });
    } else {
      await (supabase as any).from("makron_bookmarks").insert({ user_id: user.id, question_id: q.id });
      setBookmarks((s) => new Set(s).add(q.id));
      toast.success("ブックマークしました");
    }
  };

  const toggleLike = async () => {
    if (!user || !q) return;
    const liked = !likes.has(q.id);
    await (supabase as any).from("makron_question_likes").upsert({ user_id: user.id, question_id: q.id, liked }, { onConflict: "user_id,question_id" });
    setLikes((s) => { const n = new Set(s); liked ? n.add(q.id) : n.delete(q.id); return n; });
  };

  const useHint = async () => {
    if (!user || !q) return;
    if (!q.hint_text) return toast.info("この問題にはヒントが用意されていません");
    if (hintShown.has(q.id)) return;
    if (hintTickets <= 0) return toast.error("ヒント券がありません（ショップで購入できます）");
    setHintConfirmOpen(true);
  };

  const confirmUseHint = async () => {
    if (!q) return;
    const { error } = await (supabase as any).rpc("consume_inventory", { _item_code: "hint_ticket", _qty: 1 });
    if (error) { toast.error(error.message); setHintConfirmOpen(false); return; }
    setHintTickets((n) => n - 1);
    setHintShown((s) => new Set(s).add(q.id));
    setHintConfirmOpen(false);
  };

  // 単一問題の自動採点判定（ローカルのみ）
  const computeAuto = (qq: Q, val: any): boolean | null => {
    let auto: boolean | null = null;
    if (qq.grading === "auto") {
      if (qq.type === "single") auto = !!val && (qq.correct_options ?? [])[0] === val;
      else if (qq.type === "multi") {
        const v = Array.isArray(val) ? [...val].sort() : [];
        const c = [...(qq.correct_options ?? [])].sort();
        auto = v.length === c.length && v.every((x, i) => x === c[i]);
      } else if (qq.type === "text" || qq.type === "ocr") {
        const s = String(val ?? "").trim().toLowerCase();
        auto = (qq.accepted_answers ?? []).some((a) => a.trim().toLowerCase() === s);
      } else if (qq.type === "numeric") {
        const n = Number(val);
        auto = !isNaN(n) && (qq.accepted_answers ?? []).some((a) => Number(a) === n);
      } else if (qq.type === "fill_blank") {
        const arr = Array.isArray(val) ? val : [];
        const correct = qq.accepted_answers ?? [];
        auto = arr.length === correct.length &&
          arr.every((v, i) => String(v ?? "").trim().toLowerCase() === String(correct[i] ?? "").trim().toLowerCase());
      } else if (qq.type === "ordering") {
        const arr = Array.isArray(val) ? val : [];
        const correct = qq.correct_options ?? [];
        auto = arr.length === correct.length && arr.every((v, i) => v === correct[i]);
      } else if (qq.type === "matching") {
        const obj = (val && typeof val === "object") ? val : {};
        const map: Record<string, string> = {};
        (qq.accepted_answers ?? []).forEach((p) => {
          const [k, v] = p.split("=>");
          if (k && v) map[k.trim()] = v.trim();
        });
        const keys = Object.keys(map);
        auto = keys.length > 0 && keys.every((k) => String(obj[k] ?? "").trim() === map[k]);
      }
    }
    return auto;
  };

  // 問題間の移動は途中保存せず、ローカル state のみで切り替えます。
  const goto = (newIdx: number) => { setIdx(newIdx); };

  // Enter で次へ / 最後の問題は提出
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e as any).isComposing) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      // textarea や記述系の長文入力中は Enter を奪わない
      if (tag === "TEXTAREA") return;
      if (showPreview || submitConfirmOpen || hintConfirmOpen || reportOpen) return;
      e.preventDefault();
      if (idx + 1 < questions.length) setIdx(idx + 1);
      else setSubmitConfirmOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, questions.length, showPreview, submitConfirmOpen, hintConfirmOpen, reportOpen]);

  const finish = () => setSubmitConfirmOpen(true);

  const confirmFinish = async () => {
    setSubmitting(true);
    try {
      // 提出時にまとめてDBに書き込み、その後採点RPCを呼ぶ
      const rows = questions.map((qq) => {
        const val = answers[qq.id];
        const auto = computeAuto(qq, val);
        const pts = auto === true ? qq.points : (auto === false ? 0 : null);
        return {
          session_id: sessionId, question_id: qq.id,
          answer: val ?? null, file_url: files[qq.id] ?? null,
          auto_correct: auto, awarded_points: pts,
          review_flag: reviewFlags.has(qq.id), is_correct: auto,
        };
      });
      if (rows.length > 0) {
        const { error: upErr } = await (supabase as any)
          .from("makron_answers").upsert(rows, { onConflict: "session_id,question_id" });
        if (upErr) { toast.error(upErr.message); return; }
      }
      const rpcName = session?.kind === "daily" ? "makron_finalize_daily" : "finalize_makron_session";
      const { error } = await (supabase as any).rpc(rpcName, { _session_id: sessionId });
      if (error) { toast.error(error.message); return; }
      setSubmitConfirmOpen(false);
      nav({ to: "/makron/result/$sessionId", params: { sessionId } });
    } finally { setSubmitting(false); }
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${sessionId}/${q.id}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("makron-files").upload(path, file);
    if (error) return toast.error(error.message);
    setFiles((p) => ({ ...p, [q.id]: path }));
    toast.success("アップロードしました");
  };

  const runOcr = async (file: File) => {
    setOcrBusy(true);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const url = URL.createObjectURL(file);
      const { data } = await Tesseract.recognize(url, "jpn+eng");
      URL.revokeObjectURL(url);
      const text = (data?.text ?? "").trim();
      setAns(text);
      toast.success("OCRで読み取りました（必要に応じて編集してください）");
    } catch (e: any) {
      toast.error("OCRに失敗しました: " + (e?.message ?? "unknown"));
    } finally { setOcrBusy(false); }
  };

  const saveScratchpad = async (dataUrl: string) => {
    await (supabase as any).from("makron_sessions").update({ scratchpad: dataUrl }).eq("id", sessionId);
    toast.success("計算用紙を保存しました");
  };

  const switchAllMode = async () => {
    if (!pack) return;
    await (supabase as any).from("makron_sessions").update({ all_mode: true }).eq("id", sessionId);
    setAllMode(true);
    const { data: qs } = await (supabase as any).from("makron_questions").select("*").eq("pack_id", pack.id).neq("is_active", false).order("order_idx").order("created_at");
    let list = (qs ?? []) as Q[];
    if (pack.shuffle) list = shuffleArr(list);
    setQuestions(list);
    setShowPreview(false);
  };

  if (!session) return <MakronShell back="/makron"><div className="p-8 text-muted-foreground">読み込み中...</div></MakronShell>;

  // プレビュー画面（パックが skip_preview=false の時のみ）
  if (showPreview && pack) {
    const usingLimit = !!pack.question_limit && !allMode;
    return (
      <MakronShell back="/makron" title={pack.title} subtitle="演習プレビュー">
        <div className="max-w-3xl mx-auto p-6 space-y-3">
          <Card className="p-5 space-y-2">
            <div className="text-lg font-bold">{pack.title}</div>
            {pack.description && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{pack.description}</div>}
            <div className="text-xs text-muted-foreground">
              出題: {questions.length} 問 ・ 満点: {questions.reduce((s, x) => s + (x.points ?? 10), 0)} 点
              {pack.shuffle && " ・ シャッフル"}
              {usingLimit && ` ・ ${pack.question_limit}問抽出`}
              {!pack.is_official && " ・ 報酬なし（非公式）"}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setShowPreview(false)} disabled={questions.length === 0}>演習開始</Button>
              {usingLimit && pack.allow_all_mode !== false && (
                <Button variant="outline" onClick={switchAllMode}>全問演習モードで開始</Button>
              )}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-2">問題プレビュー</div>
            <ol className="text-sm space-y-1 list-decimal pl-5">
              {questions.map((qq) => (
                <li key={qq.id} className="truncate">
                  <span className="text-[10px] text-muted-foreground mr-1">[{qq.type}]</span>{qq.prompt}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </MakronShell>
    );
  }

  if (!q) return <MakronShell back="/makron"><div className="p-8 text-muted-foreground">問題がありません</div></MakronShell>;

  return (
    <MakronShell
      back="/makron"
      title={`問題 ${idx + 1} / ${questions.length}`}
      subtitle={`配点: ${q.points} 点 ・ 経過 ${fmtTime(elapsed)}${pack && !pack.is_official ? " ・ 報酬なし" : ""}`}
      right={
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setReviewFlags((s) => { const n = new Set(s); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })} title="後で見直すフラグを付ける">
            <FlagIcon className={`h-4 w-4 mr-1 ${reviewFlags.has(q.id) ? "fill-amber-500 text-amber-500" : ""}`} />
            <span className="hidden sm:inline text-xs">後で</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleBookmark} title="ブックマークに追加">
            <Bookmark className={`h-4 w-4 mr-1 ${bookmarks.has(q.id) ? "fill-primary text-primary" : ""}`} />
            <span className="hidden sm:inline text-xs">保存</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleLike} title="この問題にいいね">
            <ThumbsUp className={`h-4 w-4 mr-1 ${likes.has(q.id) ? "fill-primary text-primary" : ""}`} />
            <span className="hidden sm:inline text-xs">いいね</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={useHint} disabled={!q.hint_text || hintShown.has(q.id)} title={`ヒント券で答えのヒントを見る（残り${hintTickets}枚）`}>
            <Lightbulb className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline text-xs">ヒント({hintTickets})</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)} title="この問題の誤りや不適切な内容を運営に報告">
            <FlagIcon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline text-xs">報告</span>
          </Button>
          <Button size="sm" variant={showPad ? "default" : "outline"} onClick={() => setShowPad((v) => !v)} title="計算用紙の表示／非表示">
            <NotebookPen className="h-4 w-4 mr-1" />
            <span className="text-xs">計算用紙</span>
          </Button>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Card className="p-5 space-y-4">
          <div className="text-lg whitespace-pre-wrap">{q.prompt}</div>
          {q.image_url && <img src={q.image_url} alt="" className="max-h-80 rounded border" />}
          {hintShown.has(q.id) && q.hint_text && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="font-bold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1"><Lightbulb className="h-4 w-4" />ヒント</div>
              <div className="whitespace-pre-wrap">{q.hint_text}</div>
            </div>
          )}

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
          {q.type === "numeric" && (
            <Input type="number" inputMode="decimal" value={answers[q.id] ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="数値で回答" />
          )}
          {(q.type === "written" || q.type === "long_text") && (
            <div className="space-y-2">
              <Textarea
                rows={q.type === "long_text" ? 14 : 8}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAns(e.target.value)}
                placeholder={q.type === "long_text" ? "長文で記述" : "記述で解答"}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={grading || !(answers[q.id] ?? "").trim()}
                  onClick={async () => {
                    setGrading(true);
                    try {
                      const r = await gradeFn({ data: {
                        prompt: q.prompt,
                        answer: String(answers[q.id] ?? ""),
                        model_answer: q.model_answer ?? undefined,
                        max_points: q.points ?? 10,
                      }});
                      setAiGrades((p) => ({ ...p, [q.id]: r }));
                    } catch (e: any) { toast.error(e?.message ?? "採点失敗"); }
                    finally { setGrading(false); }
                  }}
                >
                  {grading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  AIで採点プレビュー
                </Button>
                <span className="text-xs text-muted-foreground">最終的な得点は提出後に確定します</span>
              </div>
              {aiGrades[q.id] && (
                <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
                  <div className="font-bold">AI採点: {aiGrades[q.id].score} / {q.points}（{aiGrades[q.id].rate}%）</div>
                  <div className="text-foreground/90 whitespace-pre-wrap">{aiGrades[q.id].feedback}</div>
                  {aiGrades[q.id].good.length > 0 && (
                    <div className="text-xs"><span className="font-semibold text-emerald-600">良い点:</span> {aiGrades[q.id].good.join(" / ")}</div>
                  )}
                  {aiGrades[q.id].improve.length > 0 && (
                    <div className="text-xs"><span className="font-semibold text-amber-600">改善点:</span> {aiGrades[q.id].improve.join(" / ")}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {q.type === "fill_blank" && (() => {
            const parts = q.prompt.split(/_{2,}/);
            const cur = Array.isArray(answers[q.id]) ? answers[q.id] : [];
            return (
              <div className="space-y-2 text-base leading-loose">
                {parts.map((seg, i) => (
                  <span key={i}>
                    <span className="whitespace-pre-wrap">{seg}</span>
                    {i < parts.length - 1 && (
                      <Input
                        className="inline-block w-32 mx-1 align-baseline"
                        value={cur[i] ?? ""}
                        onChange={(e) => {
                          const next = [...cur]; next[i] = e.target.value; setAns(next);
                        }}
                      />
                    )}
                  </span>
                ))}
              </div>
            );
          })()}
          {q.type === "ordering" && (() => {
            const cur: string[] = Array.isArray(answers[q.id]) && answers[q.id].length === q.options.length
              ? answers[q.id] : [...q.options];
            const move = (i: number, dir: -1 | 1) => {
              const j = i + dir;
              if (j < 0 || j >= cur.length) return;
              const next = [...cur];
              [next[i], next[j]] = [next[j], next[i]];
              setAns(next);
            };
            return (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">正しい順に並び替えてください</div>
                {cur.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 border rounded p-2">
                    <span className="text-xs font-mono w-6 text-muted-foreground">{i + 1}</span>
                    <span className="flex-1">{o}</span>
                    <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                    <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === cur.length - 1}>↓</Button>
                  </div>
                ))}
              </div>
            );
          })()}
          {q.type === "matching" && (() => {
            // options を "左|右1,右2,..." 形式と解釈（左側の選択肢に対し、右側候補から選ぶ）
            const lefts = q.options ?? [];
            const rights = Array.from(new Set((q.accepted_answers ?? []).map((p) => p.split("=>")[1]?.trim()).filter(Boolean)));
            const cur: Record<string, string> = (answers[q.id] && typeof answers[q.id] === "object") ? answers[q.id] : {};
            return (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">左側に対応する右側を選んでください</div>
                {lefts.map((l) => (
                  <div key={l} className="flex items-center gap-2 border rounded p-2">
                    <span className="flex-1">{l}</span>
                    <select
                      className="border rounded px-2 py-1 bg-background"
                      value={cur[l] ?? ""}
                      onChange={(e) => setAns({ ...cur, [l]: e.target.value })}
                    >
                      <option value="">--</option>
                      {rights.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            );
          })()}
          {q.type === "file" && (
            <div className="space-y-2">
              <Input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              {files[q.id] && <div className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" />提出済: {files[q.id].split("/").pop()}</div>}
            </div>
          )}
          {q.type === "ocr" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ScanText className="h-3 w-3" />手書きパッドに書いてください。1 秒手を止めると自動で読み取ります（空白・改行は無視）。
              </div>
              <MakronHandwriteOCR onChange={(t) => setAns(t)} />
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
          {questions.map((_, i) => {
            const v = answers[questions[i].id];
            const answered =
              v !== undefined && v !== null && v !== "" &&
              !(Array.isArray(v) && v.length === 0);
            const flagged = reviewFlags.has(questions[i].id);
            return (
              <button key={i} onClick={() => goto(i)} className={`h-7 w-7 text-xs rounded border relative ${i === idx ? "bg-primary text-primary-foreground" : answered ? "bg-success/20" : ""} ${flagged ? "ring-2 ring-amber-500" : ""}`}>
                {i + 1}
                {flagged && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} questionId={q.id} />
      <AlertDialog open={hintConfirmOpen} onOpenChange={setHintConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ヒントを表示しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              ヒント券を1枚使います（残り {hintTickets} 枚）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmUseHint(); }}>使う</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={submitConfirmOpen} onOpenChange={(o) => !submitting && setSubmitConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>提出して採点しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              提出すると採点され、結果が記録されます。途中保存はされないため、提出しない場合この演習の解答は残りません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={(e) => { e.preventDefault(); confirmFinish(); }}>
              {submitting ? "採点中…" : "提出する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MakronShell>
  );
}