import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, ChevronRight, Sparkles, Loader2, RefreshCw, History, Trash2 } from "lucide-react";
import { recordAttempt, gradeWrittenAnswer, deleteGradingRecord } from "@/lib/questions.functions";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

export type PracticeQuestion = {
  id: string;
  topic: string;
  format: string;
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
};

type GradingRecord = {
  id: string;
  question_id: string;
  user_answer: string;
  score: number;
  correct: boolean;
  feedback: string;
  created_at: string;
};

export function PracticeSession({
  questions,
  onDone,
}: {
  questions: PracticeQuestion[];
  onDone: (summary: { correct: number; total: number }) => void;
}) {
  const qc = useQueryClient();
  const record = useServerFn(recordAttempt);
  const grade = useServerFn(gradeWrittenAnswer);
  const delGrading = useServerFn(deleteGradingRecord);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [written, setWritten] = useState("");
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<{ score: number; correct: boolean; feedback: string; at?: string } | null>(null);

  const q = questions[idx];

  const history = useQuery({
    queryKey: ["grading_history", q?.id],
    enabled: !!q?.id && q?.format === "exam",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("grading_history").select("*")
        .eq("question_id", q!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GradingRecord[];
    },
  });

  if (!q) return null;

  const isMC = q.format === "multiple_choice" && q.options && q.options.length > 0;
  const isExam = q.format === "exam";

  const submit = async (val: string) => {
    setPicked(val);
    setReveal(true);
    const correct = val.trim().toLowerCase() === q.answer.trim().toLowerCase();
    if (correct) setCorrectCount((c) => c + 1);
    try { await record({ data: { id: q.id, correct } }); } catch {}
  };

  const doGrade = async (isRegrade = false) => {
    if (!written.trim()) return;
    setGrading(true);
    try {
      const r = await grade({ data: { id: q.id, userAnswer: written } });
      setGradeResult({ ...r, at: new Date().toISOString() });
      setReveal(true);
      // 初回採点時のみカウント
      if (!isRegrade && r.correct) setCorrectCount((c) => c + 1);
      qc.invalidateQueries({ queryKey: ["grading_history", q.id] });
    } catch (e: any) {
      setReveal(true);
      setGradeResult({ score: 0, correct: false, feedback: `採点エラー: ${e.message}` });
      toast.error(e.message);
    } finally {
      setGrading(false);
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      onDone({ correct: correctCount, total: questions.length });
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    setReveal(false);
    setWritten("");
    setGradeResult(null);
  };

  const removeGradingRecord = async (id: string) => {
    try {
      await delGrading({ data: { id } });
      toast.success("採点履歴を削除しました");
      qc.invalidateQueries({ queryKey: ["grading_history", q.id] });
    } catch (e: any) { toast.error(e.message); throw e; }
  };

  const isCorrect = picked && picked.trim().toLowerCase() === q.answer.trim().toLowerCase();

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{q.topic}</span>
        <span>{idx + 1} / {questions.length}</span>
      </div>
      <div className="text-lg font-medium whitespace-pre-wrap">{q.question}</div>

      {isMC ? (
        <div className="grid gap-2">
          {q.options!.map((opt) => {
            const optCorrect = opt === q.answer;
            const optPicked = picked === opt;
            return (
              <Button
                key={opt}
                variant="outline"
                disabled={reveal}
                onClick={() => submit(opt)}
                className={`justify-start ${reveal && optCorrect ? "border-success bg-success/10" : ""} ${reveal && optPicked && !optCorrect ? "border-destructive bg-destructive/10" : ""}`}
              >
                {opt}
              </Button>
            );
          })}
        </div>
      ) : isExam ? (
        <div className="space-y-2">
          <Textarea
            value={written}
            onChange={(e) => setWritten(e.target.value)}
            placeholder="ここに解答を記述..."
            rows={5}
            disabled={grading}
          />
          <div className="flex flex-wrap gap-2">
            {!reveal ? (
              <>
                <Button disabled={!written.trim() || grading} onClick={() => doGrade(false)}>
                  {grading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AIに採点してもらう
                </Button>
                <Button variant="outline" disabled={grading} onClick={() => setReveal(true)}>
                  採点せず答えを見る
                </Button>
              </>
            ) : (
              <Button variant="outline" disabled={!written.trim() || grading} onClick={() => doGrade(true)}>
                {grading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                再採点する
              </Button>
            )}
          </div>
        </div>
      ) : !reveal ? (
        <Button variant="outline" onClick={() => setReveal(true)}>答えを見る</Button>
      ) : null}

      {reveal && (
        <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
          {gradeResult && (
            <div className="rounded border border-border p-3 bg-background space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                {gradeResult.correct ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                採点: {gradeResult.score}点 / 100
              </div>
              <div className="text-muted-foreground whitespace-pre-wrap">{gradeResult.feedback}</div>
            </div>
          )}
          <div className="flex items-center gap-2 font-medium">
            {isMC ? (isCorrect ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />) : null}
            模範解答: {q.answer}
          </div>
          {q.explanation && <div className="text-muted-foreground">{q.explanation}</div>}
          {!isMC && !isExam && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => submit(q.answer)}><Check className="h-4 w-4 mr-1" />正解だった</Button>
              <Button size="sm" variant="outline" onClick={() => submit("__wrong__")}><X className="h-4 w-4 mr-1" />間違えた</Button>
            </div>
          )}
          {isExam && !gradeResult && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={async () => { setCorrectCount((c) => c + 1); try { await record({ data: { id: q.id, correct: true } }); } catch {} setPicked(q.answer); }}>
                <Check className="h-4 w-4 mr-1" />合っていた
              </Button>
              <Button size="sm" variant="outline" onClick={async () => { try { await record({ data: { id: q.id, correct: false } }); } catch {} setPicked("__wrong__"); }}>
                <X className="h-4 w-4 mr-1" />間違えた
              </Button>
            </div>
          )}
          {(isMC || picked || gradeResult) && (
            <div className="pt-2">
              <Button size="sm" variant="default" onClick={next}>
                {idx + 1 >= questions.length ? "結果を見る" : "次へ"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 採点履歴 */}
      {isExam && history.data && history.data.length > 0 && (
        <details className="rounded border border-border p-3 text-sm">
          <summary className="cursor-pointer flex items-center gap-1.5 font-medium">
            <History className="h-4 w-4" />採点履歴 ({history.data.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {history.data.map((h) => (
              <li key={h.id} className="border-l-2 border-muted-foreground/30 pl-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    {h.correct ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                    <span className="font-medium">{h.score}点</span>
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("ja-JP")}</span>
                  </div>
                  <ConfirmDialog
                    trigger={<button className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>}
                    title="採点履歴を削除しますか？"
                    description="この採点記録（点数・フィードバック・解答）が削除されます。問題本体は残ります。"
                    scopeItems={[`採点記録 1 件（${h.score}点, ${new Date(h.created_at).toLocaleString("ja-JP")}）`]}
                    onConfirm={() => removeGradingRecord(h.id)}
                  />
                </div>
                <div className="text-xs text-muted-foreground">解答: <span className="whitespace-pre-wrap">{h.user_answer}</span></div>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap">講評: {h.feedback}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
