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
import { ChevronLeft, ChevronRight, Flag, NotebookPen, Upload, Bookmark, ThumbsUp, Lightbulb, Flag as FlagIcon, ScanText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "@/components/makron/ReportDialog";

export const Route = createFileRoute("/_authenticated/makron/session/$sessionId")({ component: SessionPage });

type Q = {
  id: string; prompt: string; image_url: string | null; type: "single"|"multi"|"text"|"written"|"file"|"ocr";
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
      // 出題対象: パックが指定されればそのパックの問題、そうでなければ単元全体（後方互換）
      const baseQuery = p
        ? (supabase as any).from("makron_questions").select("*").eq("pack_id", s.pack_id)
        : (supabase as any).from("makron_questions").select("*").eq("unit_id", s.unit_id).eq("status", "approved");
      const { data: qs } = await baseQuery.neq("is_active", false).order("order_idx").order("created_at");
      let list = (qs ?? []) as Q[];
      if (p?.shuffle) list = shuffleArr(list);
      if (p?.question_limit && p.question_limit > 0 && (!s.all_mode)) list = list.slice(0, p.question_limit);
      setQuestions(list);

      if (p?.skip_preview) setShowPreview(false);

      const { data: aRows } = await (supabase as any).from("makron_answers").select("*").eq("session_id", sessionId);
      const a: Record<string, any> = {}, f: Record<string, string> = {};
      for (const r of aRows ?? []) {
        a[r.question_id] = r.answer;
        if (r.file_url) f[r.question_id] = r.file_url;
      }
      setAnswers(a); setFiles(f);
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
    if (!confirm(`ヒント券を1枚使ってヒントを表示しますか？（残り ${hintTickets} 枚）`)) return;
    const { error } = await (supabase as any).rpc("consume_inventory", { _item_code: "hint_ticket", _qty: 1 });
    if (error) return toast.error(error.message);
    setHintTickets((n) => n - 1);
    setHintShown((s) => new Set(s).add(q.id));
  };

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
      } else if (q.type === "text" || q.type === "ocr") {
        const s = String(val ?? "").trim().toLowerCase();
        auto = (q.accepted_answers ?? []).some((a) => a.trim().toLowerCase() === s);
      }
    }
    const pts = auto === true ? q.points : (auto === false ? 0 : null);
    await (supabase as any).from("makron_answers").upsert({
      session_id: sessionId, question_id: q.id, answer: val ?? null,
      file_url: files[q.id] ?? null, auto_correct: auto, awarded_points: pts,
      review_flag: reviewFlags.has(q.id),
      is_correct: auto,
    }, { onConflict: "session_id,question_id" });
  };

  const goto = async (newIdx: number) => { await saveCurrent(); setIdx(newIdx); };

  const finish = async () => {
    if (!confirm("提出して採点しますか？")) return;
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
      subtitle={`配点: ${q.points} 点${pack && !pack.is_official ? " ・ 報酬なし" : ""}`}
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
          {q.type === "written" && <Textarea rows={8} value={answers[q.id] ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="記述で解答" />}
          {q.type === "file" && (
            <div className="space-y-2">
              <Input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              {files[q.id] && <div className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" />提出済: {files[q.id].split("/").pop()}</div>}
            </div>
          )}
          {q.type === "ocr" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ScanText className="h-3 w-3" />手書き写真を選ぶと、端末内で文字認識(AI不使用)して下の欄に入力します。
              </div>
              <Input type="file" accept="image/*" disabled={ocrBusy} onChange={(e) => e.target.files?.[0] && runOcr(e.target.files[0])} />
              {ocrBusy && <div className="text-xs text-amber-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />読み取り中…（数十秒かかる場合があります）</div>}
              <Textarea rows={4} value={answers[q.id] ?? ""} onChange={(e) => setAns(e.target.value)} placeholder="読み取り結果（編集可）" />
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
            return (
              <button key={i} onClick={() => goto(i)} className={`h-7 w-7 text-xs rounded border ${i === idx ? "bg-primary text-primary-foreground" : answered ? "bg-success/20" : ""}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} questionId={q.id} />
    </MakronShell>
  );
}