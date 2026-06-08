import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Coins, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/missions")({ component: MissionsPage });

const TEMPLATES = [
  { kind: "study_30min", label: "30分勉強する", target: 30, reward: 10 },
  { kind: "review_cards", label: "暗記カード10枚復習", target: 10, reward: 8 },
  { kind: "log_today", label: "今日の記録を1件追加", target: 1, reward: 5 },
  { kind: "habit_stamp", label: "習慣スタンプを1つ", target: 1, reward: 5 },
];

function MissionsPage() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!user) return;
    const { data: existing } = await supabase.from("daily_missions").select("*").eq("user_id", user.id).eq("date", today);
    if (!existing || existing.length === 0) {
      await supabase.from("daily_missions").insert(
        TEMPLATES.map((t) => ({ user_id: user.id, date: today, kind: t.kind, target_value: t.target, reward_coins: t.reward }))
      );
      const { data: again } = await supabase.from("daily_missions").select("*").eq("user_id", user.id).eq("date", today);
      setMissions(again ?? []);
    } else {
      setMissions(existing);
    }
  };
  useEffect(() => { load(); }, [user?.id]);

  const claim = async (m: any) => {
    if (m.completed) return;
    await supabase.from("daily_missions").update({ completed: true, progress: m.target_value }).eq("id", m.id);
    const { data: c } = await supabase.from("user_coins").select("balance").eq("user_id", user!.id).maybeSingle();
    const bal = (c?.balance ?? 0) + m.reward_coins;
    await supabase.from("user_coins").upsert({ user_id: user!.id, balance: bal });
    toast.success(`+${m.reward_coins} コイン獲得！`);
    load();
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Target /> デイリーミッション</h1>
      <div className="space-y-3">
        {missions.map((m) => {
          const tpl = TEMPLATES.find((t) => t.kind === m.kind);
          return (
            <Card key={m.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium">{tpl?.label ?? m.kind}</div>
                <Progress value={(m.progress / m.target_value) * 100} className="mt-2 h-2" />
              </div>
              <div className="text-sm flex items-center gap-1"><Coins className="w-4 h-4" />+{m.reward_coins}</div>
              <Button size="sm" disabled={m.completed} onClick={() => claim(m)}>
                {m.completed ? <CheckCircle2 className="w-4 h-4" /> : "完了"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}