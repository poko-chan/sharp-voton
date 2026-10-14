import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCw, Trophy, Shuffle, Archive, BookCheck } from "lucide-react";
import {
  gradeCard,
  setCardArchived,
  shuffle,
  type Flashcard,
  type Grade,
} from "@/lib/flashcards.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  deckName: string;
  cards: Flashcard[];
  shuffled?: boolean;
  reverse?: boolean;
  userId?: string;
  onExit: () => void;
};

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 学習サイクル:
 * 1. 答えを見る前に自力で思い出す（想起）
 * 2. 自己評価で次回の復習日を決める（間隔反復）
 * 3. 間違えたカードは数枚あとに再出題し、その日のうちに正解させる
 * 4. 終了時に学習記録へ残す
 */
export function StudySession({ deckName, cards, shuffled = false, reverse = false, userId, onExit }: Props) {
  const [queue, setQueue] = useState<Flashcard[]>(() => (shuffled ? shuffle(cards) : cards));
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [results, setResults] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [answered, setAnswered] = useState(0);
  const [missed, setMissed] = useState<Flashcard[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const startedAt = useRef(Date.now());
  const gradedIds = useRef(new Set<string>());

  const current = queue[index];
  const done = index >= queue.length;
  const progress = queue.length > 0 ? Math.min(100, Math.round((index / queue.length) * 100)) : 100;
  const correct = useMemo(() => results.good + results.easy, [results]);
  const question = current ? (reverse ? current.back : current.front) : "";
  const answer = current ? (reverse ? current.front : current.back) : "";

  const handleGrade = useCallback(
    async (grade: Grade) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        // 間隔反復の更新は各カードの初回判定のみ（再出題では日程を二重に崩さない）
        if (!gradedIds.current.has(current.id)) {
          await gradeCard(current, grade);
          gradedIds.current.add(current.id);
        }
        setResults((r) => ({ ...r, [grade]: r[grade] + 1 }));
        setAnswered((n) => n + 1);
        if (grade === "again" || grade === "hard") {
          setMissed((m) => (m.some((c) => c.id === current.id) ? m : [...m, current]));
          // 3枚後に再出題（直後より記憶に効く）
          setQueue((q) => {
            const next = [...q];
            const pos = Math.min(next.length, index + 4);
            next.splice(pos, 0, { ...current });
            return next;
          });
        }
        setShowBack(false);
        setIndex((i) => i + 1);
      } catch {
        toast.error("更新に失敗しました");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, index],
  );

  const archiveCurrent = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await setCardArchived(current.id, true);
      const id = current.id;
      setQueue((q) => q.filter((c, i) => i <= index - 1 || c.id !== id));
      setShowBack(false);
      toast.success("覚えたカードをアーカイブしました");
    } catch {
      toast.error("アーカイブに失敗しました");
    } finally {
      setBusy(false);
    }
  }, [current, busy, index]);

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!showBack) setShowBack(true);
        else handleGrade("good");
        return;
      }
      if (!showBack) return;
      const map: Record<string, Grade> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      if (map[e.key]) {
        e.preventDefault();
        handleGrade(map[e.key]);
      } else if (e.key === "a" || e.key === "A") {
        archiveCurrent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, showBack, handleGrade, archiveCurrent]);

  const reset = (list: Flashcard[]) => {
    setQueue(list);
    setIndex(0);
    setShowBack(false);
    setResults({ again: 0, hard: 0, good: 0, easy: 0 });
    setAnswered(0);
    setMissed([]);
  };

  const saveLog = async () => {
    if (!userId || saved) return;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const { error } = await supabase.from("study_logs").insert({
      user_id: userId,
      date: localDate(),
      duration_minutes: minutes,
      content: `暗記カード「${deckName}」${answered}枚（正解${correct}）`,
    } as any);
    if (error) return toast.error("記録できませんでした");
    setSaved(true);
    toast.success(`学習記録に${minutes}分を追加しました`);
  };

  if (cards.length === 0) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="text-lg font-medium">学習できるカードがありません</div>
        <Button onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          デッキに戻る
        </Button>
      </Card>
    );
  }

  if (done) {
    const total = answered || 1;
    const rate = Math.round((correct / total) * 100);
    return (
      <Card className="p-8 text-center space-y-4">
        <Trophy className="h-10 w-10 mx-auto text-primary" />
        <div className="text-xl font-bold">お疲れさま！{deckName}</div>
        <div className="text-sm text-muted-foreground">
          解答 {answered}回 / 正答率 {rate}% / 要復習 {missed.length}枚
        </div>
        <div className="flex justify-center gap-3 flex-wrap text-sm">
          <span>もう一度: {results.again}</span>
          <span>むずかしい: {results.hard}</span>
          <span>ふつう: {results.good}</span>
          <span>かんたん: {results.easy}</span>
        </div>
        <div className="text-xs text-muted-foreground max-w-md mx-auto">
          正解したカードは忘れかけるころ（1日→6日→さらに長く）に自動で出題されます。
          毎日「今日の復習」だけ解くのが一番効率よく点数につながります。
        </div>
        {missed.length > 0 && (
          <div className="text-left max-w-md mx-auto space-y-1">
            <div className="text-sm font-semibold">間違えたカード ({missed.length})</div>
            {missed.map((c) => (
              <div key={c.id} className="text-xs text-muted-foreground truncate">
                ・{c.front} → {c.back}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-center gap-2 flex-wrap">
          {userId && (
            <Button variant="outline" onClick={saveLog} disabled={saved}>
              <BookCheck className="h-4 w-4 mr-1" />
              {saved ? "記録済み" : "学習記録に追加"}
            </Button>
          )}
          {missed.length > 0 && (
            <Button variant="outline" onClick={() => reset(shuffle(missed))}>
              間違いだけ復習
            </Button>
          )}
          <Button variant="outline" onClick={() => reset(shuffle(cards))}>
            <Shuffle className="h-4 w-4 mr-1" />
            もう一周
          </Button>
          <Button onClick={onExit}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            デッキに戻る
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Progress value={progress} className="flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {reverse && <Badge>反転モード</Badge>}
        <Badge variant="secondary">解答 {answered}</Badge>
        <Badge variant="secondary">正解 {correct}</Badge>
        <Badge variant="secondary">要復習 {missed.length}</Badge>
      </div>
      <Card className="p-6 sm:p-8 text-center space-y-4 min-h-[240px] flex flex-col justify-center">
        <div className="text-xl sm:text-2xl font-medium whitespace-pre-wrap break-words">{question}</div>
        {showBack && (
          <div className="text-lg sm:text-xl text-muted-foreground border-t pt-4 whitespace-pre-wrap break-words">
            {answer}
          </div>
        )}
        {!showBack ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">まず頭の中で答えを思い出してから押しましょう</div>
            <Button onClick={() => setShowBack(true)} size="lg" className="mx-auto">
              <RotateCw className="h-4 w-4 mr-1" />
              答えを見る（Space）
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button variant="destructive" disabled={busy} onClick={() => handleGrade("again")}>
                1 もう一度
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => handleGrade("hard")}>
                2 むずかしい
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => handleGrade("good")}>
                3 ふつう
              </Button>
              <Button disabled={busy} onClick={() => handleGrade("easy")}>
                4 かんたん
              </Button>
            </div>
            <Button variant="ghost" size="sm" disabled={busy} onClick={archiveCurrent}>
              <Archive className="h-3.5 w-3.5 mr-1" />
              完璧に覚えた（A）
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
