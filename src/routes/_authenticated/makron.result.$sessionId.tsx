import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MakronShell } from "@/components/makron/MakronShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Copy, Award, Zap, Coins } from "lucide-react";
import { ReportDialog } from "@/components/makron/ReportDialog";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/makron/result/$sessionId")({ component: ResultPage });

function ResultPage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState("優しく丁寧に、中学生にもわかるように");
  const [extra, setExtra] = useState("");

  useEffect(() => {
    (async () => {
      const { data: s } = await (supabase as any).from("makron_sessions").select("*").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (!s) return;
      const { data: as } = await (supabase as any).from("makron_answers").select("*").eq("session_id", sessionId);
      setAnswers(as ?? []);
      // Only show questions actually presented in this session.
      // Prefer session.question_ids (daily/pack). Fallback: questions answered in this session.
      const ids: string[] = Array.isArray(s.question_ids) && s.question_ids.length
        ? s.question_ids
        : Array.from(new Set((as ?? []).map((a: any) => a.question_id)));
      if (ids.length === 0) { setQuestions([]); return; }
      const { data: qs } = await (supabase as any).from("makron_questions").select("*").in("id", ids);
      // preserve order
      const order = new Map(ids.map((id, i) => [id, i]));
      setQuestions((qs ?? []).slice().sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      if (user) {
        const { data: bm } = await (supabase as any).from("makron_bookmarks").select("question_id").eq("user_id", user.id).in("question_id", ids);
        setBookmarks(new Set((bm ?? []).map((x: any) => x.question_id)));
      }
    })();
  }, [sessionId, user?.id]);

  const toggleBookmark = async (qid: string) => {
    if (!user) return;
    if (bookmarks.has(qid)) {
      await (supabase as any).from("makron_bookmarks").delete().eq("user_id", user.id).eq("question_id", qid);
      const next = new Set(bookmarks); next.delete(qid); setBookmarks(next);
      toast.success("「あとでやる」を解除しました");
    } else {
      await (supabase as any).from("makron_bookmarks").insert({ user_id: user.id, question_id: qid });
      setBookmarks(new Set(bookmarks).add(qid));
      toast.success("「あとでやる」に追加しました");
    }
  };

  const byQ: Record<string, any> = useMemo(() => Object.fromEntries(answers.map((a) => [a.question_id, a])), [answers]);

  const display = (val: any) => Array.isArray(val) ? val.join(", ") : (val == null || val === "" ? "（未回答）" : String(val));

  const prompt = useMemo(() => {
    const lines: string[] = [];
    lines.push(`# Makron 採点結果へのフィードバック依頼`);
    lines.push(`口調: ${tone}`);
    if (extra) lines.push(`要望: ${extra}`);
    lines.push("");
    questions.forEach((q, i) => {
      const a = byQ[q.id];
      const correct = q.grading === "auto" ? a?.auto_correct : (a?.manual_score != null ? a.manual_score >= q.points : null);
      const mark = correct === true ? "○" : correct === false ? "×" : "未採点";
      lines.push(`## 問${i+1} [${q.type}] ${mark} (${q.points}点)`);
      lines.push(`問題: ${q.prompt}`);
      lines.push(`生徒の解答: ${display(a?.answer)}`);
      const model = (q.accepted_answers && q.accepted_answers.length ? q.accepted_answers : (q.correct_options && q.correct_options.length ? q.correct_options : [q.model_answer].filter(Boolean))) as string[];
      lines.push(`模範解答: ${model.join(" / ") || "(設定なし)"}`);
      if (q.explanation) lines.push(`解説: ${q.explanation}`);
      lines.push("");
    });
    lines.push(`各問題について、なぜ正解／不正解だったか、考え方のポイント、次に学習すべきことを${tone}でまとめてください。`);
    return lines.join("\n");
  }, [questions, byQ, tone, extra]);

  const copyPrompt = async () => { await navigator.clipboard.writeText(prompt); toast.success("プロンプトをコピーしました"); };

  if (!session) return <MakronShell back="/makron"><div className="p-8 text-muted-foreground">読み込み中...</div></MakronShell>;

  return (
    <MakronShell back="/makron" title="採点ダッシュボード">
      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <Card className="p-6 text-center bg-gradient-to-br from-primary/10 to-background">
          <div className="text-xs text-muted-foreground">合計</div>
          <div className="text-5xl font-extrabold tabular-nums">
            {session.total_score ?? 0}<span className="text-2xl text-muted-foreground"> / {session.total_points ?? 0}</span>
          </div>
          <div className="flex justify-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1"><Zap className="h-4 w-4 text-primary" />+{session.xp_awarded} XP</div>
            <div className="flex items-center gap-1"><Coins className="h-4 w-4 text-amber-500" />+{session.coins_awarded} コイン</div>
          </div>
        </Card>

        <div className="space-y-3">
          {questions.map((q, i) => {
            const a = byQ[q.id];
            const isManual = q.grading === "manual";
            const noManual = isManual && a?.manual_score == null;
            const correct = isManual ? (a?.manual_score != null && a.manual_score >= q.points) : a?.auto_correct;
            const models = (q.accepted_answers && q.accepted_answers.length ? q.accepted_answers : (q.correct_options && q.correct_options.length ? q.correct_options : [q.model_answer].filter(Boolean))) as string[];
            return (
              <Card key={q.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold flex items-center gap-2">
                    {noManual ? <span className="text-xs px-2 py-0.5 rounded bg-muted">手動採点待ち</span>
                      : correct ? <Check className="h-5 w-5 text-success" /> : <X className="h-5 w-5 text-destructive" />}
                    問{i+1}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => toggleBookmark(q.id)} title="あとでやる">
                      {bookmarks.has(q.id) ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      {noManual ? "—" : (a?.awarded_points ?? (isManual ? a?.manual_score : (correct ? q.points : 0)) ?? 0)} / {q.points} 点
                    </div>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{q.prompt}</div>
                {q.image_url && <img src={q.image_url} className="max-h-48 rounded border" alt="" />}
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded border p-2"><div className="text-muted-foreground mb-0.5">あなたの解答</div><div className="whitespace-pre-wrap">{display(a?.answer)}</div></div>
                  <div className="rounded border p-2"><div className="text-muted-foreground mb-0.5">模範解答</div>
                    <ul className="list-disc pl-4 space-y-0.5">{models.length ? models.map((m, j) => <li key={j} className="whitespace-pre-wrap">{m}</li>) : <li>（設定なし）</li>}</ul>
                  </div>
                </div>
                {q.explanation && <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap"><span className="font-medium">解説: </span>{q.explanation}</div>}
                {isManual && a?.manual_comment && <div className="text-xs bg-blue-500/10 rounded p-2 whitespace-pre-wrap"><span className="font-medium">講評: </span>{a.manual_comment}</div>}
                <div className="flex justify-end pt-1">
                  <ReportDialog questionId={q.id} questionLabel={q.prompt.slice(0, 50)} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-4 space-y-3">
          <div className="font-bold">AIに送るプロンプト（手動で他AIへ）</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs">口調・指示</label>
              <Textarea rows={2} value={tone} onChange={(e) => setTone(e.target.value)} />
            </div>
            <div>
              <label className="text-xs">追加要望</label>
              <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="例: 数学が苦手なので易しめに" />
            </div>
          </div>
          <Textarea rows={10} value={prompt} readOnly className="font-mono text-xs" />
          <Button onClick={copyPrompt}><Copy className="h-4 w-4 mr-1" />プロンプトをコピー</Button>
        </Card>

        <div className="flex gap-2">
          <Link to="/makron"><Button variant="outline"><Award className="h-4 w-4 mr-1" />Makronトップへ</Button></Link>
          <Link to="/makron/history"><Button variant="ghost">履歴を見る</Button></Link>
        </div>
      </div>
    </MakronShell>
  );
}