import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Flame, Coins } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/streak")({ component: StreakPage });

const FREEZE_COST = 30;

function StreakPage() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [coins, setCoins] = useState(0);
  const [freezes, setFreezes] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: logs } = await supabase.from("study_logs").select("date").eq("user_id", user.id).order("date", { ascending: false }).limit(365);
    const { data: fz } = await supabase.from("streak_freezes").select("*").eq("user_id", user.id);
    setFreezes(fz ?? []);
    const { data: c } = await supabase.from("user_coins").select("balance").eq("user_id", user.id).maybeSingle();
    setCoins(c?.balance ?? 0);
    const dates = new Set([...(logs ?? []).map((l: any) => l.date), ...(fz ?? []).map((f: any) => f.date)]);
    let s = 0; const d = new Date();
    for (let i = 0; i < 365; i++) {
      const k = d.toISOString().slice(0, 10);
      if (dates.has(k)) { s++; d.setDate(d.getDate() - 1); } else break;
    }
    setStreak(s);
  };
  useEffect(() => { load(); }, [user?.id]);

  const buyFreeze = async () => {
    if (!user) return;
    if (coins < FREEZE_COST) return toast.error(`コインが足りません (${FREEZE_COST}必要)`);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("streak_freezes").insert({ user_id: user.id, date: today });
    if (error) return toast.error(error.message);
    await supabase.from("user_coins").update({ balance: coins - FREEZE_COST }).eq("user_id", user.id);
    toast.success("ストリーク保護を使用しました"); load();
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2"><Shield className="h-7 w-7" /><h1 className="text-3xl font-bold">ストリーク保護</h1></div>
      <Card className="p-6 text-center space-y-2">
        <Flame className="h-12 w-12 mx-auto text-orange-500" />
        <div className="text-5xl font-bold">{streak}<span className="text-xl text-muted-foreground">日</span></div>
        <div className="text-sm text-muted-foreground">連続学習</div>
      </Card>
      <Card className="p-4 space-y-2">
        <div className="flex justify-between"><span>所持コイン</span><span className="font-mono flex items-center gap-1"><Coins className="h-4 w-4" />{coins}</span></div>
        <Button onClick={buyFreeze} className="w-full" disabled={coins < FREEZE_COST}>
          <Shield className="h-4 w-4 mr-1" />本日のストリークを保護 ({FREEZE_COST}コイン)
        </Button>
        <div className="text-xs text-muted-foreground">使用済み: {freezes.length}回</div>
      </Card>
    </div>
  );
}