import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Play, BookOpen, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateQuestions, deleteQuestionsByTopic, deleteQuestion, generateExamPaper } from "@/lib/questions.functions";
import { toast } from "sonner";
import { PracticeSession, type PracticeQuestion } from "@/components/PracticeSession";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type QRow = PracticeQuestion & {
  attempts: number | null;
  was_wrong: boolean | null;
  created_at: string;
};

function QuestionsPage() {
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<"flashcard" | "multiple_choice" | "exam">("multiple_choice");
  const [count, setCount] = useState(5);
  const [sessionQs, setSessionQs] = useState<PracticeQuestion[] | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [result, setResult] = useState<{ correct: number; total: number; title: string } | null>(null);

  // 試験予想問題の入力
  const [examSubject, setExamSubject] = useState("");
  const [examScope, setExamScope] = useState("");
  const [examDuration, setExamDuration] = useState(60);
  const [examDifficulty, setExamDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [examCount, setExamCount] = useState(10);
  const [examFormats, setExamFormats] = useState<Array<"multiple_choice" | "exam" | "flashcard">>(["multiple_choice", "exam"]);
  const [examNotes, setExamNotes] = useState("");

  const list = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions").select("*")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as QRow[];
    },
  });

  const gen = useServerFn(generateQuestions);
  const delTopic = useServerFn(deleteQuestionsByTopic);
  const delOne = useServerFn(deleteQuestion);
  const genExam = useServerFn(generateExamPaper);

  const genM = useMutation({
    mutationFn: () => gen({ data: { topic, format, count } }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["questions"] });
      toast.success("生成しました");
      setSessionTitle(topic);
      setSessionQs(res.questions as PracticeQuestion[]);
      setResult(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const examM = useMutation({
    mutationFn: () => genExam({ data: {
      subject: examSubject, scope: examScope, durationMinutes: examDuration,
      difficulty: examDifficulty, questionCount: examCount, formats: examFormats,
      notes: examNotes || undefined,
    }}),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["questions"] });
      toast.success(`試験予想問題 ${res.questions.length} 問を作成しました`);
      setSessionTitle(res.topic);
      setSessionQs(res.questions as PracticeQuestion[]);
      setResult(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFmt = (f: "multiple_choice" | "exam" | "flashcard") => {
    setExamFormats((prev) =>
      prev.includes(f) ? (prev.length > 1 ? prev.filter((x) => x !== f) : prev) : [...prev, f]
    );
  };

  const groups = useMemo(() => {
    const m = new Map<string, QRow[]>();
    (list.data ?? []).forEach((q) => {
      const arr = m.get(q.topic) ?? [];
      arr.push(q);
      m.set(q.topic, arr);
    });
    return Array.from(m.entries()).map(([topic, items]) => ({
      topic,
      items,
      wrongCount: items.filter((i) => i.was_wrong).length,
    }));
  }, [list.data]);

  const startSession = (topic: string, items: QRow[]) => {
    setSessionTitle(topic);
    setSessionQs(items as PracticeQuestion[]);
    setResult(null);
  };

  if (sessionQs) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />演習中: {sessionTitle}
          </h1>
          <Button variant="ghost" size="sm" onClick={() => { setSessionQs(null); setResult(null); }}>終了</Button>
        </div>
        {result ? (
          <Card className="p-8 text-center space-y-4">
            <div className="text-3xl font-bold">{result.correct} / {result.total} 正解</div>
            <div className="text-muted-foreground">
              {result.correct === result.total ? "完璧です！" : "間違えた問題は苦手演習で類題に挑戦できます。"}
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button onClick={() => { setSessionQs(null); setResult(null); qc.invalidateQueries({ queryKey: ["questions"] }); }}>問題一覧に戻る</Button>
            </div>
          </Card>
        ) : (
          <PracticeSession
            questions={sessionQs}
            onDone={(s) => { setResult({ ...s, title: sessionTitle }); qc.invalidateQueries({ queryKey: ["questions"] }); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="h-7 w-7 text-primary" />自動問題生成</h1>
        <p className="text-muted-foreground text-sm">トピックを入力するとAIが問題を作成。生成後はそのまま演習を開始します。</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label>トピック</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例: 江戸時代の経済政策" />
          </div>
          <div>
            <Label>形式</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flashcard">フラッシュカード</SelectItem>
                <SelectItem value="multiple_choice">4択問題</SelectItem>
                <SelectItem value="exam">記述試験</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label>問題数（上限なし）</Label>
            <Input type="number" min={1} value={count}
              onChange={(e) => setCount(Math.max(1, +e.target.value || 1))} className="w-28" />
          </div>
          <Button disabled={!topic.trim() || genM.isPending} onClick={() => genM.mutate()}>
            {genM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            生成して演習開始
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">※ 問題数が多いほど生成に時間がかかります。</p>
      </Card>

      {/* 試験予想問題 */}
      <Card className="p-5 space-y-4 border-primary/30">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">試験予想問題の作成</h2>
        </div>
        <p className="text-xs text-muted-foreground">試験時間や出題範囲を詳細に入力すると、AIが試験形式の予想問題セットを作成します。</p>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>科目・分野</Label>
            <Input value={examSubject} onChange={(e) => setExamSubject(e.target.value)} placeholder="例: 日本史B / 微分積分 / TOEIC Part5" />
          </div>
          <div>
            <Label>試験時間（分）</Label>
            <Input type="number" min={5} max={600} value={examDuration}
              onChange={(e) => setExamDuration(Math.max(5, Math.min(600, +e.target.value || 60)))} />
          </div>
        </div>

        <div>
          <Label>出題範囲・内容（具体的に）</Label>
          <Textarea rows={3} value={examScope} onChange={(e) => setExamScope(e.target.value)}
            placeholder="例: 明治維新〜大正デモクラシー。条約改正と日清・日露戦争を重点的に。" />
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>難易度</Label>
            <Select value={examDifficulty} onValueChange={(v) => setExamDifficulty(v as typeof examDifficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">易しめ</SelectItem>
                <SelectItem value="normal">標準</SelectItem>
                <SelectItem value="hard">難関</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>問題数</Label>
            <Input type="number" min={1} max={100} value={examCount}
              onChange={(e) => setExamCount(Math.max(1, Math.min(100, +e.target.value || 10)))} />
          </div>
          <div>
            <Label className="mb-2 block">形式（複数選択可）</Label>
            <div className="flex flex-wrap gap-3 pt-2">
              {([
                ["multiple_choice", "4択"],
                ["exam", "記述"],
                ["flashcard", "短答"],
              ] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={examFormats.includes(v)} onCheckedChange={() => toggleFmt(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>補足要望（任意）</Label>
          <Textarea rows={2} value={examNotes} onChange={(e) => setExamNotes(e.target.value)}
            placeholder="例: 記述は配点高め。年号を問う問題を必ず3問入れる。" />
        </div>

        <Button
          disabled={!examSubject.trim() || !examScope.trim() || examM.isPending}
          onClick={() => examM.mutate()}
        >
          {examM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
          試験予想問題を作成
        </Button>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">問題一覧（トピック別）</h2>
        {groups.length === 0 && <p className="text-sm text-muted-foreground">まだ問題がありません。</p>}
        {groups.map((g) => (
          <Card key={g.topic} className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{g.topic}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {g.items.length} 問
                  {g.wrongCount > 0 && <span className="ml-2 text-destructive">要復習 {g.wrongCount}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button onClick={() => startSession(g.topic, g.items)}>
                  <Play className="h-4 w-4 mr-1" />演習開始
                </Button>
                <ConfirmDialog
                  trigger={<Button variant="outline" size="icon" title="このトピックを全削除"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  title={`「${g.topic}」を削除しますか？`}
                  description="このトピックに紐づくすべての問題と関連データが完全に削除されます。元に戻せません。"
                  scopeItems={[
                    `問題 ${g.items.length} 件`,
                    g.wrongCount > 0 ? `苦手マーク ${g.wrongCount} 件` : null,
                    "これらの問題に対する AI 採点履歴すべて",
                  ].filter(Boolean) as string[]}
                  confirmLabel="すべて削除する"
                  onConfirm={async () => {
                    try { await delTopic({ data: { topic: g.topic } }); toast.success("削除しました"); qc.invalidateQueries({ queryKey: ["questions"] }); }
                    catch (e: any) { toast.error(e.message); throw e; }
                  }}
                />
              </div>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">問題を個別に管理 ({g.items.length})</summary>
              <ul className="mt-2 space-y-1">
                {g.items.map((q) => (
                  <li key={q.id} className="flex items-start gap-2 p-2 rounded border">
                    <span className="flex-1 text-xs">{q.question}</span>
                    <ConfirmDialog
                      trigger={<button className="text-destructive hover:opacity-70 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>}
                      title="この問題を削除しますか？"
                      description="問題本体と、この問題に紐づく AI 採点履歴がすべて削除されます。"
                      scopeItems={["問題 1 件", "この問題の採点履歴すべて"]}
                      onConfirm={async () => {
                        try { await delOne({ data: { id: q.id } }); toast.success("削除しました"); qc.invalidateQueries({ queryKey: ["questions"] }); }
                        catch (e: any) { toast.error(e.message); throw e; }
                      }}
                    />
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/questions")({ component: QuestionsPage });
