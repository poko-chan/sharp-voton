import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Swords, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/battle")({ component: BattlePage });

function BattlePage() {
  const { user } = useAuth();
  const [battles, setBattles] = useState<any[]>([]);
  const [opponent, setOpponent] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("quiz_battles").select("*")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(20);
    setBattles(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const challenge = async () => {
    if (!user || !opponent) return;
    const { data: p } = await supabase.from("profiles").select("id").eq("username", opponent).maybeSingle();
    if (!p) return toast.error("ユーザーが見つかりません");
    await supabase.from("quiz_battles").insert({ challenger_id: user.id, opponent_id: p.id });
    toast.success("対戦を申し込みました");
    setOpponent(""); load();
  };

  const play = async (b: any) => {
    const myScore = Math.floor(Math.random() * 10);
    const isChallenger = b.challenger_id === user!.id;
    const patch: any = isChallenger ? { challenger_score: myScore } : { opponent_score: myScore };
    const other = isChallenger ? b.opponent_score : b.challenger_score;
    if (other > 0) {
      patch.status = "finished";
      patch.winner_id = myScore > other ? user!.id : (myScore < other ? (isChallenger ? b.opponent_id : b.challenger_id) : null);
    }
    await supabase.from("quiz_battles").update(patch).eq("id", b.id);
    toast.success(`スコア: ${myScore}`);
    load();
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Swords /> 学習バトル</h1>
      <Card className="p-4 mb-4 bg-muted/40 text-sm space-y-1">
        <div className="font-semibold">遊び方</div>
        <ol className="list-decimal pl-5 space-y-0.5 text-muted-foreground">
          <li>相手のユーザー名を入力して「挑戦」を押す</li>
          <li>挑戦中のバトルで「プレイ」を押すと0〜9点が記録される</li>
          <li>両者がプレイ済みになったら自動的に勝敗が確定する</li>
          <li>勝つとランキングと段位ボーナスに反映</li>
        </ol>
      </Card>
      <Card className="p-4 mb-6 flex gap-2">
        <Input placeholder="相手のユーザー名" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
        <Button onClick={challenge}>挑戦</Button>
      </Card>
      <div className="space-y-2">
        {battles.map((b) => {
          const isChallenger = b.challenger_id === user?.id;
          const myScore = isChallenger ? b.challenger_score : b.opponent_score;
          const oppScore = isChallenger ? b.opponent_score : b.challenger_score;
          return (
            <Card key={b.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="text-sm">{isChallenger ? "→" : "←"} 対戦</div>
                <div className="text-xs text-muted-foreground">あなた {myScore} vs 相手 {oppScore}</div>
              </div>
              {b.status === "finished" ? (
                <div className="text-sm font-bold">{b.winner_id === user?.id ? <span className="text-green-600 flex items-center gap-1"><Trophy className="w-4 h-4" />勝ち</span> : b.winner_id ? "負け" : "引き分け"}</div>
              ) : (
                <Button size="sm" onClick={() => play(b)} disabled={myScore > 0}>プレイ</Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}