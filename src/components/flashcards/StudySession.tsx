import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCw, Trophy, Shuffle } from "lucide-react";
import { gradeCard, shuffle, type Flashcard, type Grade } from "@/lib/flashcards.functions";
import { toast } from "sonner";

type Props = {
  deckName: string;
  cards: Flashcard[];
  shuffled?: boolean;
  onExit: () => void;
};

export function StudySession({ deckName, cards, shuffled = false, onExit }: Props) {
  const [queue, setQueue] = useState<Flashcard[]>(() => (shuffled ? shuffle(cards) : cards));
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [results, setResults] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [answered, setAnswered] = useState(0);
  const [missed, setMissed] = useState<Flashcard[]>([]);
  const [busy, setBusy] = useState(false);

  const current = queue[index];
  const done = index >= queue.length;
  const progress = queue.length > 0 ? Math.min(100, Math.round((index / queue.length) * 100)) : 100;

  const correct = useMemo(() => results.good + results.easy, [results]);

  const handleGrade = async (grade: Grade) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await gradeCard(current, grade);
      setResults((r) => ({ ...r, [grade]: r[grade] + 1 }));
      setAnswered((n) => n + 1);
      // 「もう一度」「むずかしい」はセッション内で再出題する（習得扱いにしない）
      if (grade === "again" || grade === "hard") {
        setMissed((m) => (m.some((c) => c.id === current.id) ? m : [...m, current]));
        setQueue((q) => [...q, { ...current }]);
      }
      setShowBack(false);
      setIndex((i) => i + 1);
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const restart = (doShuffle: boolean) => {
    const base = cards;
    setQueue(doShuffle ? shuffle(base) : base);
    setIndex(0);
    setShowBack(false);
    setResults({ again: 0, hard: 0, good: 0, easy: 0 });
    setAnswered(0);
    setMissed([]);
  };

  const retryMissed = () => {
    if (missed.length === 0) return;
    setQueue(shuffle(missed));
    setIndex(0);
    setShowBack(false);
    setResults({ again: 0, hard: 0, good: 0, easy: 0 });
    setAnswered(0);
    setMissed([]);
  };

  if (cards.length === 0) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="text-lg font-medium">学習できるカードがありません</div>
        <Button onClick={onExit}><ArrowLeft className="h-4 w-4 mr-1" />デッキに戻る</Button>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="p-8 text-center space-y-4">
        <Trophy className="h-10 w-10 mx-auto text-primary" />
        <div className="text-xl font-bold">お疲れさま！{deckName}</div>
        <div className="text-sm text-muted-foreground">
          解答数 {answered}枚 / 正解 {correct}枚 / 間違い {results.again + results.hard}枚
        </div>
        <div className="flex justify-center gap-3 flex-wrap text-sm">
          <span>もう一度: {results.again}</span>
          <span>むずかしい: {results.hard}</span>
          <span>ふつう: {results.good}</span>
          <span>かんたん: {results.easy}</span>
        </div>
        {missed.length > 0 && (
          <div className="text-left max-w-md mx-auto space-y-1">
            <div className="text-sm font-semibold">間違えたカード ({missed.length})</div>
            {missed.map((c) => (
              <div key={c.id} className="text-xs text-muted-foreground truncate">・{c.front} → {c.back}</div>
            ))}
          </div>
        )}
        <div className="flex justify-center gap-2 flex-wrap">
          {missed.length > 0 && <Button variant="outline" onClick={retryMissed}>間違いだけ復習</Button>}
          <Button variant="outline" onClick={() => restart(true)}><Shuffle className="h-4 w-4 mr-1" />シャッフルしてもう一周</Button>
          <Button onClick={onExit}><ArrowLeft className="h-4 w-4 mr-1" />デッキに戻る</Button>
        </div>
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
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Badge variant="secondary">解答 {answered}</Badge>
        <Badge variant="secondary">正解 {correct}</Badge>
        <Badge variant="secondary">要復習 {missed.length}</Badge>
        <Button size="sm" variant="ghost" onClick={() => restart(true)}>
          <Shuffle className="h-3.5 w-3.5 mr-1" />シャッフル
        </Button>
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
