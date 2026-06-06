import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/flashcards")({ component: FlashcardsPage });

type Card_ = { id: string; front: string; back: string; deck: string; ease: number; interval_days: number; next_review_at: string; reviews: number };

function FlashcardsPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card_[]>([]);
  const [deck, setDeck] = useState("default");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("flashcards").select("*").eq("user_id", user.id).order("next_review_at");
    setCards((data ?? []) as any);
  };
  useEffect(() => { load(); }, [user?.id]);

  const add = async () => {
    if (!user || !front.trim() || !back.trim()) return;
    await supabase.from("flashcards").insert({ user_id: user.id, deck, front, back });
    setFront(""); setBack(""); load();
  };
  const del = async (id: string) => { await supabase.from("flashcards").delete().eq("id", id); load(); };

  const due = cards.filter((c) => new Date(c.next_review_at) <= new Date());
  const current = due[reviewIdx];

  const grade = async (q: 0 | 3 | 4 | 5) => {
    if (!current) return;
    let ease = current.ease, interval = current.interval_days;
    if (q < 3) { interval = 1; ease = Math.max(1.3, ease - 0.2); }
    else {
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 6;
      else interval = Math.round(interval * ease);
      ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      ease = Math.max(1.3, ease);
    }
    const next = new Date(); next.setDate(next.getDate() + interval);
    await supabase.from("flashcards").update({
      ease, interval_days: interval, next_review_at: next.toISOString(), reviews: current.reviews + 1,
    }).eq("id", current.id);
    setShowBack(false);
    if (reviewIdx + 1 >= due.length) { toast.success("お疲れさま！"); setReviewIdx(0); load(); }
    else setReviewIdx(reviewIdx + 1);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2"><Brain className="h-7 w-7" /><h1 className="text-3xl font-bold">暗記カード</h1></div>

      {current ? (
        <Card className="p-8 text-center space-y-4 min-h-[240px] flex flex-col justify-center">
          <div className="text-xs text-muted-foreground">{reviewIdx + 1} / {due.length}</div>
          <div className="text-2xl font-medium whitespace-pre-wrap">{current.front}</div>
          {showBack && <div className="text-xl text-muted-foreground border-t pt-4 whitespace-pre-wrap">{current.back}</div>}
          {!showBack ? (
            <Button onClick={() => setShowBack(true)} size="lg"><RotateCw className="h-4 w-4 mr-1" />答えを見る</Button>
          ) : (
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="destructive" onClick={() => grade(0)}>もう一度</Button>
              <Button variant="outline" onClick={() => grade(3)}>難しい</Button>
              <Button onClick={() => grade(4)}>OK</Button>
              <Button className="bg-emerald-600" onClick={() => grade(5)}>簡単</Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-8 text-center text-muted-foreground">復習すべきカードはありません 🎉</Card>
      )}

      <Card className="p-4 space-y-2">
        <div className="font-semibold flex items-center gap-1"><Plus className="h-4 w-4" />新規カード</div>
        <Input placeholder="デッキ名" value={deck} onChange={(e) => setDeck(e.target.value)} />
        <Textarea placeholder="表（問題）" value={front} onChange={(e) => setFront(e.target.value)} />
        <Textarea placeholder="裏（答え）" value={back} onChange={(e) => setBack(e.target.value)} />
        <Button onClick={add} className="w-full">追加</Button>
      </Card>

      <div className="space-y-1">
        <div className="font-semibold text-sm">全カード ({cards.length})</div>
        {cards.map((c) => (
          <Card key={c.id} className="p-2 flex items-center gap-2 text-sm">
            <div className="flex-1 truncate">{c.front} → {c.back}</div>
            <span className="text-xs text-muted-foreground">×{c.reviews}</span>
            <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-3 w-3" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}