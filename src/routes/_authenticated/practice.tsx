import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Sparkles, Loader2, Play, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSimilarFromWrong, clearWrongByTopic } from "@/lib/questions.functions";
import { toast } from "sonner";
import { PracticeSession, type PracticeQuestion } from "@/components/PracticeSession";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type QRow = PracticeQuestion & { was_wrong: boolean | null; attempts: number | null };

function PracticePage() {
  const qc = useQueryClient();
  const genSimilar = useServerFn(generateSimilarFromWrong);
  const clearWrong = useServerFn(clearWrongByTopic);
  const [sessionQs, setSessionQs] = useState<PracticeQuestion[] | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);

  const wrong = useQuery({
    queryKey: ["questions", "wrong"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions").select("*").eq("was_wrong", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QRow[];
    },
  });

  const groups = useMemo(() => {
    const m = new Map<string, QRow[]>();
    (wrong.data ?? []).forEach((q) => {
      const arr = m.get(q.topic) ?? [];
      arr.push(q);
      m.set(q.topic, arr);
    });
    return Array.from(m.entries()).map(([topic, items]) => ({ topic, items }));
  }, [wrong.data]);

  const similarM = useMutation({
    mutationFn: (topic: string) => genSimilar({ data: { topic } }),
    onMutate: (topic) => setPendingTopic(topic),
    onSettled: () => setPendingTopic(null),
    onSuccess: (res: any, topic) => {
      toast.success(`類題を ${res.questions.length} 問生成しました`);
      setSessionTitle(`${topic}（類題演習）`);
      setSessionQs(res.questions as PracticeQuestion[]);
      setResult(null);
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startWrongOnly = (topic: string, items: QRow[]) => {
    setSessionTitle(`${topic}（間違えた問題）`);
    setSessionQs(items as PracticeQuestion[]);
    setResult(null);
  };

  const removeWrong = async (topic: string) => {
    try {
      await clearWrong({ data: { topic } });
      toast.success("苦手履歴をクリアしました");
      qc.invalidateQueries({ queryKey: ["questions", "wrong"] });
    } catch (e: any) { toast.error(e.message); throw e; }
  };

  if (sessionQs) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />{sessionTitle}
          </h1>
          <Button variant="ghost" size="sm" onClick={() => { setSessionQs(null); setResult(null); }}>終了</Button>
        </div>
        {result ? (
          <Card className="p-8 text-center space-y-4">
            <div className="text-3xl font-bold">{result.correct} / {result.total} 正解</div>
            <div className="text-muted-foreground">
              {result.correct === result.total
                ? "弱点克服！🎉"
                : "まだ怪しいところがあります。もう一度類題を生成して、間違えた数の2倍量で補強しましょう。"}
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button onClick={() => { setSessionQs(null); setResult(null); qc.invalidateQueries({ queryKey: ["questions", "wrong"] }); }}>
                苦手一覧に戻る
              </Button>
            </div>
          </Card>
        ) : (
          <PracticeSession
            questions={sessionQs}
            onDone={(s) => { setResult(s); qc.invalidateQueries({ queryKey: ["questions", "wrong"] }); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Target className="h-7 w-7 text-primary" />苦手演習</h1>
        <p className="text-sm text-muted-foreground">
          間違えた問題を分析し、AIが<strong>似たテーマの新しい問題</strong>を間違えた数の2倍量だけ生成します。再び間違えればさらに2倍に増えます。
        </p>
      </div>

      {wrong.isLoading && <Card className="p-8 text-center text-muted-foreground">読み込み中…</Card>}
      {!wrong.isLoading && groups.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">苦手な問題はありません 🎉</Card>
      )}

      {groups.map((g) => {
        const isPending = similarM.isPending && pendingTopic === g.topic;
        return (
          <Card key={g.topic} className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{g.topic}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  間違えた問題 {g.items.length} 問 → 類題 {g.items.length * 2} 問を生成します
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => similarM.mutate(g.topic)} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                類題を {g.items.length * 2} 問生成して演習
              </Button>
              <Button variant="outline" onClick={() => startWrongOnly(g.topic, g.items)}>
                <Play className="h-4 w-4 mr-1" />元の問題をもう一度
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />履歴を削除
                  </Button>
                }
                title={`「${g.topic}」の苦手履歴を削除しますか？`}
                description="このトピックの「間違えた」マークだけがクリアされます。問題本体や採点履歴は残ります。"
                scopeItems={[`苦手マーク ${g.items.length} 件（問題本体は残ります）`]}
                confirmLabel="履歴をクリアする"
                onConfirm={() => removeWrong(g.topic)}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/practice")({ component: PracticePage });
