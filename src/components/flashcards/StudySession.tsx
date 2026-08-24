import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RotateCw, Trophy } from "lucide-react";
import { gradeCard, type Flashcard, type Grade } from "@/lib/flashcards.functions";
import { toast } from "sonner";

type Props = {
  deckName: string;
  cards: Flashcard[];
  onExit: () => void;
};

export function StudySession({ deckName, cards, onExit }: Props) {
  const [queue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [results, setResults] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [busy, setBusy] = useState(false);

  const current = queue[index];
  const done = index >= queue.length;
  const progress = queue.length > 0 ? Math.min(100, Math.round((index / queue.length) * 100)) : 100;

  const total = useMemo(() => Object.values(results).reduce((a, b) => a + b, 0), [results]);

  const handleGrade = async (grade: Grade) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await gradeCard(current, grade);
      setResults((r) => ({ ...r, [grade]: r[grade] + 1 }));
      setShowBack(false);
      setIndex((i) => i + 1);
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  if (queue.length === 0) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="text-lg font-medium">今日の復習対象はありません 🎉</div>
        <Button onClick={onExit}><ArrowLeft className="h-4 w-4 mr-1" />デッキに戻る</Button>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="p-8 text-center space-y-4">
        <Trophy className="h-10 w-10 mx-auto text-primary" />
        <div className="text-xl font-bold">お疲れさま！{deckName}</div>
        <div className="text-sm text-muted-foreground">{total}枚を復習しました</div>
        <div className="flex justify-center gap-3 flex-wrap text-sm">
          <span>もう一度: {results.again}</span>
          <span>むずかしい: {results.hard}</span>
          <span>ふつう: {results.good}</span>
          <span>かんたん: {results.easy}</span>
        </div>
        <Button onClick={onExit}><ArrowLeft className="h-4 w-4 mr-1" />デッキに戻る</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft className="h-4 w-4" /></Button>
        <Progress value={progress} className="flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">{index + 1} / {queue.length}</span>
      </div>
      <Card className="p-6 sm:p-8 text-center space-y-4 min-h-[240px] flex flex-col justify-center">
        <div className="text-xl sm:text-2xl font-medium whitespace-pre-wrap break-words">{current.front}</div>
        {showBack && (
          <div className="text-lg sm:text-xl text-muted-foreground border-t pt-4 whitespace-pre-wrap break-words">
            {current.back}
          </div>
        )}
        {!showBack ? (
          <Button onClick={() => setShowBack(true)} size="lg" className="mx-auto">
            <RotateCw className="h-4 w-4 mr-1" />答えを見る
          </Button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button variant="destructive" disabled={busy} onClick={() => handleGrade("again")}>もう一度</Button>
            <Button variant="outline" disabled={busy} onClick={() => handleGrade("hard")}>むずかしい</Button>
            <Button disabled={busy} onClick={() => handleGrade("good")}>ふつう</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy} onClick={() => handleGrade("easy")}>かんたん</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
